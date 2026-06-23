import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const jiraAuth = env.JIRA_EMAIL && env.JIRA_API_TOKEN
    ? Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`).toString('base64')
    : null;

  const confluenceAuth = env.CONFLUENCE_EMAIL && env.CONFLUENCE_API_TOKEN
    ? Buffer.from(`${env.CONFLUENCE_EMAIL}:${env.CONFLUENCE_API_TOKEN}`).toString('base64')
    : null;

  // Normalise: strip trailing /wiki so our paths (/wiki/rest/api/...) never
  // produce a double /wiki/wiki/... regardless of what the user put in .env.
  const confluenceTarget = (env.CONFLUENCE_BASE_URL || 'https://placeholder.atlassian.net')
    .replace(/\/wiki\/?$/, '');

  // ── Runbook summary middleware ─────────────────────────────────────────────
  // POST /api/runbook-summary  { url: "https://..." }
  // Fetches Confluence page (server-side, auth injected), strips HTML,
  // then asks Claude to extract concise action steps.
  function runbookSummaryMiddleware() {
    return {
      name: 'runbook-summary',
      configureServer(server) {
        server.middlewares.use('/api/runbook-summary', async (req, res) => {
          if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return; }
          try {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const { url } = JSON.parse(Buffer.concat(chunks).toString());
            if (!url) throw new Error('url required');

            // 1. Resolve the URL to get the Confluence pageId.
            //    Short URLs like /wiki/x/XXXX redirect to /wiki/spaces/.../pages/ID
            //    We follow the redirect server-side with auth.
            const pageRes = await fetch(url, {
              headers: {
                Authorization: confluenceAuth ? `Basic ${confluenceAuth}` : '',
                Accept: 'text/html',
              },
              redirect: 'follow',
            });

            // Extract pageId from the final URL or from HTML meta
            const finalUrl = pageRes.url;
            const html     = await pageRes.text();

            let pageId = null;
            // Try canonical URL pattern: /pages/12345678
            const urlIdMatch = finalUrl.match(/\/pages\/(\d+)/);
            if (urlIdMatch) pageId = urlIdMatch[1];

            // Fallback: meta ajs-page-id in HTML
            if (!pageId) {
              const metaMatch = html.match(/ajs-page-id['"]\s+content=['"](\d+)['"]/);
              if (metaMatch) pageId = metaMatch[1];
            }

            let pageContent = '';

            if (pageId) {
              // 2. Fetch the page body as storage/export_view via REST API
              const apiUrl = `${confluenceTarget}/wiki/rest/api/content/${pageId}?expand=body.export_view`;
              const apiRes = await fetch(apiUrl, {
                headers: {
                  Authorization: confluenceAuth ? `Basic ${confluenceAuth}` : '',
                  Accept: 'application/json',
                },
              });
              if (apiRes.ok) {
                const data = await apiRes.json();
                pageContent = data?.body?.export_view?.value || '';
              }
            }

            // Strip HTML tags, collapse whitespace
            const text = pageContent
              .replace(/<[^>]+>/g, ' ')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/\s{2,}/g, ' ')
              .trim()
              .slice(0, 8000); // cap for token budget

            if (!text) throw new Error('Could not extract page content');

            // 3. Ask Claude to extract action steps
            const { default: Anthropic } = await import('@anthropic-ai/sdk');
            const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
            const message = await anthropic.messages.create({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 512,
              messages: [{
                role: 'user',
                content: `You are an on-call engineer reading a runbook. Extract a concise, numbered list of the most important immediate actions to take when this alert fires. Be specific and actionable. Output ONLY the numbered steps, no preamble.\n\nRunbook content:\n${text}`,
              }],
            });

            const summary = message.content[0]?.text || 'No summary available.';
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ summary }));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      },
    };
  }

  // ── Dashboard analysis middleware ──────────────────────────────────────────
  // POST /api/dashboard-analysis  { dashboardUrl: "https://...", range: "7d"|"30d" }
  // Fetches Grafana panel JSON data server-side (VPN reachable from dev machine),
  // then asks Claude to summarise trends, anomalies, and current alert context.
  function dashboardAnalysisMiddleware() {
    return {
      name: 'dashboard-analysis',
      configureServer(server) {
        server.middlewares.use('/api/dashboard-analysis', async (req, res) => {
          if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
          try {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const { dashboardUrl, range = '7d', alertName = '' } = JSON.parse(Buffer.concat(chunks).toString());
            if (!dashboardUrl) throw new Error('dashboardUrl required');

            // Parse Grafana URL to extract uid and panel id
            const u = new URL(dashboardUrl);
            const pathParts  = u.pathname.split('/');
            const dashUid    = pathParts[pathParts.indexOf('d') + 1];  // /d/<uid>/name
            const panelId    = u.searchParams.get('viewPanel');
            const baseGrafana = `${u.protocol}//${u.host}`;

            const fromMs = range === '30d'
              ? Date.now() - 30 * 24 * 60 * 60 * 1000
              : Date.now() -  7 * 24 * 60 * 60 * 1000;
            const toMs   = Date.now();

            // Fetch the dashboard JSON to get panel + datasource info
            let panelData = null;
            let panelTitle = '';
            let seriesText = '';

            try {
              const dashRes = await fetch(`${baseGrafana}/api/dashboards/uid/${dashUid}`, {
                headers: { Accept: 'application/json' },
              });
              if (dashRes.ok) {
                const dashJson = await dashRes.json();
                const panels   = dashJson?.dashboard?.panels || [];
                const panel    = panelId
                  ? panels.find(p => String(p.id) === String(panelId))
                  : panels[0];

                if (panel) {
                  panelTitle = panel.title || '';
                  panelData  = panel;

                  // Try Grafana datasource query API to get actual time-series data
                  const dsUid = panel?.datasource?.uid || panel?.targets?.[0]?.datasource?.uid;
                  const targets = (panel.targets || []).slice(0, 3); // max 3 series

                  if (dsUid && targets.length > 0) {
                    const queryBody = {
                      queries: targets.map(t => ({
                        ...t,
                        datasource: { uid: dsUid },
                        maxDataPoints: 100,
                        intervalMs: range === '30d' ? 3600000 : 900000,
                      })),
                      from: String(fromMs),
                      to:   String(toMs),
                    };
                    const qRes = await fetch(`${baseGrafana}/api/ds/query`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                      body: JSON.stringify(queryBody),
                    });
                    if (qRes.ok) {
                      const qData = await qRes.json();
                      // Summarise numeric series into text (min/max/avg + recent trend)
                      const results = qData?.results || {};
                      const lines   = [];
                      for (const [key, result] of Object.entries(results)) {
                        const frames = result?.frames || [];
                        for (const frame of frames) {
                          const name   = frame?.schema?.name || key;
                          const fields = frame?.data?.values || [];
                          // fields[0] = timestamps, fields[1] = values
                          const vals = (fields[1] || []).filter(v => v != null);
                          if (vals.length === 0) continue;
                          const min  = Math.min(...vals).toFixed(2);
                          const max  = Math.max(...vals).toFixed(2);
                          const avg  = (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2);
                          const last5 = vals.slice(-5).map(v => v.toFixed(2)).join(', ');
                          const trend = vals.length > 10
                            ? (vals.slice(-5).reduce((s,v)=>s+v,0)/5) > (vals.slice(0,5).reduce((s,v)=>s+v,0)/5)
                              ? '↑ increasing' : '↓ decreasing'
                            : 'stable';
                          lines.push(`Series "${name}": min=${min} max=${max} avg=${avg} trend=${trend} recent=[${last5}]`);
                        }
                      }
                      seriesText = lines.join('\n');
                    }
                  }
                }
              }
            } catch {
              // Grafana unreachable (no VPN etc) — we'll note that in the prompt
            }

            const { default: Anthropic } = await import('@anthropic-ai/sdk');
            const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
            const prompt = seriesText
              ? `You are an on-call engineer analysing a Grafana panel for the alert: "${alertName}".
Panel: "${panelTitle}" | Time range: last ${range}

Metric data:
${seriesText}

In 4-6 bullet points:
• Summarise the current health trend
• Note any anomalies or spikes in the ${range} window
• Compare recent values to the overall average — is this alert value typical or unusual?
• Give 1-2 actionable observations for the on-call engineer
Keep each bullet under 20 words. No preamble.`
              : `The Grafana dashboard at ${dashboardUrl} could not be reached (likely requires VPN or internal network access).
Alert: "${alertName}", Panel: "${panelTitle || 'unknown'}".
Provide 2-3 general bullet points on what an on-call engineer should look for in a "${alertName}" dashboard. Keep it brief.`;

            const message = await anthropic.messages.create({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 400,
              messages: [{ role: 'user', content: prompt }],
            });

            const analysis = message.content[0]?.text || 'No analysis available.';
            const hasData  = !!seriesText;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ analysis, hasData, range }));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      },
    };
  }

  // ── Daily summary middleware ───────────────────────────────────────────────
  // GET /api/daily-summary?channelId=XXX
  // Fetches all Slack messages from 8AM–9PM today, parses alerts,
  // then asks Claude for a structured daily on-call summary.
  function dailySummaryMiddleware() {
    return {
      name: 'daily-summary',
      configureServer(server) {
        server.middlewares.use('/api/daily-summary', async (req, res) => {
          if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
          try {
            const channelId = new URL(req.url, 'http://localhost').searchParams.get('channelId');
            if (!channelId) throw new Error('channelId required');

            // Build oldest/latest for today 8AM–9PM in local time
            const now   = new Date();
            const start = new Date(now); start.setHours(8,  0, 0, 0);
            const end   = new Date(now); end.setHours(21, 0, 0, 0);
            // If before 8AM, use yesterday's window
            if (now < start) { start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1); }
            const oldest = (start.getTime() / 1000).toFixed(6);
            const latest = (Math.min(end.getTime(), Date.now()) / 1000).toFixed(6);

            // Paginate up to 1000 messages
            let allMessages = [];
            let cursor = null;
            while (true) {
              const params = new URLSearchParams({ channel: channelId, limit: '200', oldest, latest });
              if (cursor) params.set('cursor', cursor);
              const slackRes = await fetch(`https://slack.com/api/conversations.history?${params}`, {
                headers: { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`, Accept: 'application/json' },
              });
              const slackData = await slackRes.json();
              if (!slackData.ok) throw new Error(`Slack error: ${slackData.error}`);
              allMessages = allMessages.concat(slackData.messages || []);
              if (!slackData.has_more || !slackData.response_metadata?.next_cursor) break;
              cursor = slackData.response_metadata.next_cursor;
              if (allMessages.length >= 1000) break;
            }

            // Parse all alert messages
            const decode = s => (s||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
            const parsed = [];
            for (const msg of allMessages.reverse()) {
              const att = (msg.attachments || [])[0];
              if (!att) continue;
              const title    = decode(att.title || '');
              const fallback = decode(att.fallback || '');
              const bodyText = decode(att.text || '');
              const pm = title.match(/\*P([1-5])\*/);
              if (!pm) continue;
              const priority   = `P${pm[1]}`;
              const isResolved = /^\[RESOLVED/i.test(fallback);
              const tm = title.match(/\*P\d+\*\s+([A-Z0-9-]+)\s+-\s+(.+)/i);
              if (!tm) continue;
              const pop  = tm[1].trim();
              const rest = tm[2].trim();
              const ci   = rest.indexOf(':');
              const service   = ci > 0 ? rest.slice(0, ci).trim() : rest;
              const alertName = ci > 0 ? rest.slice(ci + 1).trim() : rest;
              const ts = parseFloat(msg.ts) * 1000;
              parsed.push({ priority, isResolved, pop, service, alertName, ts, bodyText });
            }

            // Correlate fire/resolve pairs
            const map = new Map();
            for (const p of parsed) {
              const key = `${p.priority}-${p.pop}-${p.service}-${p.alertName}`
                .toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
              if (p.isResolved) {
                const ex = map.get(key);
                if (ex) { map.set(key, { ...ex, resolvedAt: p.ts }); }
                else    { map.set(key, { ...p, firedAt: null, resolvedAt: p.ts, status: 'resolved' }); }
              } else {
                map.set(key, { ...p, firedAt: p.ts, status: 'firing' });
              }
            }
            const events = Array.from(map.values());
            const firing  = events.filter(e => e.status === 'firing');
            const resolved = events.filter(e => e.status !== 'firing');

            // Build structured text for Claude
            const fmt = ts => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '?';
            const dur = (f, r) => {
              if (!f || !r) return '';
              const s = Math.round((r - f) / 60000);
              return s < 60 ? `${s}m` : `${Math.floor(s/60)}h${s%60}m`;
            };

            const resolvedLines = resolved.map(e =>
              `[${e.priority}] ${e.pop} | ${e.service} | ${e.alertName} | fired ${fmt(e.firedAt)} resolved ${fmt(e.resolvedAt)} duration ${dur(e.firedAt, e.resolvedAt)}`
            ).join('\n') || 'None';

            const firingLines = firing.map(e =>
              `[${e.priority}] ${e.pop} | ${e.service} | ${e.alertName} | firing since ${fmt(e.firedAt)}`
            ).join('\n') || 'None';

            const windowStr = `${start.toLocaleDateString([], { weekday:'long', month:'short', day:'numeric' })} 8:00 AM – ${now < end ? now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '9:00 PM'}`;

            const prompt = `You are an on-call engineer writing a daily shift summary report.

Window: ${windowStr}
Total alert events: ${events.length} (${resolved.length} resolved, ${firing.length} still firing)

RESOLVED ALERTS:
${resolvedLines}

STILL FIRING:
${firingLines}

Write a structured daily summary with these sections:
1. **Shift Overview** — 2-3 sentences: overall health, busiest services/POPs, any patterns
2. **Still Firing** — brief note on each unresolved alert and urgency (or "None")
3. **Notable Events** — any alerts that took >30min to resolve, repeated alerts, or P1/P2s
4. **POPs / Services Most Affected** — top 3 with counts
5. **Recommendation** — 1-2 actionable items for the next shift

Be concise. Use bullet points within sections. No preamble.`;

            const { default: Anthropic } = await import('@anthropic-ai/sdk');
            const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
            const message = await anthropic.messages.create({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 800,
              messages: [{ role: 'user', content: prompt }],
            });

            const summary = message.content[0]?.text || 'No summary available.';
            const dateLabel = start.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              summary,
              dateLabel,
              windowStr,
              totalEvents: events.length,
              firingCount: firing.length,
              resolvedCount: resolved.length,
              generatedAt: new Date().toISOString(),
            }));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      },
    };
  }

  return {
    plugins: [react(), tailwindcss(), runbookSummaryMiddleware(), dashboardAnalysisMiddleware(), dailySummaryMiddleware()],
    server: {
      proxy: {
        '/api/jira': {
          target: env.JIRA_BASE_URL || 'https://placeholder.atlassian.net',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/jira/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (req) => {
              if (jiraAuth) req.setHeader('Authorization', `Basic ${jiraAuth}`);
              req.setHeader('Accept', 'application/json');
            });
          },
        },
        '/api/confluence': {
          target: confluenceTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/confluence/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (req) => {
              if (confluenceAuth) req.setHeader('Authorization', `Basic ${confluenceAuth}`);
              req.setHeader('Accept', 'application/json');
            });
          },
        },
        '/api/slack': {
          target: 'https://slack.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/slack/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (req) => {
              if (env.SLACK_BOT_TOKEN) req.setHeader('Authorization', `Bearer ${env.SLACK_BOT_TOKEN}`);
              req.setHeader('Accept', 'application/json');
            });
          },
        },
        '/api/atlassian-people': {
          target: 'https://api.atlassian.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/atlassian-people/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (req) => {
              if (jiraAuth) req.setHeader('Authorization', `Basic ${jiraAuth}`);
              req.setHeader('Accept', 'application/json');
            });
          },
        },
        '/api/github': {
          target: 'https://api.github.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/github/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (req) => {
              if (env.GITHUB_TOKEN) req.setHeader('Authorization', `Bearer ${env.GITHUB_TOKEN}`);
              req.setHeader('Accept', 'application/vnd.github+json');
              req.setHeader('X-GitHub-Api-Version', '2022-11-28');
            });
          },
        },
      },
    },
  };
});
