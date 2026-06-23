import { useMemo, useState } from 'react';
import { GitPullRequest, Bug, Clock, Eye, MessageSquare, Zap, ExternalLink, X } from 'lucide-react';
import { useData } from '../context/DataContext';
import { extractRepo } from '../api/github';

const DAY = 1000 * 60 * 60 * 24;
const DISMISSED_KEY = 'dev-dashboard-action-dismissed';

const URGENCY = {
  high:   { bar: '#ef4444', bg: 'rgba(239,68,68,0.07)',    border: 'rgba(239,68,68,0.15)',    text: '#fca5a5' },
  medium: { bar: '#f59e0b', bg: 'rgba(245,158,11,0.07)',   border: 'rgba(245,158,11,0.15)',   text: '#fcd34d' },
  low:    { bar: '#475569', bg: 'rgba(71,85,105,0.07)',    border: 'rgba(71,85,105,0.15)',    text: '#94a3b8' },
};

const ICON_MAP = { GitPullRequest, Bug, Clock, Eye, MessageSquare, Zap };

function daysAgo(iso) {
  return (Date.now() - new Date(iso)) / DAY;
}

function loadDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')); }
  catch { return new Set(); }
}
function saveDismissed(set) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
}

function computeActionItems(issues, prs, jiraBaseUrl) {
  const items = [];

  prs.filter((pr) => pr.state === 'open').forEach((pr) => {
    const age  = daysAgo(pr.created_at);
    const repo = extractRepo(pr.html_url);
    if (pr.reviewState === 'changes_requested') {
      items.push({ id: `pr-feedback-${pr.id}`, urgency: 'high', icon: 'MessageSquare', title: 'Address review feedback', detail: `#${pr.number} · ${repo}`, link: pr.html_url, age });
    } else if ((pr.reviewState === 'none' || pr.reviewState === 'pending') && age > 2) {
      items.push({ id: `pr-review-${pr.id}`, urgency: age > 5 ? 'high' : 'medium', icon: 'GitPullRequest', title: 'Get PR reviewed', detail: `#${pr.number} · ${repo} · ${Math.floor(age)}d old`, link: pr.html_url, age });
    }
  });

  issues.forEach((issue) => {
    const f        = issue.fields || {};
    const status   = (f.status?.name || '').toLowerCase();
    const priority = (f.priority?.name || '').toLowerCase();
    const type     = (f.issuetype?.name || '').toLowerCase();
    const age      = daysAgo(f.updated);
    const link     = jiraBaseUrl ? `${jiraBaseUrl}/browse/${issue.key}` : '#';
    const summary  = f.summary?.slice(0, 50) || issue.key;

    if (['highest', 'high'].includes(priority) && type === 'bug' && !['done', 'closed'].includes(status) && age > 3) {
      items.push({ id: `jira-bug-${issue.id}`, urgency: 'high', icon: 'Bug', title: 'Follow up on bug', detail: `${issue.key} · ${summary}`, link, age });
    }
    if (status.includes('progress') && age > 5) {
      items.push({ id: `jira-stale-${issue.id}`, urgency: 'medium', icon: 'Clock', title: 'Stale in-progress item', detail: `${issue.key} · not updated for ${Math.floor(age)}d`, link, age });
    }
    if ((status.includes('review') || status.includes('code')) && age > 2) {
      items.push({ id: `jira-review-${issue.id}`, urgency: 'medium', icon: 'Eye', title: 'Follow up on review', detail: `${issue.key} · ${summary}`, link, age });
    }
  });

  const order = { high: 0, medium: 1, low: 2 };
  return items.sort((a, b) => order[a.urgency] - order[b.urgency] || b.age - a.age).slice(0, 20);
}

export function ActionItems({ jiraBaseUrl }) {
  const { jira, github } = useData();
  const [dismissed, setDismissed] = useState(loadDismissed);

  const allItems = useMemo(
    () => computeActionItems(jira.issues, github.prs, jiraBaseUrl),
    [jira.issues, github.prs, jiraBaseUrl]
  );

  const items = useMemo(
    () => allItems.filter(i => !dismissed.has(i.id)),
    [allItems, dismissed]
  );

  function dismiss(id, e) {
    e.preventDefault();
    e.stopPropagation();
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }

  const highCount = items.filter((i) => i.urgency === 'high').length;

  return (
    <div className="overflow-hidden rounded-xl" style={{
      background: 'rgba(13,20,36,0.8)',
      border: '1px solid rgba(148,163,184,0.08)',
      backdropFilter: 'blur(8px)',
    }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5" style={{
        borderBottom: '1px solid rgba(148,163,184,0.07)',
        background: 'rgba(245,158,11,0.04)',
      }}>
        <Zap size={15} style={{ color: '#fbbf24' }} />
        <span className="font-semibold text-slate-100 text-sm flex-1">Action Items</span>
        {items.length > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full tabular-nums" style={
            highCount > 0
              ? { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }
              : { background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.15)', color: '#94a3b8' }
          }>
            {items.length}
          </span>
        )}
      </div>

      {/* Items */}
      <div>
        {items.length === 0 && !jira.loading && !github.loading ? (
          <div className="px-4 py-8 text-center space-y-1">
            <p className="text-2xl">✅</p>
            <p className="text-slate-300 text-sm font-medium">All clear!</p>
            <p className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>No pending action items.</p>
          </div>
        ) : (jira.loading || github.loading) && items.length === 0 ? (
          <div className="px-4 py-4 text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>Loading…</div>
        ) : (
          items.map((item, idx) => {
            const Icon  = ICON_MAP[item.icon] || Zap;
            const style = URGENCY[item.urgency];
            return (
              <div
                key={item.id}
                className="flex items-start gap-3 px-4 py-3 transition-all duration-150 group cursor-pointer"
                style={{
                  borderBottom: idx < items.length - 1 ? '1px solid rgba(148,163,184,0.05)' : 'none',
                }}
                onClick={() => window.open(item.link, '_blank', 'noreferrer')}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(148,163,184,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Urgency bar */}
                <div className="w-0.5 self-stretch rounded-full shrink-0" style={{
                  background: style.bar,
                  boxShadow: `0 0 6px ${style.bar}60`,
                }} />

                <div className="p-1 rounded shrink-0 mt-0.5" style={{ background: style.bg }}>
                  <Icon size={12} style={{ color: style.text }} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-xs font-medium leading-snug">{item.title}</p>
                  <p className="text-xs truncate mt-0.5" style={{ color: 'rgba(148,163,184,0.45)' }}>
                    {item.detail}
                  </p>
                </div>

                {/* On hover: show X dismiss button. At rest: show external link indicator. */}
                <div className="shrink-0 mt-0.5 w-5 flex items-center justify-center">
                  <ExternalLink size={11} className="group-hover:hidden"
                    style={{ color: 'rgba(148,163,184,0.2)' }}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); dismiss(item.id, e); }}
                    title="Mark as read"
                    className="hidden group-hover:flex items-center justify-center p-0.5 rounded transition-all"
                    style={{ color: 'rgba(148,163,184,0.5)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#f1f5f9'; e.currentTarget.style.background = 'rgba(148,163,184,0.15)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(148,163,184,0.5)'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
