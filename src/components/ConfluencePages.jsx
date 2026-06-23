import { FileText } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Section } from './Section';
import { Pagination } from './Pagination';
import { usePagination } from '../hooks/usePagination';

function formatDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
}

export function ConfluencePages({ confluenceBaseUrl, sectionId }) {
  const { confluence } = useData();
  const { pages, loading, error, lastRefreshed, refresh } = confluence;
  const { page, totalPages, paginated, setPage } = usePagination(pages);

  return (
    <Section
      id={sectionId}
      title="Confluence Pages"
      icon={FileText}
      count={pages.length}
      loading={loading}
      error={error}
      lastRefreshed={lastRefreshed}
      onRefresh={refresh}
    >
      {pages.length === 0 && !loading ? (
        <p className="text-slate-500 text-sm px-5 py-4">No pages found.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-700">
                  <th className="text-left px-5 py-2 font-medium">Title</th>
                  <th className="text-left px-3 py-2 font-medium">Space</th>
                  <th className="text-right px-3 py-2 font-medium">Created</th>
                  <th className="text-right px-5 py-2 font-medium">Last Modified</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((page) => {
                  const space = page.space?.name || page.space?.key || '–';
                  const url = page._links?.webui
                    ? `${confluenceBaseUrl || ''}/wiki${page._links.webui}`
                    : '#';
                  return (
                    <tr key={page.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="px-5 py-3 max-w-xs">
                        <a href={url} target="_blank" rel="noreferrer"
                          className="text-blue-400 hover:text-blue-300 line-clamp-2">{page.title}</a>
                      </td>
                      <td className="px-3 py-3 text-slate-400 text-xs whitespace-nowrap">{space}</td>
                      <td className="px-3 py-3 text-right text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(page.history?.createdDate)}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(page.version?.when)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} total={pages.length} pageSize={10} onPageChange={setPage} />
        </>
      )}
    </Section>
  );
}
