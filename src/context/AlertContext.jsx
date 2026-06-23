import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { fetchChannelAlerts } from '../api/slack';

const STORAGE_KEY   = 'dp-oncall-alerts';
const POLL_INTERVAL = 60_000; // 60 seconds
const CHANNEL_ID    = import.meta.env.VITE_SLACK_CHANNEL_ID || '';

const AlertContext = createContext(null);
export const useAlerts = () => useContext(AlertContext);

// ── localStorage helpers ──────────────────────────────────────────────────────
function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
function saveOverrides(o) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
}

// ── Merge Slack data with local overrides (manual resolutions) ────────────────
function mergeWithOverrides(slackAlerts, overrides) {
  return slackAlerts.map(alert => {
    const ov = overrides[alert.alertKey];
    if (!ov || !ov.manuallyResolved) return alert;

    // If the alert re-fired AFTER it was manually resolved, ignore the override —
    // the new firing event supersedes the manual resolution.
    const resolvedAt = new Date(ov.resolvedAt).getTime();
    const firedAt    = alert.firedAt ? new Date(alert.firedAt).getTime() : 0;
    if (firedAt > resolvedAt) return alert; // new fire — show as firing

    return {
      ...alert,
      status:           'resolved',
      resolvedAt:       new Date(ov.resolvedAt),
      manuallyResolved: true,
      resolvedBy:       ov.resolvedBy || null,
    };
  });
}

const PAUSED_KEY = 'dp-oncall-paused';

export function AlertProvider({ children }) {
  const [alerts,        setAlerts]     = useState([]);
  const [loading,       setLoading]    = useState(false);
  const [error,         setError]      = useState(null);
  const [lastRefreshed, setRefreshed]  = useState(null);
  const [paused,        setPaused]     = useState(
    () => localStorage.getItem(PAUSED_KEY) === 'true'
  );
  const overridesRef  = useRef(loadOverrides());
  const pausedRef     = useRef(paused);  // stable ref for interval callback

  // Keep ref in sync
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const refresh = useCallback(async () => {
    if (pausedRef.current) return;
    if (!CHANNEL_ID || CHANNEL_ID === 'your-dp-oncall-channel-id') {
      setError('VITE_SLACK_CHANNEL_ID not configured in .env');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchChannelAlerts(CHANNEL_ID);

      setAlerts(prev => {
        // Build a map from previous state so we don't lose alerts that
        // fired > 2h ago or scrolled out of the Slack history window.
        const prevMap = new Map(prev.map(a => [a.alertKey, a]));

        // Apply incoming alerts on top — new data wins, but preserve the
        // earliest firedAt so repeated Alertmanager notifications don't
        // reset the "Action Required" timer back to zero.
        for (const a of raw) {
          const prev = prevMap.get(a.alertKey);
          if (a.status === 'firing' && prev?.status === 'firing' && prev.firedAt) {
            const prevTs = new Date(prev.firedAt).getTime();
            const newTs  = a.firedAt ? new Date(a.firedAt).getTime() : Infinity;
            prevMap.set(a.alertKey, { ...a, firedAt: prevTs < newTs ? prev.firedAt : a.firedAt });
          } else {
            prevMap.set(a.alertKey, a);
          }
        }

        // Drop resolved alerts older than 2 hours (clean up stale history)
        const cutoff = Date.now() - 2 * 60 * 60 * 1000;
        const merged = Array.from(prevMap.values()).filter(a => {
          if (a.status === 'resolved') {
            const t = a.resolvedAt ? new Date(a.resolvedAt).getTime() : 0;
            return t > cutoff;
          }
          return true; // always keep firing alerts
        });

        return mergeWithOverrides(merged, overridesRef.current);
      });

      setRefreshed(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const pause = useCallback(() => {
    setPaused(true);
    localStorage.setItem(PAUSED_KEY, 'true');
  }, []);

  const resume = useCallback(() => {
    setPaused(false);
    localStorage.setItem(PAUSED_KEY, 'false');
    // Fetch immediately on resume
    setTimeout(refresh, 0);
  }, [refresh]);

  // Initial fetch + poll
  useEffect(() => {
    if (!paused) refresh();
    const id = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [refresh]); // eslint-disable-line

  // Every 60s: evict resolved alerts older than 2h from state (live cleanup)
  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = Date.now() - 2 * 60 * 60 * 1000;
      setAlerts(prev => {
        const next = prev.filter(a => {
          if (a.status !== 'resolved') return true;
          const t = a.resolvedAt ? new Date(a.resolvedAt).getTime() : 0;
          return t > cutoff;
        });
        return next.length === prev.length ? prev : next; // avoid re-render if nothing changed
      });
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Mark an alert manually resolved
  const markResolved = useCallback((alertKey) => {
    const now = new Date().toISOString();
    overridesRef.current = {
      ...overridesRef.current,
      [alertKey]: { manuallyResolved: true, resolvedAt: now, resolvedBy: 'manual' },
    };
    saveOverrides(overridesRef.current);

    setAlerts(prev => prev.map(a =>
      a.alertKey === alertKey
        ? { ...a, status: 'resolved', resolvedAt: new Date(now), manuallyResolved: true, resolvedBy: 'manual' }
        : a
    ));
  }, []);

  // Clear history (remove all resolved from view + clear their overrides)
  const clearHistory = useCallback(() => {
    setAlerts(prev => {
      const removed = prev.filter(a => a.status === 'resolved');
      // Remove overrides for cleared alerts so they don't reappear on next poll
      if (removed.length > 0) {
        const next = { ...overridesRef.current };
        removed.forEach(a => delete next[a.alertKey]);
        overridesRef.current = next;
        saveOverrides(next);
      }
      return prev.filter(a => a.status === 'firing');
    });
  }, []);

  const firing   = alerts.filter(a => a.status === 'firing');
  const resolved = alerts.filter(a => a.status === 'resolved');
  const needsAction = firing.filter(a =>
    a.firedAt && (Date.now() - new Date(a.firedAt).getTime()) > 10 * 60 * 1000
  );

  return (
    <AlertContext.Provider value={{
      alerts,
      firing,
      resolved,
      needsAction,
      loading,
      error,
      lastRefreshed,
      paused,
      refresh,
      pause,
      resume,
      markResolved,
      clearHistory,
      configured: !!CHANNEL_ID && CHANNEL_ID !== 'your-dp-oncall-channel-id',
    }}>
      {children}
    </AlertContext.Provider>
  );
}
