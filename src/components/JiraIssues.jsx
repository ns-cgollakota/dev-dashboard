import { useState, useMemo } from 'react';
import { Ticket } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Section } from './Section';
import { StatusBadge } from './StatusBadge';
import { Pagination } from './Pagination';
import { usePagination } from '../hooks/usePagination';

function getFixVersions(fields) {
  const versions = fields?.fixVersions;
  if (!Array.isArray(versions) || versions.length === 0) return null;
  return versions.map((v) => v.name).join(', ');
}

function getStoryPoints(fields) {
  return fields?.customfield_10016 ?? fields?.customfield_10028 ?? null;
}

function getSprint(fields) {
  const sprints = fields?.customfield_10020;
  if (!Array.isArray(sprints) || sprints.length === 0) return null;
  const active = sprints.find((s) => s.state === 'active') || sprints[sprints.length - 1];
  return active?.name ?? null;
}

function formatDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
}

const TYPE_ICONS = { Bug: '🐛', Story: '📖', Task: '✅', Epic: '⚡', 'Sub-task': '↳' };

export function JiraIssues({ jiraBaseUrl, sectionId }) {
  const { jira } = useData();
  const { issues, loading, error, lastRefreshed, refresh } = jira;
  const [filter, setFilter] = useState('All');

  const statusFilters = useMemo(() => {
    const seen = new Set();
    issues.forEach((i) => { const n = i.fields?.status?.name; if (n) seen.add(n); });
    return ['All', ...Array.from(seen).sort()];
  }, [issues]);

  const filtered = useMemo(() =>
    issues.filter((i) => filter === 'All' ? true : i.fields?.status?.name === filter),
    [issues, filter]
  );
  const { page, totalPages, paginated, setPage } = usePagination(filtered);

  return (
    <Section
      id={sectionId}
      title="Jira Issues"
      icon={Ticket}
      count={issues.length}
      loading={loading}
      error={error}
      lastRefreshed={lastRefreshed}
      onRefresh={refresh}
    >
      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2 px-5 pt-3 pb-2">
        {statusFilters.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              filter === f
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
            }`}>
            {f}
            {f !== 'All' && (
              <span className="ml-1 opacity-60">
                {issues.filter((i) => i.fields?.status?.name === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 && !loading ? (
        <p className="text-slate-500 text-sm px-5 py-4">No issues found.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-2 font-medium">Key</th>
                  <th className="text-left px-3 py-2 font-medium">Summary</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Priority</th>
                  <th className="text-left px-3 py-2 font-medium">Sprint</th>
                  <th className="text-left px-3 py-2 font-medium">Fix Version</th>
                  <th className="text-right px-3 py-2 font-medium">SP</th>
                  <th className="text-right px-5 py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((issue) => {
                  const f = issue.fields || {};
                  const url = jiraBaseUrl ? `${jiraBaseUrl}/browse/${issue.key}` : '#';
                  return (
                    <tr key={issue.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <a href={url} target="_blank" rel="noreferrer"
                          className="text-blue-400 hover:text-blue-300 font-mono text-xs font-semibold">
                          {TYPE_ICONS[f.issuetype?.name] || '📋'} {issue.key}
                        </a>
                      </td>
                      <td className="px-3 py-3 max-w-xs">
                        <span className="text-slate-200 line-clamp-2">{f.summary}</span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap"><StatusBadge value={f.status?.name} /></td>
                      <td className="px-3 py-3 whitespace-nowrap"><StatusBadge value={f.priority?.name} /></td>
                      <td className="px-3 py-3 text-slate-400 text-xs max-w-[120px] truncate">{getSprint(f) || '–'}</td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">
                        {getFixVersions(f)
                          ? <span className="px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#86efac' }}>{getFixVersions(f)}</span>
                          : <span className="text-slate-600">–</span>
                        }
                      </td>
                      <td className="px-3 py-3 text-right text-slate-300 font-mono text-xs">{getStoryPoints(f) ?? '–'}</td>
                      <td className="px-5 py-3 text-right text-slate-500 text-xs whitespace-nowrap">{formatDate(f.updated)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={10} onPageChange={setPage} />
        </>
      )}
    </Section>
  );
}
