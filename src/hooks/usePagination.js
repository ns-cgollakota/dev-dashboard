import { useState, useEffect } from 'react';

export function usePagination(items, pageSize = 10) {
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever the item list changes (filter/tab switch)
  useEffect(() => { setPage(1); }, [items]);  // items reference changes on filter change

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const paginated  = items.slice((safePage - 1) * pageSize, safePage * pageSize);

  return { page: safePage, totalPages, paginated, setPage };
}
