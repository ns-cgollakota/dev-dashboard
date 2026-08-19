import { useState, useEffect } from 'react';
import {
  Grid2x2, Plus, X, Trash2, GripVertical, FileText,
  Eye, Pencil, CheckCircle2, Circle,
} from 'lucide-react';

const STORAGE_KEY = 'dev-dashboard-tracker-tasks';

function loadTasks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

const QUADRANTS = [
  { id: 'do',        label: 'Do First',  sub: 'Urgent & Important',      color: '#ef4444', bg: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.18)',  text: '#fca5a5' },
  { id: 'schedule',  label: 'Schedule',  sub: 'Important, Not Urgent',   color: '#3b82f6', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.18)', text: '#93c5fd' },
  { id: 'delegate',  label: 'Delegate',  sub: 'Urgent, Not Important',   color: '#8b5cf6', bg: 'rgba(139,92,246,0.06)', border: 'rgba(139,92,246,0.18)', text: '#c4b5fd' },
  { id: 'eliminate', label: 'Eliminate', sub: 'Neither Urgent nor Important', color: '#64748b', bg: 'rgba(100,116,139,0.06)', border: 'rgba(100,116,139,0.18)', text: '#94a3b8' },
];

// ── Minimal markdown → HTML (headings, bold/italic, code, links, lists) ──────
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function renderMarkdown(md) {
  if (!md?.trim()) return '<p class="md-empty">Nothing here yet.</p>';
  let html = escapeHtml(md);
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  html = html.replace(/(^|\n)((?:- .*(?:\n|$))+)/g, (_, lead, block) => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^- /, '')}</li>`).join('');
    return `${lead}<ul>${items}</ul>`;
  });
  html = html.split(/\n{2,}/).map(p =>
    /^<(h1|h2|h3|ul|pre)/.test(p.trim()) ? p : `<p>${p.replace(/\n/g, '<br/>')}</p>`
  ).join('');
  return html;
}

function quadrantOf(id) { return QUADRANTS.find(q => q.id === id) || QUADRANTS[0]; }

// ── Task detail / edit modal ─────────────────────────────────────────────────
function TaskModal({ task, isNew, onSave, onDelete, onClose }) {
  const [title,   setTitle]   = useState(task.title);
  const [notes,   setNotes]   = useState(task.notes || '');
  const [quadrant, setQuadrant] = useState(task.quadrant);
  const [mode,    setMode]    = useState('write');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const q = quadrantOf(quadrant);

  function save() {
    const text = title.trim();
    if (!text) return;
    onSave({ ...task, title: text, notes, quadrant });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(3,6,14,0.7)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden max-h-[85vh] flex flex-col"
        style={{ background: '#0d1424', border: '1px solid rgba(148,163,184,0.12)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: q.color, boxShadow: `0 0 8px ${q.color}80` }} />
          <span className="font-semibold text-slate-100 text-sm">{isNew ? 'New task' : 'Edit task'}</span>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(148,163,184,0.5)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(148,163,184,0.1)'; e.currentTarget.style.color = '#e2e8f0'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(148,163,184,0.5)'; }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <input
            autoFocus value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Task title…"
            className="w-full text-sm font-medium"
            style={{
              background: 'rgba(8,13,26,0.6)', border: '1px solid rgba(99,102,241,0.35)',
              borderRadius: 8, color: '#e2e8f0', outline: 'none', padding: '10px 12px',
            }}
          />

          {/* Quadrant picker */}
          <div>
            <p className="text-xs mb-1.5" style={{ color: 'rgba(148,163,184,0.45)' }}>Quadrant</p>
            <div className="grid grid-cols-2 gap-2">
              {QUADRANTS.map(opt => (
                <button key={opt.id} onClick={() => setQuadrant(opt.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all"
                  style={quadrant === opt.id
                    ? { background: opt.bg, border: `1px solid ${opt.border}`, color: opt.text }
                    : { border: '1px solid rgba(148,163,184,0.1)', color: 'rgba(148,163,184,0.5)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: opt.color }} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes / markdown */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs" style={{ color: 'rgba(148,163,184,0.45)' }}>Notes</p>
              <div className="flex items-center gap-0.5">
                <button onClick={() => setMode('write')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all"
                  style={mode === 'write'
                    ? { background: 'rgba(99,102,241,0.18)', color: '#a5b4fc' }
                    : { color: 'rgba(148,163,184,0.4)' }}
                >
                  <Pencil size={11} /> Write
                </button>
                <button onClick={() => setMode('preview')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all"
                  style={mode === 'preview'
                    ? { background: 'rgba(99,102,241,0.18)', color: '#a5b4fc' }
                    : { color: 'rgba(148,163,184,0.4)' }}
                >
                  <Eye size={11} /> Preview
                </button>
              </div>
            </div>

            {mode === 'write' ? (
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Write details, a doc, or markdown notes… supports # headings, **bold**, *italic*, `code`, - lists, [links](url)"
                rows={10}
                className="w-full text-sm"
                style={{
                  background: 'rgba(8,13,26,0.6)', border: '1px solid rgba(148,163,184,0.12)',
                  borderRadius: 8, color: '#e2e8f0', outline: 'none', resize: 'vertical',
                  padding: '10px 12px', fontFamily: 'inherit',
                }}
              />
            ) : (
              <div
                className="md-preview text-sm rounded-lg px-4 py-3"
                style={{ background: 'rgba(8,13,26,0.4)', border: '1px solid rgba(148,163,184,0.1)', minHeight: 220 }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(notes) }}
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-4" style={{ borderTop: '1px solid rgba(148,163,184,0.08)' }}>
          {!isNew && (
            <button
              onClick={() => confirmDelete ? onDelete(task.id) : setConfirmDelete(true)}
              onBlur={() => setConfirmDelete(false)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
              style={confirmDelete
                ? { background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }
                : { color: 'rgba(148,163,184,0.5)', border: '1px solid transparent' }}
            >
              <Trash2 size={12} /> {confirmDelete ? 'Click again to confirm' : 'Delete'}
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'rgba(148,163,184,0.6)' }}>
            Cancel
          </button>
          <button onClick={save} disabled={!title.trim()}
            className="text-xs px-4 py-1.5 rounded-lg transition-all"
            style={{
              background: title.trim() ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : 'rgba(148,163,184,0.1)',
              color: title.trim() ? 'white' : 'rgba(148,163,184,0.4)',
              cursor: title.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Task card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onOpen, onToggleDone, onDragStart }) {
  const firstLine = (task.notes || '').split('\n').find(l => l.trim())?.replace(/^#+\s*/, '').replace(/[*`]/g, '');

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer group transition-colors"
      style={{
        background: task.done ? 'rgba(148,163,184,0.03)' : 'rgba(148,163,184,0.05)',
        border: '1px solid rgba(148,163,184,0.07)',
        opacity: task.done ? 0.55 : 1,
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(148,163,184,0.18)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(148,163,184,0.07)'}
    >
      <button
        onClick={e => { e.stopPropagation(); onToggleDone(); }}
        className="mt-0.5 shrink-0"
        style={{ color: task.done ? '#86efac' : 'rgba(148,163,184,0.35)' }}
        title={task.done ? 'Mark as not done' : 'Mark as done'}
      >
        {task.done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 leading-snug break-words" style={task.done ? { textDecoration: 'line-through', color: 'rgba(148,163,184,0.5)' } : {}}>
          {task.title}
        </p>
        {firstLine && (
          <p className="text-xs mt-0.5 truncate flex items-center gap-1" style={{ color: 'rgba(148,163,184,0.35)' }}>
            <FileText size={9} className="shrink-0" /> {firstLine}
          </p>
        )}
      </div>

      <GripVertical size={13} className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: 'rgba(148,163,184,0.6)', cursor: 'grab' }} />
    </div>
  );
}

// ── Quadrant column ───────────────────────────────────────────────────────────
function QuadrantColumn({ quadrant, tasks, onAdd, onOpen, onToggleDone, onDrop }) {
  const [dragOver, setDragOver] = useState(false);
  const sorted = [...tasks].sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{
        background: quadrant.bg,
        border: `1px solid ${dragOver ? quadrant.color : quadrant.border}`,
        boxShadow: dragOver ? `0 0 0 1px ${quadrant.color}` : 'none',
        minHeight: 220,
      }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); onDrop(e.dataTransfer.getData('text/plain')); }}
    >
      <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: `1px solid ${quadrant.border}` }}>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: quadrant.color, boxShadow: `0 0 8px ${quadrant.color}80` }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: quadrant.text }}>{quadrant.label}</p>
          <p className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>{quadrant.sub}</p>
        </div>
        <span className="text-xs font-bold px-1.5 rounded-full" style={{ background: 'rgba(148,163,184,0.1)', color: 'rgba(148,163,184,0.5)' }}>
          {tasks.length}
        </span>
        <button onClick={onAdd} title="Add task"
          className="p-1 rounded-lg transition-all"
          style={{ color: quadrant.text }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(148,163,184,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="p-2.5 space-y-1.5 flex-1">
        {sorted.length === 0 ? (
          <div className="h-full flex items-center justify-center py-6">
            <p className="text-xs text-center" style={{ color: 'rgba(148,163,184,0.3)' }}>Drop a task here, or add one.</p>
          </div>
        ) : sorted.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onOpen={() => onOpen(task)}
            onToggleDone={() => onToggleDone(task)}
            onDragStart={e => e.dataTransfer.setData('text/plain', task.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── WorkTracker ───────────────────────────────────────────────────────────────
export function WorkTracker({ sectionId }) {
  const [tasks, setTasks] = useState(loadTasks);
  const [modalTask, setModalTask] = useState(null);
  const [modalIsNew, setModalIsNew] = useState(false);

  useEffect(() => { saveTasks(tasks); }, [tasks]);

  function openNew(quadrantId) {
    setModalTask({ id: crypto.randomUUID(), title: '', notes: '', quadrant: quadrantId, done: false });
    setModalIsNew(true);
  }
  function openExisting(task) {
    setModalTask(task);
    setModalIsNew(false);
  }
  function closeModal() { setModalTask(null); }

  function saveTask(updated) {
    const now = new Date().toISOString();
    setTasks(prev => {
      const exists = prev.some(t => t.id === updated.id);
      if (exists) {
        return prev.map(t => t.id === updated.id ? { ...updated, updatedAt: now } : t);
      }
      return [{ ...updated, createdAt: now }, ...prev];
    });
    closeModal();
  }

  function deleteTask(id) {
    setTasks(prev => prev.filter(t => t.id !== id));
    closeModal();
  }

  function toggleDone(task) {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done, updatedAt: new Date().toISOString() } : t));
  }

  function moveToQuadrant(taskId, quadrantId) {
    if (!taskId) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, quadrant: quadrantId, updatedAt: new Date().toISOString() } : t));
  }

  return (
    <div id={sectionId} className="space-y-4">
      <div className="flex items-center gap-3 px-1">
        <div className="p-1.5 rounded-lg shrink-0" style={{ background: 'rgba(99,102,241,0.15)' }}>
          <Grid2x2 size={14} style={{ color: '#a5b4fc' }} />
        </div>
        <span className="font-semibold text-slate-100 text-sm">Work Tracker</span>
        <span className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>Eisenhower matrix — drag tasks between quadrants</span>
        {tasks.length > 0 && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-mono" style={{
            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc',
          }}>
            {tasks.filter(t => !t.done).length} active
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUADRANTS.map(q => (
          <QuadrantColumn
            key={q.id}
            quadrant={q}
            tasks={tasks.filter(t => t.quadrant === q.id)}
            onAdd={() => openNew(q.id)}
            onOpen={openExisting}
            onToggleDone={toggleDone}
            onDrop={taskId => moveToQuadrant(taskId, q.id)}
          />
        ))}
      </div>

      {modalTask && (
        <TaskModal
          task={modalTask}
          isNew={modalIsNew}
          onSave={saveTask}
          onDelete={deleteTask}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
