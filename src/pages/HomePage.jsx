import { useMemo, useState, useEffect } from 'react';
import {
  Ticket, GitPullRequest, FileText, StickyNote,
  ArrowUpRight, AlertCircle, Quote, Bell, Clock,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useData } from '../context/DataContext';
import { useAlerts } from '../context/AlertContext';
import { ActionItems } from '../components/ActionItems';

const STORAGE_KEY = 'dev-dashboard-notes';
function notesCount() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').length; }
  catch { return 0; }
}

const QUOTES = [
  { text: "The best way to predict the future is to invent it.", author: "Alan Kay" },
  { text: "First, solve the problem. Then, write the code.", author: "John Johnson" },
  { text: "Make it work, make it right, make it fast.", author: "Kent Beck" },
  { text: "Simplicity is the soul of efficiency.", author: "Austin Freeman" },
  { text: "Code is like humor. When you have to explain it, it's bad.", author: "Cory House" },
  { text: "Good code is its own best documentation.", author: "Steve McConnell" },
  { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
  { text: "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.", author: "Martin Fowler" },
  { text: "Programs must be written for people to read, and only incidentally for machines to execute.", author: "Harold Abelson" },
  { text: "Debugging is twice as hard as writing the code in the first place.", author: "Brian Kernighan" },
];

export function statusColor(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('progress'))                                    return '#3b82f6';
  if (n.includes('review') || n.includes('code'))               return '#8b5cf6';
  if (n === 'done' || n === 'closed' || n.includes('complete')) return '#22c55e';
  if (n === 'blocked')                                           return '#ef4444';
  return '#475569';
}

const CARD_CONFIG = [
  {
    id: 'jira',
    Icon: Ticket,
    label: 'Jira Issues',
    gradient: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.22)',
    hoverBorder: 'rgba(99,102,241,0.5)',
    glow: '0 0 24px rgba(59,130,246,0.18)',
    textColor: '#93c5fd',
  },
  {
    id: 'github-prs',
    Icon: GitPullRequest,
    label: 'Open Pull Requests',
    gradient: 'linear-gradient(135deg, #22c55e, #10b981)',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.22)',
    hoverBorder: 'rgba(34,197,94,0.5)',
    glow: '0 0 24px rgba(34,197,94,0.18)',
    textColor: '#86efac',
  },
  {
    id: 'confluence',
    Icon: FileText,
    label: 'Confluence Pages',
    gradient: 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
    bg: 'rgba(14,165,233,0.08)',
    border: 'rgba(14,165,233,0.22)',
    hoverBorder: 'rgba(6,182,212,0.5)',
    glow: '0 0 24px rgba(14,165,233,0.18)',
    textColor: '#7dd3fc',
  },
  {
    id: 'notes',
    Icon: StickyNote,
    label: 'Notes',
    gradient: 'linear-gradient(135deg, #f59e0b, #eab308)',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(234,179,8,0.22)',
    hoverBorder: 'rgba(245,158,11,0.5)',
    glow: '0 0 24px rgba(245,158,11,0.18)',
    textColor: '#fde68a',
  },
  {
    id: 'oncall',
    Icon: Bell,
    label: 'Active Alerts',
    gradient: 'linear-gradient(135deg, #ef4444, #f97316)',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.22)',
    hoverBorder: 'rgba(239,68,68,0.5)',
    glow: '0 0 24px rgba(239,68,68,0.2)',
    textColor: '#fca5a5',
  },
];

// ── Tooltip ──────────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value, payload: inner } = payload[0];
  // Recharts puts `percent` on the inner payload (sector data), not on the top-level entry
  const percent = inner?.percent;
  const pctStr = (typeof percent === 'number' && !isNaN(percent))
    ? (percent * 100).toFixed(0)
    : null;
  return (
    <div className="px-3 py-2 text-xs shadow-2xl rounded-lg" style={{
      background: '#0d1424',
      border: '1px solid rgba(148,163,184,0.15)',
    }}>
      <p className="text-slate-100 font-semibold">{name}</p>
      <p className="text-slate-400 mt-0.5">{value} issues{pctStr ? ` · ${pctStr}%` : ''}</p>
    </div>
  );
};

// ── Welcome banner ────────────────────────────────────────────────────────────
// Drop anything that looks like a system/permission group rather than a real team
const JIRA_NOISE = /jira|users?|admin|access|addon|project|default|all-|license|global|member|site-|org-|trust-|atlassian|gsuite|system|app-/i;

function pickTeamName(groups = []) {
  return groups
    .map(g => g.name || g)
    .filter(n => n.length > 2 && !JIRA_NOISE.test(n))
    .sort((a, b) => a.length - b.length)
    [0] || null;
}

// Curated picsum seeds that reliably produce beautiful natural landscapes
const SCENIC_SEEDS = [15, 28, 43, 67, 82, 119, 134, 156, 190, 218, 244, 270, 301, 333, 366, 398, 421, 453, 487, 512];

const ATLASSIAN_ACCOUNT_ID = import.meta.env.VITE_CONFLUENCE_ACCOUNT_ID || '';

function WelcomeBanner({ githubUsername, displayName, fallbackDesignation }) {
  const [avatar,      setAvatar]      = useState(null);
  const [designation, setDesignation] = useState(fallbackDesignation || null);
  const [department,  setDepartment]  = useState(null);
  const [team,        setTeam]        = useState(null);

  // New random quote and scenic image on every render/refresh
  const [quote]     = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [imgSeed]   = useState(() => SCENIC_SEEDS[Math.floor(Math.random() * SCENIC_SEEDS.length)]);
  const scenicUrl   = `https://picsum.photos/seed/${imgSeed}/1600/420`;

  useEffect(() => {
    // GitHub: avatar only
    if (githubUsername) {
      fetch(`/api/github/users/${githubUsername}`)
        .then(r => r.json())
        .then(d => { if (d?.avatar_url) setAvatar(d.avatar_url); })
        .catch(() => {});
    }

    // Jira myself: groups → team name (jobTitle here is often empty on cloud)
    fetch('/api/jira/rest/api/3/myself?expand=groups')
      .then(r => r.json())
      .then(d => {
        if (d?.jobTitle) setDesignation(d.jobTitle.trim());
        const picked = pickTeamName(d?.groups?.items || []);
        if (picked) setTeam(picked);
      })
      .catch(() => {});

    // Atlassian People API: authoritative source for jobTitle + department
    if (ATLASSIAN_ACCOUNT_ID) {
      fetch(`/api/atlassian-people/people/1.0/person/${ATLASSIAN_ACCOUNT_ID}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d) return;
          if (d?.jobTitle)   setDesignation(d.jobTitle.trim());
          if (d?.department) setDepartment(d.department.trim());
        })
        .catch(() => {});
    }
  }, [githubUsername]);

  const now       = new Date();
  const h         = now.getHours();
  const emoji     = h < 5 ? '🌙' : h < 12 ? '☀️' : h < 17 ? '🌤️' : h < 21 ? '🌆' : '🌃';
  const greet     = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Working late';
  const fullName  = displayName || githubUsername;
  const firstName = fullName.split(' ')[0];
  const dateStr   = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="relative overflow-hidden rounded-2xl mb-1" style={{
      border: '1px solid rgba(99,102,241,0.2)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
      minHeight: 180,
    }}>
      {/* Scenic background image */}
      <div className="absolute inset-0" style={{
        backgroundImage: `url(${scenicUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'brightness(0.45) saturate(1.2)',
      }} />

      {/* Gradient overlay: dark on left (readable text), fades to scenic on right */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(105deg, rgba(8,13,26,0.97) 0%, rgba(8,13,26,0.82) 40%, rgba(8,13,26,0.45) 70%, rgba(8,13,26,0.15) 100%)',
      }} />

      {/* Bottom gradient for depth */}
      <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none" style={{
        background: 'linear-gradient(to top, rgba(8,13,26,0.6), transparent)',
      }} />

      {/* Content */}
      <div className="relative flex items-center gap-5 p-6">
        {/* Avatar */}
        {avatar ? (
          <img src={avatar} alt={fullName} className="w-16 h-16 rounded-full shrink-0" style={{
            border: '2px solid rgba(255,255,255,0.25)',
            boxShadow: '0 0 24px rgba(0,0,0,0.5)',
          }} />
        ) : (
          <div className="w-16 h-16 rounded-full shrink-0 flex items-center justify-center text-2xl font-black" style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            boxShadow: '0 0 24px rgba(99,102,241,0.4)',
          }}>
            {(firstName?.[0] || 'U').toUpperCase()}
          </div>
        )}

        {/* Greeting + info */}
        <div className="flex-1 min-w-0">
          <p className="text-slate-300 text-sm mb-0.5 drop-shadow">{emoji} {greet},</p>
          <h1 className="text-3xl font-black tracking-tight drop-shadow-lg" style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #bfdbfe 50%, #ddd6fe 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {fullName}
          </h1>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {designation && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium backdrop-blur-sm" style={{
                background: 'rgba(99,102,241,0.3)',
                border: '1px solid rgba(165,180,252,0.3)',
                color: '#e0e7ff',
              }}>
                {designation}
              </span>
            )}
            {department && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium backdrop-blur-sm" style={{
                background: 'rgba(139,92,246,0.25)',
                border: '1px solid rgba(196,181,253,0.3)',
                color: '#ede9fe',
              }}>
                {department}
              </span>
            )}
            {team && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium backdrop-blur-sm" style={{
                background: 'rgba(6,182,212,0.25)',
                border: '1px solid rgba(103,232,249,0.3)',
                color: '#cffafe',
              }}>
                {team}
              </span>
            )}
          </div>

          <p className="text-slate-400 text-xs mt-1.5 drop-shadow">{dateStr}</p>
        </div>

        {/* Quote panel — frosted glass over the scenic part */}
        <div className="hidden lg:flex flex-col gap-2 max-w-xs p-4 rounded-xl shrink-0" style={{
          background: 'rgba(8,13,26,0.55)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        }}>
          <Quote size={14} style={{ color: 'rgba(165,180,252,0.7)' }} />
          <p className="text-slate-200 text-xs italic leading-relaxed">"{quote.text}"</p>
          <p className="text-slate-400 text-xs">— {quote.author}</p>
        </div>
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ cfg, value, sub, loading, onClick }) {
  const [hovered, setHovered] = useState(false);
  const { Icon, label, gradient, bg, border, hoverBorder, glow, textColor } = cfg;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative text-left w-full rounded-xl p-5 overflow-hidden transition-all duration-200"
      style={{
        background: bg,
        border: `1px solid ${hovered ? hoverBorder : border}`,
        boxShadow: hovered ? glow : 'none',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
      }}
    >
      {/* Hover shimmer */}
      <div className="absolute inset-0 transition-opacity duration-200 pointer-events-none" style={{
        background: `radial-gradient(ellipse at 30% 20%, ${border.replace('0.22', '0.35')}, transparent 60%)`,
        opacity: hovered ? 1 : 0,
      }} />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="p-2.5 rounded-xl shrink-0" style={{
            background: gradient,
            boxShadow: hovered ? `0 0 16px ${border.replace('0.22', '0.6')}` : 'none',
          }}>
            <Icon size={17} className="text-white" />
          </div>
          <ArrowUpRight size={14} className="mt-1 transition-colors duration-200"
            style={{ color: hovered ? textColor : 'rgba(148,163,184,0.3)' }}
          />
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="h-8 w-14 rounded-lg animate-pulse" style={{ background: 'rgba(148,163,184,0.1)' }} />
          ) : (
            <p className="text-3xl font-black tabular-nums transition-colors duration-200"
              style={{ color: hovered ? textColor : '#f1f5f9' }}>
              {value}
            </p>
          )}
          <p className="text-slate-400 text-sm mt-1 font-medium">{label}</p>
          {sub && <p className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.45)' }}>{sub}</p>}
        </div>
      </div>
    </button>
  );
}

// ── Critical issues ───────────────────────────────────────────────────────────
function CriticalIssues({ issues, jiraBaseUrl }) {
  const critical = issues
    .filter((i) => {
      const p = (i.fields?.priority?.name || '').toLowerCase();
      const s = (i.fields?.status?.name || '').toLowerCase();
      return (p === 'highest' || p === 'high') && s !== 'done' && s !== 'closed';
    })
    .slice(0, 5);

  if (critical.length === 0) return null;

  return (
    <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(148,163,184,0.08)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-red-500" style={{ boxShadow: '0 0 6px rgba(239,68,68,0.6)' }} />
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.5)' }}>
          Critical / High Priority
        </p>
      </div>
      <ul className="space-y-1.5">
        {critical.map((issue) => {
          const f   = issue.fields || {};
          const url = jiraBaseUrl ? `${jiraBaseUrl}/browse/${issue.key}` : '#';
          return (
            <li key={issue.id}>
              <a href={url} target="_blank" rel="noreferrer"
                className="flex items-start gap-2.5 p-2.5 rounded-lg transition-all duration-150 group"
                style={{
                  background: 'rgba(239,68,68,0.05)',
                  border: '1px solid rgba(239,68,68,0.12)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(239,68,68,0.05)';
                  e.currentTarget.style.borderColor = 'rgba(239,68,68,0.12)';
                }}
              >
                <span className="font-mono text-xs font-bold shrink-0 mt-0.5" style={{ color: '#f87171' }}>
                  {issue.key}
                </span>
                <span className="text-slate-300 text-xs line-clamp-1">{f.summary}</span>
                <AlertCircle size={11} className="text-red-500 shrink-0 mt-0.5 ml-auto opacity-60 group-hover:opacity-100" />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── HomePage ──────────────────────────────────────────────────────────────────
// ── Active alerts mini-widget on home ────────────────────────────────────────
const PRIORITY_DOT = { P1: '#ef4444', P2: '#f97316', P3: '#eab308', P4: '#6366f1', P5: '#475569' };

function ActiveAlertsWidget({ alerts, onNavigate }) {
  const top3 = alerts.slice(0, 3);
  if (top3.length === 0) return null;

  return (
    <div className="rounded-xl overflow-hidden" style={{
      background: 'rgba(239,68,68,0.06)',
      border: '1px solid rgba(239,68,68,0.18)',
    }}>
      <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: '1px solid rgba(239,68,68,0.1)' }}>
        <Bell size={13} style={{ color: '#fca5a5' }} />
        <span className="text-sm font-semibold text-slate-200 flex-1">Active On-Call Alerts</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{
          background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5',
        }}>{alerts.length}</span>
        <button onClick={() => onNavigate('oncall')}
          className="text-xs flex items-center gap-1 transition-colors"
          style={{ color: 'rgba(148,163,184,0.5)' }}
          onMouseEnter={e => e.currentTarget.style.color = '#fca5a5'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(148,163,184,0.5)'}
        >
          View all <ArrowUpRight size={11} />
        </button>
      </div>
      <div className="divide-y" style={{ borderColor: 'rgba(239,68,68,0.07)' }}>
        {top3.map(alert => {
          const ageMs = alert.firedAt ? Date.now() - new Date(alert.firedAt).getTime() : 0;
          const ageMin = Math.floor(ageMs / 60000);
          const dot = PRIORITY_DOT[alert.priority] || '#475569';
          return (
            <div key={alert.alertKey} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot, boxShadow: `0 0 6px ${dot}80` }} />
              <span className="text-xs font-bold shrink-0" style={{ color: dot }}>{alert.priority}</span>
              <span className="text-xs font-mono shrink-0 text-slate-400">{alert.pop}</span>
              <span className="text-xs text-slate-300 flex-1 truncate">{alert.alertName}</span>
              <span className="text-xs shrink-0 flex items-center gap-1" style={{ color: ageMin > 20 ? '#fbbf24' : 'rgba(148,163,184,0.4)' }}>
                <Clock size={10} />
                {ageMin > 0 ? `${ageMin}m` : 'just now'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HomePage({ onNavigate, jiraBaseUrl, githubUsername, displayName, fallbackDesignation }) {
  const { jira, github, confluence } = useData();
  const { firing, needsAction: alertNeedsAction, loading: alertLoading } = useAlerts();

  const openPRs     = github.prs.filter((p) => p.state === 'open');
  const needsAction = github.prs.filter((p) => p.state === 'open' && p.reviewState === 'changes_requested');
  const noReview    = github.prs.filter((p) => p.state === 'open' && (p.reviewState === 'none' || p.reviewState === 'pending'));
  const inProgress  = jira.issues.filter((i) => (i.fields?.status?.name || '').toLowerCase().includes('progress'));

  const { chartData, chartTotal } = useMemo(() => {
    const counts = {};
    jira.issues.forEach((i) => {
      const n = i.fields?.status?.name || 'Unknown';
      counts[n] = (counts[n] || 0) + 1;
    });
    const data = Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const total = data.reduce((s, e) => s + e.value, 0);
    return { chartData: data, chartTotal: total };
  }, [jira.issues]);

  const alertSub = alertNeedsAction.length > 0
    ? `${alertNeedsAction.length} need action`
    : firing.length > 0 ? 'monitoring' : 'all clear';

  const cardValues = {
    jira:          { value: jira.issues.length,     loading: jira.loading,       sub: inProgress.length ? `${inProgress.length} in progress` : null },
    'github-prs':  { value: openPRs.length,          loading: github.loading,     sub: needsAction.length ? `${needsAction.length} need attention` : noReview.length ? `${noReview.length} awaiting review` : 'All good' },
    confluence:    { value: confluence.pages.length,  loading: confluence.loading, sub: 'authored by you' },
    notes:         { value: notesCount(),             loading: false,              sub: 'saved locally' },
    oncall:        { value: firing.length,            loading: alertLoading,       sub: alertSub },
  };

  return (
    <div className="space-y-5">
      <WelcomeBanner githubUsername={githubUsername} displayName={displayName} fallbackDesignation={fallbackDesignation} />

      {/* Stat cards — 5 across (2 col on mobile, 5 on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {CARD_CONFIG.map((cfg) => (
          <StatCard
            key={cfg.id}
            cfg={cfg}
            {...cardValues[cfg.id]}
            onClick={() => onNavigate(cfg.id)}
          />
        ))}
      </div>

      {/* Main content row */}
      <div className="flex gap-5 items-start">

        {/* Left: Jira breakdown */}
        <div className="flex-1 min-w-0 rounded-xl p-5" style={{
          background: 'rgba(13,20,36,0.7)',
          border: '1px solid rgba(148,163,184,0.07)',
          backdropFilter: 'blur(8px)',
        }}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #3b82f6, #8b5cf6)' }} />
            <p className="text-sm font-semibold text-slate-200">Jira Issue Breakdown</p>
            {jira.issues.length > 0 && (
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-mono" style={{
                background: 'rgba(59,130,246,0.12)',
                border: '1px solid rgba(59,130,246,0.2)',
                color: '#93c5fd',
              }}>
                {jira.issues.length} total
              </span>
            )}
          </div>

          {jira.loading && chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-600 text-sm">Loading…</div>
          ) : chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-600 text-sm">No data</div>
          ) : (
            <div className="flex gap-6 items-center">
              {/* Donut */}
              <div className="shrink-0" style={{ width: 200, height: 190 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {chartData.map((e) => (
                        <Cell key={e.name} fill={statusColor(e.name)} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="flex flex-col gap-2.5 flex-1">
                {chartData.map((e) => {
                  const pct   = chartTotal > 0 ? ((e.value / chartTotal) * 100).toFixed(0) : '0';
                  const color = statusColor(e.name);
                  const w     = chartTotal > 0 ? Math.max(4, (e.value / chartTotal) * 100) : 4;
                  return (
                    <div key={e.name} className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{
                          background: color,
                          boxShadow: `0 0 6px ${color}80`,
                        }} />
                        <span className="text-slate-300 flex-1 truncate">{e.name}</span>
                        <span className="text-slate-400 font-mono tabular-nums">{e.value}</span>
                        <span className="w-8 text-right font-mono tabular-nums" style={{ color: 'rgba(148,163,184,0.4)' }}>
                          {pct}%
                        </span>
                      </div>
                      {/* Mini progress bar */}
                      <div className="h-0.5 rounded-full w-full" style={{ background: 'rgba(148,163,184,0.08)' }}>
                        <div className="h-full rounded-full transition-all" style={{
                          width: `${w}%`,
                          background: color,
                          opacity: 0.6,
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <CriticalIssues issues={jira.issues} jiraBaseUrl={jiraBaseUrl} />
        </div>

        {/* Right: Action items + active alerts */}
        <div className="w-72 shrink-0 space-y-4">
          {firing.length > 0 && (
            <ActiveAlertsWidget alerts={firing} onNavigate={onNavigate} />
          )}
          <ActionItems jiraBaseUrl={jiraBaseUrl} />
        </div>
      </div>
    </div>
  );
}
