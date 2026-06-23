// Generic colour-coded badge for statuses, priorities, and states

const PALETTE = {
  // Jira statuses
  'to do':          'bg-slate-700 text-slate-200',
  'in progress':    'bg-blue-900 text-blue-200',
  'in review':      'bg-violet-900 text-violet-200',
  'done':           'bg-green-900 text-green-200',
  'closed':         'bg-green-900 text-green-200',
  'blocked':        'bg-red-900 text-red-200',

  // Jira priorities
  'highest':        'bg-red-800 text-red-100',
  'high':           'bg-orange-800 text-orange-100',
  'medium':         'bg-yellow-800 text-yellow-100',
  'low':            'bg-slate-700 text-slate-200',
  'lowest':         'bg-slate-800 text-slate-300',

  // GitHub PR states
  'open':           'bg-green-900 text-green-200',
  'merged':         'bg-purple-900 text-purple-200',

  // Review states
  'approved':       'bg-green-900 text-green-200',
  'changes_requested': 'bg-red-900 text-red-200',
  'commented':      'bg-yellow-900 text-yellow-200',
  'pending':        'bg-slate-700 text-slate-200',
  'none':           'bg-slate-800 text-slate-400',
  'unknown':        'bg-slate-800 text-slate-400',
};

const LABELS = {
  changes_requested: 'Changes Requested',
  none: 'No Reviews',
  unknown: '?',
};

export function StatusBadge({ value, className = '' }) {
  const key = (value || '').toLowerCase();
  const colours = PALETTE[key] || 'bg-slate-700 text-slate-300';
  const label = LABELS[key] || value || '–';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${colours} ${className}`}
    >
      {label}
    </span>
  );
}
