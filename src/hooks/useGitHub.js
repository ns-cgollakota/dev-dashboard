import { useState, useCallback } from 'react';
import { fetchMyPRs, fetchPRReviews, summariseReviewState } from '../api/github';

export function useGitHub(username, org) {
  const [prs, setPRs] = useState([]);
  const [debug, setDebug] = useState(null);   // { totalFetched, sampleRepos }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items, totalFetched, sampleRepos } = await fetchMyPRs(username, org);
      setDebug({ totalFetched, sampleRepos, org, username });

      const enriched = await Promise.all(
        items.slice(0, 50).map(async (pr) => {
          if (pr.state === 'open' && pr.pull_request?.url) {
            try {
              const reviews = await fetchPRReviews(pr.pull_request.url);
              return { ...pr, reviewState: summariseReviewState(reviews) };
            } catch {
              return { ...pr, reviewState: 'unknown' };
            }
          }
          return { ...pr, reviewState: pr.pull_request?.merged_at ? 'merged' : 'closed' };
        })
      );

      setPRs(enriched);
      setLastRefreshed(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [username, org]);

  return { prs, debug, loading, error, lastRefreshed, refresh };
}
