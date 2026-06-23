import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ page, totalPages, total, pageSize, onPageChange }) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  // Show at most 5 page numbers around current page
  const pages = [];
  const delta = 2;
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-700 text-xs text-slate-500">
      <span>{from}–{to} of {total}</span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={14} />
        </button>

        {pages[0] > 1 && (
          <>
            <button onClick={() => onPageChange(1)} className="w-6 h-6 rounded hover:bg-slate-700 transition-colors">1</button>
            {pages[0] > 2 && <span className="px-1">…</span>}
          </>
        )}

        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`w-6 h-6 rounded transition-colors ${
              p === page ? 'bg-blue-600 text-white' : 'hover:bg-slate-700'
            }`}
          >
            {p}
          </button>
        ))}

        {pages[pages.length - 1] < totalPages && (
          <>
            {pages[pages.length - 1] < totalPages - 1 && <span className="px-1">…</span>}
            <button onClick={() => onPageChange(totalPages)} className="w-6 h-6 rounded hover:bg-slate-700 transition-colors">
              {totalPages}
            </button>
          </>
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
