import { useState, useMemo } from 'react';
import { GitPullRequest } from 'lucide-react';
import { useData } from '../context/DataContext';
import { extractRepo } from '../api/github';
import { Section } from './Section';
import { StatusBadge } from './StatusBadge';
import { Pagination } from './Pagination';
import { usePagination } from '../hooks/usePagination';

const TABS = ['Open', 'Merged', 'Closed', 'All'];

function formatDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
}

function prState(pr) {
  if (pr.pull_request?.merged_at) return 'merged';
  return pr.state;
}

export function GitHubPRs({ sectionId }) {
  const { github } = useData();
  const { prs, debug, loading, error, lastRefreshed, refresh } = github;
  const [tab, setTab] = useState('Open');

  const filtered = useMemo(() =>
    prs.filter((pr) => tab === 'All' ? true : prState(pr).toLowerCase() === tab.toLowerCase()),
    [prs, tab]
  );
  const { page, totalPages, paginated, setPage } = usePagination(filtered);

  const counts = {
    Open:   prs.filter((p) => prState(p) === 'open').length,
    Merged: prs.filter((p) => prState(p) === 'merged').length,
    Closed: prs.filter((p) => prState(p) === 'closed' && !p.pull_request?.merged_at).length,
    All:    prs.length,
  };

  return (
    <Section
      id={sectionId}
      title="GitHub Pull Requests"
      icon={GitPullRequest}
      count={prs.length}
      loading={loading}
      error={error}
      lastRefreshed={lastRefreshed}
      onRefresh={refresh}
    >
      <div className="flex gap-1 px-5 pt-3 pb-2 border-b border-slate-700">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-xs px-3 py-1.5 rounded transition-colors ${
              tab === t ? 'bg-slate-600 text-slate-100 font-medium' : 'text-slate-500 hover:text-slate-300'
            }`}>
            {t} <span className="ml-1 text-slate-500">{counts[t]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && !loading ? (
        <div className="px-5 py-4 text-sm space-y-1">
          <p className="text-slate-400">No PRs found.</p>
          {debug && (
            <div className="mt-2 p-3 bg-slate-900 rounded text-xs font-mono text-slate-400 space-y-1">
              <p>author: <span className="text-slate-200">{debug.username || '(not set)'}</span></p>
              <p>org filter: <span className="text-slate-200">{debug.org || '(none)'}</span></p>
              <p>total fetched: <span className="text-slate-200">{debug.totalFetched}</span></p>
              <p>repos seen: <span className="text-slate-200">{debug.sampleRepos.length ? debug.sampleRepos.join(', ') : '(none)'}</span></p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-700">
                  <th className="text-left px-5 py-2 font-medium">Title</th>
                  <th className="text-left px-3 py-2 font-medium">Repo</th>
                  <th className="text-left px-3 py-2 font-medium">State</th>
                  <th className="text-left px-3 py-2 font-medium">Reviews</th>
                  <th className="text-right px-5 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((pr) => {
                  const state = prState(pr);
                  const repo = extractRepo(pr.html_url);
                  return (
                    <tr key={pr.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="px-5 py-3 max-w-xs">
                        <a href={pr.html_url} target="_blank" rel="noreferrer"
                          className="text-blue-400 hover:text-blue-300 line-clamp-2">
                          #{pr.number} {pr.title}
                        </a>
                      </td>
                      <td className="px-3 py-3 text-slate-400 text-xs whitespace-nowrap">
                        <a href={`https://github.com/${repo}`} target="_blank" rel="noreferrer"
                          className="hover:text-slate-300 transition-colors">{repo}</a>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap"><StatusBadge value={state} /></td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {state === 'open'
                          ? <StatusBadge value={pr.reviewState} />
                          : <span className="text-slate-600 text-xs">–</span>}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(pr.created_at)}
                      </td>
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
