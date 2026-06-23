const CHANNEL_ID = import.meta.env.VITE_SLACK_CHANNEL_ID || '';

// Extract a URL from a Slack mrkdwn <url|label> token or bare URL
// Slack encodes & as &amp; inside URLs — decode before returning
function extractUrl(str) {
  const m = str.match(/<(https?:\/\/[^|>]+)(?:\|[^>]*)?>/) || str.match(/(https?:\/\/\S+)/);
  return m ? m[1].replace(/&amp;/g, '&') : null;
}

// Pull runbook + dashboard URLs out of attachment text lines
function extractUrls(attachmentText) {
  let runbookUrl   = null;
  let dashboardUrl = null;
  for (const line of (attachmentText || '').split('\n')) {
    if (!runbookUrl   && /runbook/i.test(line))   runbookUrl   = extractUrl(line);
    if (!dashboardUrl && /dashboard/i.test(line)) dashboardUrl = extractUrl(line);
  }
  return { runbookUrl, dashboardUrl };
}

export function parseAlertMessage(message) {
  // Alertmanager sends bot_message with empty text; content is in attachments.
  // Fall back to top-level message text if no attachments (some integrations differ).
  const att = (message.attachments || [])[0];
  const decode = s => (s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

  // Gather all text sources — title is authoritative for priority/POP/name,
  // body/fallback/pretext carry values and URLs.
  const title    = decode(att?.title    || message.text || '');
  const bodyText = decode(att?.text     || '');
  const fallback = decode(att?.fallback || '');
  const pretext  = decode(att?.pretext  || '');
  const allBody  = [bodyText, pretext, fallback].filter(Boolean).join('\n');

  // Must have a priority marker somewhere — title first, then body
  const priorityMatch = title.match(/\*P([1-5])\*/) || allBody.match(/\*P([1-5])\*/);
  if (!priorityMatch) return null;
  const priority = `P${priorityMatch[1]}`;

  // Resolved: fallback [RESOLVED...] or body starts with "Resolved:"
  const isResolved = /^\[RESOLVED/i.test(fallback) || /^Resolved:/i.test(bodyText.trim());

  // Parse POP, service, alertName from title
  // Format A: *P3* POP - service: alert name
  // Format B: *P3* POP - alert name  (no colon)
  // Format C: *P3*  - alert name     (empty POP — fill from fallback)
  // Format D: title is just the alert name (no *Px* prefix at all — rare)
  let pop = 'UNKNOWN', service = '', alertName = '';

  const titleMatch = title.match(/\*P\d+\*\s*([A-Z0-9-]*)\s*-\s*(.+)/i);
  if (titleMatch) {
    pop = titleMatch[1].trim();
    const rest   = titleMatch[2].trim();
    const colIdx = rest.indexOf(':');
    service   = colIdx > 0 ? rest.slice(0, colIdx).trim() : rest;
    alertName = colIdx > 0 ? rest.slice(colIdx + 1).trim() : rest;
  } else {
    // No standard prefix — use whole title as alertName
    alertName = title.replace(/\*P\d+\*\s*/i, '').trim() || 'unknown';
    service   = alertName;
  }

  // Fill missing POP from fallback: looks for "AB-XYZ1" pattern
  if (!pop || pop === 'UNKNOWN') {
    const m = fallback.match(/\b([A-Z]{2,3}-[A-Z]{2,5}\d+)\b/)
           || allBody.match(/[Pp]op[:\s]+([A-Z]{2,3}-[A-Z]{2,5}\d+)/);
    pop = m ? m[1] : 'UNKNOWN';
  }

  // Value — "value:123", "value: 3.00 (ms)", ": 1 - Dashboard", "sum 123"
  const valueMatch = allBody.match(/value:\s*([\d.]+)(?:\s*\(([^)]+)\))?/i)
    || allBody.match(/:\s*([\d.]+)\s*-\s*Dashboard/i)
    || allBody.match(/\bsum\s+([\d.]+)/i);
  const value = valueMatch ? valueMatch[1] : null;
  const unit  = valueMatch ? (valueMatch[2] || null) : null;

  const { runbookUrl, dashboardUrl } = extractUrls(allBody);

  const alertKey = `${priority}-${pop}-${service}-${alertName}`
    .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const ts = parseFloat(message.ts) * 1000;

  return {
    id: message.ts,
    alertKey,
    priority,
    pop,
    service,
    alertName,
    value,
    unit,
    isResolved,
    runbookUrl,
    dashboardUrl,
    ts,
    firedAt:    isResolved ? null : new Date(ts),
    resolvedAt: isResolved ? new Date(ts) : null,
  };
}

// ── Fetch & correlate ─────────────────────────────────────────────────────────
export async function fetchChannelAlerts(channelId = CHANNEL_ID) {
  if (!channelId) throw new Error('VITE_SLACK_CHANNEL_ID not set');

  const oldest = ((Date.now() - 2 * 60 * 60 * 1000) / 1000).toFixed(6); // 2 hours ago as Unix ts
  const url = `/api/slack/api/conversations.history?channel=${channelId}&limit=200&oldest=${oldest}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Slack API HTTP ${res.status}`);

  const data = await res.json();
  if (!data.ok) throw new Error(`Slack API error: ${data.error || 'unknown'}`);

  const messages = (data.messages || []).reverse(); // oldest first

  // Map: alertKey → alert object (merge fired + resolved)
  const alertMap = new Map();

  for (const msg of messages) {
    const parsed = parseAlertMessage(msg);
    if (!parsed) continue;

    const existing = alertMap.get(parsed.alertKey);

    if (parsed.isResolved) {
      if (existing) {
        // Mark the existing fired alert as resolved
        alertMap.set(parsed.alertKey, {
          ...existing,
          status:     'resolved',
          resolvedAt: parsed.resolvedAt,
          resolvedTs: parsed.ts,
          lastValue:  parsed.value || existing.lastValue,
        });
      } else {
        // Resolved message arrived without a prior fired message in window
        alertMap.set(parsed.alertKey, {
          ...parsed,
          id:         parsed.id,
          status:     'resolved',
          firedAt:    null,
          resolvedAt: parsed.resolvedAt,
          lastValue:  parsed.value,
        });
      }
    } else {
      const prev = alertMap.get(parsed.alertKey);
      // If already firing, preserve the earliest firedAt — re-notifications
      // from Alertmanager must not reset the timer back to "Recent".
      const firedAt = (prev?.status === 'firing' && prev.firedAt && prev.firedAt < parsed.firedAt)
        ? prev.firedAt
        : parsed.firedAt;
      alertMap.set(parsed.alertKey, {
        ...parsed,
        status:    'firing',
        firedAt,
        lastValue: parsed.value,
      });
    }
  }

  return Array.from(alertMap.values())
    .sort((a, b) => {
      // Sort: firing first, then by priority (P1 > P5), then by firedAt desc
      if (a.status !== b.status) return a.status === 'firing' ? -1 : 1;
      const pa = parseInt(a.priority.slice(1), 10);
      const pb = parseInt(b.priority.slice(1), 10);
      if (pa !== pb) return pa - pb;
      return (b.firedAt || b.resolvedAt || 0) - (a.firedAt || a.resolvedAt || 0);
    });
}
