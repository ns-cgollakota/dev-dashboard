import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bell, RefreshCw, BookOpen, BarChart2, CheckCircle2,
  AlertTriangle, Clock, Trash2, ChevronRight, Wifi, WifiOff,
  PauseCircle, PlayCircle, ChevronDown, ChevronUp, Loader2, Sparkles,
  FileText, TrendingUp,
} from 'lucide-react';
import { useAlerts } from '../context/AlertContext';

// ── Priority styling ──────────────────────────────────────────────────────────
const PRIORITY_STYLE = {
  P1: { bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.4)',   text: '#fca5a5', glow: '0 0 16px rgba(239,68,68,0.25)',   dot: '#ef4444' },
  P2: { bg: 'rgba(249,115,22,0.15)',  border: 'rgba(249,115,22,0.4)',  text: '#fdba74', glow: '0 0 16px rgba(249,115,22,0.2)',   dot: '#f97316' },
  P3: { bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.35)',  text: '#fde047', glow: '0 0 16px rgba(234,179,8,0.15)',   dot: '#eab308' },
  P4: { bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.3)',  text: '#a5b4fc', glow: '0 0 16px rgba(99,102,241,0.12)', dot: '#6366f1' },
  P5: { bg: 'rgba(71,85,105,0.15)',   border: 'rgba(71,85,105,0.3)',   text: '#94a3b8', glow: 'none',                           dot: '#475569' },
};
function pStyle(p) { return PRIORITY_STYLE[p] || PRIORITY_STYLE.P5; }

// ── Time helpers ──────────────────────────────────────────────────────────────
function useAge(date) {
  const [age, setAge] = useState('');
  useEffect(() => {
    if (!date) return;
    const update = () => {
      const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
      if (diff < 60)       setAge(`${diff}s ago`);
      else if (diff < 3600) setAge(`${Math.floor(diff / 60)}m ago`);
      else                  setAge(`${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m ago`);
    };
    update();
    const id = setInterval(update, 15000);
    return () => clearInterval(id);
  }, [date]);
  return age;
}

function formatTime(d) {
  if (!d) return '–';
  return new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function duration(fired, resolved) {
  if (!fired || !resolved) return '–';
  const s = Math.floor((new Date(resolved) - new Date(fired)) / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

// ── Runbook button + AI insights accordion ────────────────────────────────────
function RunbookInsights({ url }) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error,   setError]   = useState(null);

  const fetchSummary = useCallback(async () => {
    if (summary || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/runbook-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch summary');
      setSummary(data.summary);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [url, summary, loading]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !summary && !loading) fetchSummary();
  }

  if (!url) return null;

  return (
    <div className="w-full">
      {/* Row: Runbook link + expand toggle */}
      <div className="flex items-center gap-1">
        <a href={url} target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.25)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,92,246,0.15)'}
        >
          <BookOpen size={12} /> Runbook
        </a>
        <button
          onClick={toggle}
          title={open ? 'Hide AI summary' : 'Show AI action summary'}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={open
            ? { background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', color: '#c4b5fd' }
            : { background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: 'rgba(196,181,253,0.5)' }
          }
          onMouseEnter={e => { e.currentTarget.style.color = '#c4b5fd'; e.currentTarget.style.background = 'rgba(139,92,246,0.2)'; }}
          onMouseLeave={e => { if (!open) { e.currentTarget.style.color = 'rgba(196,181,253,0.5)'; e.currentTarget.style.background = 'rgba(139,92,246,0.08)'; }}}
        >
          <Sparkles size={11} />
          {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {/* Expandable AI summary panel */}
      {open && (
        <div className="mt-2 rounded-lg overflow-hidden" style={{
          background: 'rgba(139,92,246,0.07)',
          border: '1px solid rgba(139,92,246,0.2)',
        }}>
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(139,92,246,0.15)' }}>
            <Sparkles size={11} style={{ color: '#c4b5fd' }} />
            <span className="text-xs font-semibold" style={{ color: '#c4b5fd' }}>AI Action Summary</span>
            <span className="text-xs ml-auto" style={{ color: 'rgba(196,181,253,0.4)' }}>from runbook</span>
          </div>
          <div className="px-3 py-3">
            {loading && (
              <div className="flex items-center gap-2" style={{ color: 'rgba(196,181,253,0.5)' }}>
                <Loader2 size={12} className="animate-spin" />
                <span className="text-xs">Reading runbook…</span>
              </div>
            )}
            {error && (
              <p className="text-xs" style={{ color: '#fca5a5' }}>⚠ {error}</p>
            )}
            {summary && (
              <div className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(226,232,240,0.85)' }}>
                {summary}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dashboard analysis panel ──────────────────────────────────────────────────
function DashboardAnalysis({ url, alertName }) {
  const [open,     setOpen]     = useState(false);
  const [range,    setRange]    = useState('7d');
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);  // { analysis, hasData, range }
  const [error,    setError]    = useState(null);

  function withRange(baseUrl, from) {
    try {
      const u = new URL(baseUrl);
      u.searchParams.set('from', from);
      u.searchParams.set('to', 'now');
      return u.toString();
    } catch { return baseUrl; }
  }

  const fetchAnalysis = useCallback(async (r) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/dashboard-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboardUrl: url, range: r, alertName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [url, alertName]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !result && !loading) fetchAnalysis(range);
  }

  function switchRange(r) {
    setRange(r);
    fetchAnalysis(r);
  }

  if (!url) return null;

  const RANGES = ['1h', '7d', '30d'];

  return (
    <div className="w-full">
      {/* Row: open-in-browser links + analyse toggle */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <BarChart2 size={12} style={{ color: 'rgba(125,211,252,0.45)' }} />
        {RANGES.map(r => (
          <a key={r}
            href={withRange(url, `now-${r}`)}
            target="_blank" rel="noreferrer"
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', color: '#7dd3fc' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(14,165,233,0.22)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(14,165,233,0.1)'; }}
          >{r}</a>
        ))}
        {/* AI analyse button */}
        <button
          onClick={toggle}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={open
            ? { background: 'rgba(14,165,233,0.2)', border: '1px solid rgba(14,165,233,0.4)', color: '#7dd3fc' }
            : { background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.18)', color: 'rgba(125,211,252,0.5)' }
          }
          onMouseEnter={e => { e.currentTarget.style.color = '#7dd3fc'; e.currentTarget.style.background = 'rgba(14,165,233,0.18)'; }}
          onMouseLeave={e => { if (!open) { e.currentTarget.style.color = 'rgba(125,211,252,0.5)'; e.currentTarget.style.background = 'rgba(14,165,233,0.07)'; }}}
        >
          <Sparkles size={11} /> Analyse {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {/* Expandable analysis panel */}
      {open && (
        <div className="mt-2 rounded-lg overflow-hidden" style={{
          background: 'rgba(14,165,233,0.06)',
          border: '1px solid rgba(14,165,233,0.2)',
        }}>
          {/* Header + range selector */}
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(14,165,233,0.15)' }}>
            <Sparkles size={11} style={{ color: '#7dd3fc' }} />
            <span className="text-xs font-semibold" style={{ color: '#7dd3fc' }}>Dashboard Analysis</span>
            <div className="flex items-center gap-1 ml-auto">
              {['7d', '30d'].map(r => (
                <button key={r} onClick={() => switchRange(r)}
                  className="px-2 py-0.5 rounded text-xs transition-all"
                  style={range === r && result?.range === r
                    ? { background: 'rgba(14,165,233,0.3)', color: '#7dd3fc', border: '1px solid rgba(14,165,233,0.4)' }
                    : { color: 'rgba(125,211,252,0.4)', border: '1px solid transparent' }
                  }
                >{r}</button>
              ))}
            </div>
          </div>

          <div className="px-3 py-3">
            {loading && (
              <div className="flex items-center gap-2" style={{ color: 'rgba(125,211,252,0.5)' }}>
                <Loader2 size={12} className="animate-spin" />
                <span className="text-xs">Fetching metrics & analysing…</span>
              </div>
            )}
            {error && <p className="text-xs" style={{ color: '#fca5a5' }}>⚠ {error}</p>}
            {result && !loading && (
              <>
                {!result.hasData && (
                  <p className="text-xs mb-2 px-2 py-1 rounded" style={{ background: 'rgba(245,158,11,0.1)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.2)' }}>
                    ⚠ Live metrics unavailable (Grafana may require VPN). Showing general guidance.
                  </p>
                )}
                <div className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(226,232,240,0.85)' }}>
                  {result.analysis}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Single firing alert card ──────────────────────────────────────────────────
function AlertCard({ alert, onMarkResolved }) {
  const age      = useAge(alert.firedAt);
  const ps       = pStyle(alert.priority);
  const ageMs    = alert.firedAt ? Date.now() - new Date(alert.firedAt).getTime() : 0;
  const isStale  = ageMs > 10 * 60 * 1000; // > 10 min

  return (
    <div className="rounded-xl overflow-hidden transition-all" style={{
      background: ps.bg,
      border: `1px solid ${ps.border}`,
      boxShadow: ps.glow,
    }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3" style={{
        borderBottom: `1px solid ${ps.border}`,
        background: 'rgba(0,0,0,0.15)',
      }}>
        {/* Priority badge */}
        <span className="text-xs font-black px-2.5 py-0.5 rounded-full shrink-0" style={{
          background: ps.dot + '33',
          border: `1px solid ${ps.dot}66`,
          color: ps.text,
          boxShadow: `0 0 8px ${ps.dot}40`,
        }}>
          {alert.priority}
        </span>

        <span className="text-xs font-mono font-bold shrink-0" style={{ color: ps.text }}>{alert.pop}</span>
        <ChevronRight size={12} style={{ color: ps.text, opacity: 0.5 }} className="shrink-0" />
        {alert.service !== alert.alertName && (
          <>
            <span className="text-slate-300 text-xs font-medium shrink-0">{alert.service}</span>
            <ChevronRight size={12} className="text-slate-600 shrink-0" />
          </>
        )}
        <span className="text-slate-200 text-xs flex-1 truncate">{alert.alertName}</span>

        <span className="text-xs shrink-0 flex items-center gap-1" style={{ color: 'rgba(148,163,184,0.5)' }}>
          <Clock size={11} />
          {age}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Value + dashboard row */}
        <div className="flex items-center gap-3 flex-wrap">
          {alert.lastValue && (
            <span className="text-xs px-2.5 py-1 rounded-lg font-mono" style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(148,163,184,0.1)',
              color: ps.text,
            }}>
              {parseFloat(alert.lastValue).toLocaleString()} {alert.unit || ''}
            </span>
          )}
          <DashboardAnalysis url={alert.dashboardUrl} alertName={alert.alertName} />
        </div>

        {/* Runbook + AI insights */}
        <RunbookInsights url={alert.runbookUrl} />

        {/* Action Required banner */}
        {isStale && (
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg" style={{
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.3)',
          }}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} style={{ color: '#fbbf24' }} />
              <span className="text-xs font-semibold" style={{ color: '#fde68a' }}>
                Action Required — firing for {age}
              </span>
            </div>
            <button
              onClick={() => onMarkResolved(alert.alertKey)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
              style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.35)', color: '#86efac' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.35)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(34,197,94,0.2)'}
            >
              <CheckCircle2 size={13} /> Mark Resolved
            </button>
          </div>
        )}

        {/* Non-stale resolve button */}
        {!isStale && (
          <div className="flex justify-end">
            <button
              onClick={() => onMarkResolved(alert.alertKey)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
              style={{ color: 'rgba(148,163,184,0.4)', border: '1px solid rgba(148,163,184,0.1)' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#86efac'; e.currentTarget.style.borderColor = 'rgba(34,197,94,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(148,163,184,0.4)'; e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)'; }}
            >
              <CheckCircle2 size={12} /> Mark Resolved
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Active tab ────────────────────────────────────────────────────────────────
function ActiveTab({ alerts, onMarkResolved }) {
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="text-4xl">✅</div>
        <p className="text-slate-300 font-medium">All clear!</p>
        <p className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>No active alerts in #dp-oncall</p>
      </div>
    );
  }

  const now = Date.now();
  const stale = alerts.filter(a => a.firedAt && now - new Date(a.firedAt).getTime() > 10 * 60 * 1000);
  const fresh = alerts.filter(a => a.firedAt && now - new Date(a.firedAt).getTime() <= 10 * 60 * 1000);

  const [staleOpen, setStaleOpen] = useState(true);
  const [freshOpen, setFreshOpen] = useState(true);

  return (
    <div className="space-y-4">
      {stale.length > 0 && (
        <div>
          {/* Action Required header — clickable to collapse */}
          <button
            onClick={() => setStaleOpen(v => !v)}
            className="flex items-center gap-2 mb-3 w-full text-left group"
          >
            <AlertTriangle size={13} style={{ color: '#fbbf24' }} />
            <p className="text-xs font-semibold uppercase tracking-widest flex-1" style={{ color: 'rgba(245,158,11,0.7)' }}>
              Action Required ({stale.length})
            </p>
            {staleOpen
              ? <ChevronUp   size={13} style={{ color: 'rgba(245,158,11,0.5)' }} />
              : <ChevronDown size={13} style={{ color: 'rgba(245,158,11,0.5)' }} />
            }
          </button>
          {staleOpen && (
            <div className="space-y-3">
              {stale.map(a => <AlertCard key={a.alertKey} alert={a} onMarkResolved={onMarkResolved} />)}
            </div>
          )}
        </div>
      )}

      {fresh.length > 0 && (
        <div className={stale.length > 0 ? 'mt-5' : ''}>
          {/* Recent header — clickable to collapse */}
          <button
            onClick={() => setFreshOpen(v => !v)}
            className="flex items-center gap-2 mb-3 w-full text-left group"
          >
            <Bell size={13} className="text-slate-400 shrink-0" />
            <p className="text-xs font-semibold uppercase tracking-widest flex-1 text-slate-500">
              Recent ({fresh.length})
            </p>
            {freshOpen
              ? <ChevronUp   size={13} className="text-slate-600" />
              : <ChevronDown size={13} className="text-slate-600" />
            }
          </button>
          {freshOpen && (
            <div className="space-y-3">
              {fresh.map(a => <AlertCard key={a.alertKey} alert={a} onMarkResolved={onMarkResolved} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Countdown to auto-removal ─────────────────────────────────────────────────
function ExpiryCountdown({ resolvedAt }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const update = () => {
      if (!resolvedAt) { setLabel(''); return; }
      const expiresAt = new Date(resolvedAt).getTime() + 2 * 60 * 60 * 1000;
      const remaining = Math.max(0, expiresAt - Date.now());
      const m = Math.floor(remaining / 60000);
      const h = Math.floor(m / 60);
      setLabel(h > 0 ? `~${h}h ${m % 60}m` : `~${m}m`);
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [resolvedAt]);
  if (!label) return null;
  return (
    <span className="text-xs" style={{ color: 'rgba(148,163,184,0.25)' }} title="Auto-removed after 2h">
      ⏱ {label}
    </span>
  );
}

// ── History tab ───────────────────────────────────────────────────────────────
function HistoryTab({ alerts, onClear }) {
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="text-4xl">📭</div>
        <p className="text-slate-400 text-sm">No resolved alerts.</p>
        <p className="text-xs" style={{ color: 'rgba(148,163,184,0.35)' }}>Resolved alerts appear here and are removed after 2 hours.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs" style={{ color: 'rgba(148,163,184,0.35)' }}>
          Resolved alerts are automatically removed 2 hours after resolution.
        </p>
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all shrink-0"
          style={{ color: 'rgba(148,163,184,0.4)', border: '1px solid rgba(148,163,184,0.1)' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fca5a5'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(148,163,184,0.4)'; e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)'; }}
        >
          <Trash2 size={12} /> Clear
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(148,163,184,0.07)' }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.07)', background: 'rgba(0,0,0,0.2)' }}>
              {['Priority', 'POP', 'Service', 'Alert', 'Fired', 'Resolved', 'Duration', 'Source', 'Expires'].map(h => (
                <th key={h} className="text-left px-4 py-3 font-semibold uppercase tracking-wider"
                  style={{ color: 'rgba(148,163,184,0.45)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alerts.map((a, i) => {
              const ps = pStyle(a.priority);
              return (
                <tr key={a.alertKey + i}
                  style={{ borderBottom: i < alerts.length - 1 ? '1px solid rgba(148,163,184,0.05)' : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full font-bold text-xs" style={{
                      background: ps.dot + '22', color: ps.text, border: `1px solid ${ps.dot}44`,
                    }}>{a.priority}</span>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold" style={{ color: ps.text }}>{a.pop}</td>
                  <td className="px-4 py-3 text-slate-300">{a.service}</td>
                  <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{a.alertName}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatTime(a.firedAt)}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatTime(a.resolvedAt)}</td>
                  <td className="px-4 py-3 font-mono" style={{ color: 'rgba(34,197,94,0.7)' }}>
                    {duration(a.firedAt, a.resolvedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs" style={
                      a.manuallyResolved
                        ? { background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }
                        : { background: 'rgba(34,197,94,0.12)', color: '#86efac', border: '1px solid rgba(34,197,94,0.2)' }
                    }>
                      {a.manuallyResolved ? 'manual' : 'auto'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ExpiryCountdown resolvedAt={a.resolvedAt} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Summary tab ───────────────────────────────────────────────────────────────
const CHANNEL_ID = import.meta.env.VITE_SLACK_CHANNEL_ID || '';

function SummaryTab() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const fetchedRef = useRef(false);

  const fetch_ = useCallback(async () => {
    if (!CHANNEL_ID) { setError('VITE_SLACK_CHANNEL_ID not configured'); return; }
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/daily-summary?channelId=${CHANNEL_ID}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on first render
  useEffect(() => {
    if (!fetchedRef.current) { fetchedRef.current = true; fetch_(); }
  }, [fetch_]);

  // Render markdown-ish text: bold **text**, bullet lines
  function renderSummary(text) {
    return text.split('\n').map((line, i) => {
      // Section headers: **Title**
      const headerMatch = line.match(/^\*\*(.+)\*\*/);
      if (headerMatch) {
        return (
          <p key={i} className="text-sm font-bold mt-4 mb-1.5 first:mt-0" style={{ color: '#e2e8f0' }}>
            {headerMatch[1]}
          </p>
        );
      }
      // Bullet lines
      if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
        const content = line.trim().replace(/^[•\-]\s*/, '');
        return (
          <div key={i} className="flex gap-2 text-xs leading-relaxed mb-1" style={{ color: 'rgba(226,232,240,0.8)' }}>
            <span style={{ color: 'rgba(148,163,184,0.4)', flexShrink: 0 }}>•</span>
            <span>{content}</span>
          </div>
        );
      }
      // Numbered lines
      const numMatch = line.match(/^(\d+)\.\s+(.+)/);
      if (numMatch) {
        return (
          <div key={i} className="flex gap-2 text-xs leading-relaxed mb-1" style={{ color: 'rgba(226,232,240,0.8)' }}>
            <span className="font-bold shrink-0" style={{ color: 'rgba(148,163,184,0.5)', minWidth: 14 }}>{numMatch[1]}.</span>
            <span>{numMatch[2]}</span>
          </div>
        );
      }
      if (!line.trim()) return <div key={i} className="h-1" />;
      return <p key={i} className="text-xs leading-relaxed mb-1" style={{ color: 'rgba(226,232,240,0.75)' }}>{line}</p>;
    });
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <FileText size={14} style={{ color: '#a5b4fc' }} />
          <span className="text-sm font-semibold text-slate-200">Daily Shift Summary</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc' }}>
            8:00 AM – 9:00 PM
          </span>
        </div>
        {data && (
          <span className="text-xs" style={{ color: 'rgba(148,163,184,0.35)' }}>
            Generated {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button
          onClick={fetch_}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
          style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.22)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.12)'}
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Analysing…' : 'Regenerate'}
        </button>
      </div>

      {/* Loading state */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={24} className="animate-spin" style={{ color: '#a5b4fc' }} />
          <p className="text-sm text-slate-400">Fetching 8AM–9PM alerts and analysing…</p>
          <p className="text-xs" style={{ color: 'rgba(148,163,184,0.35)' }}>This may take a few seconds</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl px-5 py-4 flex items-start gap-3" style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
        }}>
          <AlertTriangle size={14} style={{ color: '#fca5a5' }} className="shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-400">Summary failed</p>
            <p className="text-xs mt-0.5 font-mono" style={{ color: 'rgba(252,165,165,0.6)' }}>{error}</p>
            {error.includes('ANTHROPIC') && (
              <p className="text-xs mt-1" style={{ color: 'rgba(148,163,184,0.5)' }}>
                Set <code className="px-1 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>ANTHROPIC_API_KEY</code> in .env and restart the dev server.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Summary content */}
      {data && !loading && (
        <>
          {/* Stat strip */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Events',   value: data.totalEvents,   color: '#a5b4fc', bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.2)' },
              { label: 'Resolved',        value: data.resolvedCount, color: '#86efac', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)' },
              { label: 'Still Firing',    value: data.firingCount,   color: data.firingCount > 0 ? '#fca5a5' : '#86efac', bg: data.firingCount > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border: data.firingCount > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)' },
            ].map(s => (
              <div key={s.label} className="rounded-xl px-4 py-3 text-center" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.5)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* AI summary */}
          <div className="rounded-xl overflow-hidden" style={{
            background: 'rgba(99,102,241,0.05)',
            border: '1px solid rgba(99,102,241,0.15)',
          }}>
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(99,102,241,0.1)', background: 'rgba(99,102,241,0.08)' }}>
              <Sparkles size={13} style={{ color: '#a5b4fc' }} />
              <span className="text-xs font-semibold" style={{ color: '#a5b4fc' }}>AI Analysis — {data.dateLabel}</span>
              <span className="text-xs ml-auto" style={{ color: 'rgba(148,163,184,0.3)' }}>{data.windowStr}</span>
            </div>
            <div className="px-5 py-4">
              {renderSummary(data.summary)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function OnCallPage() {
  const { firing, resolved, loading, error, lastRefreshed, paused, refresh, pause, resume, markResolved, clearHistory, configured } = useAlerts();
  const [tab, setTab] = useState('active');

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <div className="p-2.5 rounded-xl" style={{
          background: 'linear-gradient(135deg, #ef4444, #f97316)',
          boxShadow: '0 0 20px rgba(239,68,68,0.3)',
        }}>
          <Bell size={18} className="text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-100">#dp-oncall Monitor</h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.5)' }}>
            Polling Slack every 60s
            {lastRefreshed && ` · last updated ${lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
          </p>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{
          background: configured ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
          border: `1px solid ${configured ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
        }}>
          {configured
            ? <Wifi size={12} style={{ color: '#4ade80' }} />
            : <WifiOff size={12} style={{ color: '#fbbf24' }} />
          }
          <span className="text-xs" style={{ color: configured ? '#4ade80' : '#fde68a' }}>
            {configured ? 'Connected' : 'Not configured'}
          </span>
        </div>

        {/* Pause / Resume toggle */}
        <button
          onClick={paused ? resume : pause}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={paused ? {
            background: 'rgba(34,197,94,0.15)',
            border: '1px solid rgba(34,197,94,0.3)',
            color: '#86efac',
          } : {
            background: 'rgba(148,163,184,0.08)',
            border: '1px solid rgba(148,163,184,0.15)',
            color: 'rgba(148,163,184,0.6)',
          }}
          onMouseEnter={e => { if (!paused) e.currentTarget.style.color = '#fca5a5'; }}
          onMouseLeave={e => { if (!paused) e.currentTarget.style.color = 'rgba(148,163,184,0.6)'; }}
        >
          {paused ? <><PlayCircle size={13} /> Resume</> : <><PauseCircle size={13} /> Pause</>}
        </button>

        <button
          onClick={refresh}
          disabled={loading || paused}
          className="p-2 rounded-lg transition-all"
          style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.1)', color: paused ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.6)' }}
          onMouseEnter={e => { if (!paused) e.currentTarget.style.color = '#e2e8f0'; }}
          onMouseLeave={e => { if (!paused) e.currentTarget.style.color = 'rgba(148,163,184,0.6)'; }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Not configured banner */}
      {!configured && (
        <div className="rounded-xl px-5 py-4" style={{
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.2)',
        }}>
          <p className="text-sm font-semibold" style={{ color: '#fde68a' }}>Slack not configured</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(245,158,11,0.6)' }}>
            Add <code className="px-1 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>SLACK_BOT_TOKEN</code> and{' '}
            <code className="px-1 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>VITE_SLACK_CHANNEL_ID</code> to{' '}
            <code className="px-1 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>.env</code>, then restart{' '}
            <code className="px-1 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>npm run dev</code>.
            Bot needs <strong>channels:history</strong> + <strong>channels:read</strong> scopes.
          </p>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="rounded-xl px-5 py-4 flex items-start gap-3" style={{
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
        }}>
          <AlertTriangle size={15} style={{ color: '#fca5a5' }} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">Failed to load alerts</p>
            <p className="text-xs text-red-500/60 mt-0.5 font-mono">{error}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="rounded-xl overflow-hidden" style={{
        background: 'rgba(13,20,36,0.8)',
        border: '1px solid rgba(148,163,184,0.08)',
        backdropFilter: 'blur(8px)',
      }}>
        {/* Tab bar */}
        <div className="flex" style={{ borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
          {[
            { id: 'active',  label: 'Active Alerts', count: firing.length,   urgent: firing.some(a => a.firedAt && Date.now() - new Date(a.firedAt).getTime() > 10*60*1000) },
            { id: 'history', label: 'History',        count: resolved.length, urgent: false },
            { id: 'summary', label: 'Day Summary',    count: 0,               urgent: false },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all relative"
              style={tab === t.id ? {
                color: '#e2e8f0',
                borderBottom: '2px solid #3b82f6',
                marginBottom: -1,
              } : { color: 'rgba(148,163,184,0.5)' }}
            >
              {t.label}
              {t.count > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={
                  t.urgent
                    ? { background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }
                    : tab === t.id
                      ? { background: 'rgba(59,130,246,0.2)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' }
                      : { background: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.15)' }
                }>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">
          {tab === 'active'  && <ActiveTab  alerts={firing}   onMarkResolved={markResolved} />}
          {tab === 'history' && <HistoryTab alerts={resolved} onClear={clearHistory} />}
          {tab === 'summary' && <SummaryTab />}
        </div>
      </div>
    </div>
  );
}
