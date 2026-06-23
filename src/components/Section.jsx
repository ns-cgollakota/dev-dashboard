import { useState, useEffect } from 'react';
import { RefreshCw, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

function formatTime(date) {
  if (!date) return null;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function Section({
  id,
  title,
  icon: Icon,
  count,
  loading,
  error,
  lastRefreshed,
  onRefresh,
  children,
  defaultOpen = true,
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (count > 0) setOpen(true);
  }, [count]);

  return (
    <div id={id} className="overflow-hidden rounded-xl" style={{
      background: 'rgba(13,20,36,0.8)',
      border: '1px solid rgba(148,163,184,0.08)',
      backdropFilter: 'blur(8px)',
    }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none transition-colors duration-150 group"
        style={{ borderBottom: open ? '1px solid rgba(148,163,184,0.07)' : 'none' }}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(148,163,184,0.04)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {Icon && (
          <div className="p-1.5 rounded-lg shrink-0" style={{ background: 'rgba(148,163,184,0.08)' }}>
            <Icon size={15} style={{ color: 'rgba(148,163,184,0.7)' }} />
          </div>
        )}
        <span className="font-semibold text-slate-100 flex-1 text-sm">{title}</span>

        {count != null && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full tabular-nums" style={{
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.25)',
            color: '#a5b4fc',
            minWidth: 24,
            textAlign: 'center',
          }}>
            {count}
          </span>
        )}

        {lastRefreshed && (
          <span className="text-xs hidden sm:block" style={{ color: 'rgba(148,163,184,0.35)' }}>
            {formatTime(lastRefreshed)}
          </span>
        )}

        <button
          className="p-1.5 rounded-lg transition-all duration-150"
          style={{ color: 'rgba(148,163,184,0.5)' }}
          onClick={(e) => { e.stopPropagation(); onRefresh(); }}
          title="Refresh"
          disabled={loading}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(148,163,184,0.1)'; e.currentTarget.style.color = '#e2e8f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(148,163,184,0.5)'; }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>

        <div style={{ color: 'rgba(148,163,184,0.3)' }}>
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </div>

      {/* Body */}
      {open && (
        <div>
          {error ? (
            <div className="flex items-start gap-3 p-5 text-red-400">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Failed to load</p>
                <p className="text-xs text-red-500/70 mt-1 font-mono break-all">{error}</p>
                <button
                  className="mt-3 text-xs px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.1)', color: '#e2e8f0' }}
                  onClick={onRefresh}
                >
                  Retry
                </button>
              </div>
            </div>
          ) : loading && count === 0 ? (
            <div className="flex items-center gap-2.5 p-5 text-sm" style={{ color: 'rgba(148,163,184,0.4)' }}>
              <RefreshCw size={13} className="animate-spin" />
              Loading…
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}
