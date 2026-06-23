import { useState, useCallback } from 'react';
import { fetchMyPages } from '../api/confluence';

export function useConfluence() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyPages();
      setPages(data);
      setLastRefreshed(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { pages, loading, error, lastRefreshed, refresh };
}
