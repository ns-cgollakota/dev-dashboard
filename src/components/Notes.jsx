import { useState, useEffect } from 'react';
import { StickyNote, Plus, Trash2, X, Pencil, Check, CheckCircle2 } from 'lucide-react';

const STORAGE_KEY    = 'dev-dashboard-notes';
const DONE_KEY       = 'dev-dashboard-notes-done';
const THREE_MONTHS   = 90 * 24 * 60 * 60 * 1000;

function loadNotes() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveNotes(notes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function loadDone() {
  try {
    const items = JSON.parse(localStorage.getItem(DONE_KEY) || '[]');
    const cutoff = Date.now() - THREE_MONTHS;
    return items.filter(n => new Date(n.doneAt).getTime() > cutoff);
  } catch { return []; }
}
function saveDone(items) {
  localStorage.setItem(DONE_KEY, JSON.stringify(items));
}

function formatDate(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function autoDeleteDate(doneAt) {
  return new Date(new Date(doneAt).getTime() + THREE_MONTHS)
    .toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function Notes({ sectionId }) {
  const [notes,     setNotes]     = useState(loadNotes);
  const [done,      setDone]      = useState(loadDone);
  const [tab,       setTab]       = useState('active');
  const [draft,     setDraft]     = useState('');
  const [adding,    setAdding]    = useState(false);
  const [deleteId,  setDeleteId]  = useState(null);
  const [editId,    setEditId]    = useState(null);
  const [editDraft, setEditDraft] = useState('');

  useEffect(() => { saveNotes(notes); }, [notes]);
  useEffect(() => { saveDone(done); },  [done]);

  function addNote() {
    const text = draft.trim();
    if (!text) return;
    setNotes(prev => [
      { id: crypto.randomUUID(), content: text, createdAt: new Date().toISOString() },
      ...prev,
    ]);
    setDraft('');
    setAdding(false);
  }

  function markDone(note) {
    setNotes(prev => prev.filter(n => n.id !== note.id));
    setDone(prev => [{ ...note, doneAt: new Date().toISOString() }, ...prev]);
  }

  function startEdit(note) {
    setEditId(note.id);
    setEditDraft(note.content);
    setDeleteId(null);
  }

  function saveEdit() {
    const text = editDraft.trim();
    if (!text) return;
    setNotes(prev => prev.map(n =>
      n.id === editId ? { ...n, content: text, updatedAt: new Date().toISOString() } : n
    ));
    setEditId(null);
    setEditDraft('');
  }

  function cancelEdit() { setEditId(null); setEditDraft(''); }

  function deleteNote(id) {
    if (deleteId === id) {
      setNotes(prev => prev.filter(n => n.id !== id));
      setDeleteId(null);
    } else {
      setDeleteId(id);
      setTimeout(() => setDeleteId(cur => cur === id ? null : cur), 3000);
    }
  }

  const textareaStyle = {
    background: 'rgba(8,13,26,0.6)',
    border: '1px solid rgba(99,102,241,0.35)',
    borderRadius: 8,
    color: '#e2e8f0',
    resize: 'none',
    outline: 'none',
    width: '100%',
    padding: '10px 12px',
    fontSize: 13,
  };

  const TABS = [
    { id: 'active', label: 'Active', count: notes.length, color: '#fde68a', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.2)' },
    { id: 'done',   label: 'Done',   count: done.length,  color: '#86efac', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.2)' },
  ];

  return (
    <div id={sectionId} className="overflow-hidden rounded-xl" style={{
      background: 'rgba(13,20,36,0.8)',
      border: '1px solid rgba(148,163,184,0.08)',
      backdropFilter: 'blur(8px)',
    }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
        <div className="p-1.5 rounded-lg shrink-0" style={{ background: 'rgba(234,179,8,0.15)' }}>
          <StickyNote size={14} style={{ color: '#fbbf24' }} />
        </div>
        <span className="font-semibold text-slate-100 text-sm">Notes</span>

        {/* Tab pills */}
        <div className="flex items-center gap-0.5 ml-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all"
              style={tab === t.id
                ? { background: t.bg, border: `1px solid ${t.border}`, color: t.color }
                : { color: 'rgba(148,163,184,0.45)', border: '1px solid transparent' }
              }
            >
              {t.label}
              {t.count > 0 && (
                <span className="font-bold px-1.5 rounded-full" style={
                  tab === t.id
                    ? { background: t.bg, color: t.color }
                    : { background: 'rgba(148,163,184,0.1)', color: 'rgba(148,163,184,0.5)' }
                }>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {tab === 'active' && (
          <button
            onClick={() => { setAdding(v => !v); setDraft(''); }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all duration-150"
            style={adding
              ? { background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.15)', color: '#94a3b8' }
              : { background: 'linear-gradient(135deg, rgba(59,130,246,0.8), rgba(99,102,241,0.8))', border: '1px solid rgba(99,102,241,0.4)', color: 'white', boxShadow: '0 0 10px rgba(99,102,241,0.2)' }
            }
          >
            {adding ? <X size={13} /> : <Plus size={13} />}
            {adding ? 'Cancel' : 'Add note'}
          </button>
        )}

        {tab === 'done' && done.length > 0 && (
          <button
            onClick={() => setDone([])}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{ color: 'rgba(148,163,184,0.4)', border: '1px solid rgba(148,163,184,0.1)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fca5a5'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(148,163,184,0.4)'; e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)'; }}
          >
            <Trash2 size={12} /> Clear all
          </button>
        )}
      </div>

      {/* Add note form */}
      {tab === 'active' && adding && (
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(148,163,184,0.07)', background: 'rgba(8,13,26,0.3)' }}>
          <textarea
            autoFocus value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote();
              if (e.key === 'Escape') { setAdding(false); setDraft(''); }
            }}
            placeholder="Write your note… (Ctrl+Enter to save)"
            rows={4} style={textareaStyle}
          />
          <div className="flex justify-end gap-2 mt-2.5">
            <button onClick={() => { setAdding(false); setDraft(''); }}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ color: 'rgba(148,163,184,0.6)' }}>Cancel</button>
            <button onClick={addNote} disabled={!draft.trim()}
              className="text-xs px-4 py-1.5 rounded-lg transition-all"
              style={{
                background: draft.trim() ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : 'rgba(148,163,184,0.1)',
                color: draft.trim() ? 'white' : 'rgba(148,163,184,0.4)',
                cursor: draft.trim() ? 'pointer' : 'not-allowed',
              }}>Save note</button>
          </div>
        </div>
      )}

      {/* ── Active tab ── */}
      {tab === 'active' && (
        notes.length === 0 && !adding ? (
          <div className="px-5 py-10 text-center space-y-1">
            <p className="text-2xl">📝</p>
            <p className="text-slate-400 text-sm">No notes yet.</p>
            <p className="text-xs" style={{ color: 'rgba(148,163,184,0.35)' }}>Click "Add note" to jot something down.</p>
          </div>
        ) : (
          <ul>
            {notes.map((note, idx) => (
              <li key={note.id}
                className="px-5 py-3.5 group transition-colors duration-150"
                style={{ borderBottom: idx < notes.length - 1 ? '1px solid rgba(148,163,184,0.05)' : 'none' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(148,163,184,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {editId === note.id ? (
                  <div>
                    <textarea autoFocus value={editDraft}
                      onChange={e => setEditDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      rows={4} style={textareaStyle}
                    />
                    <div className="flex justify-end gap-2 mt-2.5">
                      <button onClick={cancelEdit} className="text-xs px-3 py-1.5 rounded-lg"
                        style={{ color: 'rgba(148,163,184,0.6)' }}>Cancel</button>
                      <button onClick={saveEdit} disabled={!editDraft.trim()}
                        className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg transition-all"
                        style={{
                          background: editDraft.trim() ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : 'rgba(148,163,184,0.1)',
                          color: editDraft.trim() ? 'white' : 'rgba(148,163,184,0.4)',
                          cursor: editDraft.trim() ? 'pointer' : 'not-allowed',
                        }}>
                        <Check size={12} /> Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="w-0.5 self-stretch rounded-full shrink-0 mt-0.5"
                      style={{ background: 'rgba(234,179,8,0.3)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {note.content}
                      </p>
                      <p className="text-xs mt-1.5" style={{ color: 'rgba(148,163,184,0.3)' }}>
                        {formatDate(note.createdAt)}
                        {note.updatedAt && (
                          <span className="ml-2" style={{ color: 'rgba(148,163,184,0.2)' }}>
                            · edited {formatDate(note.updatedAt)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Mark done */}
                      <button onClick={() => markDone(note)}
                        title="Mark as done"
                        className="p-1.5 rounded-lg transition-all"
                        style={{ color: 'rgba(148,163,184,0.4)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.15)'; e.currentTarget.style.color = '#86efac'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(148,163,184,0.4)'; }}
                      >
                        <CheckCircle2 size={13} />
                      </button>
                      {/* Edit */}
                      <button onClick={() => startEdit(note)}
                        title="Edit note"
                        className="p-1.5 rounded-lg transition-all"
                        style={{ color: 'rgba(148,163,184,0.4)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.15)'; e.currentTarget.style.color = '#93c5fd'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(148,163,184,0.4)'; }}
                      >
                        <Pencil size={12} />
                      </button>
                      {/* Delete */}
                      <button onClick={() => deleteNote(note.id)}
                        title={deleteId === note.id ? 'Click again to confirm' : 'Delete note'}
                        className="p-1.5 rounded-lg transition-all"
                        style={deleteId === note.id
                          ? { background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }
                          : { color: 'rgba(148,163,184,0.4)' }
                        }
                        onMouseEnter={e => { if (deleteId !== note.id) { e.currentTarget.style.color = '#fca5a5'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}}
                        onMouseLeave={e => { if (deleteId !== note.id) { e.currentTarget.style.color = 'rgba(148,163,184,0.4)'; e.currentTarget.style.background = 'transparent'; }}}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )
      )}

      {/* ── Done tab ── */}
      {tab === 'done' && (
        done.length === 0 ? (
          <div className="px-5 py-10 text-center space-y-1">
            <p className="text-2xl">✅</p>
            <p className="text-slate-400 text-sm">No completed notes yet.</p>
            <p className="text-xs" style={{ color: 'rgba(148,163,184,0.35)' }}>Mark notes as done to archive them here.</p>
          </div>
        ) : (
          <>
            <div className="px-5 py-2" style={{ background: 'rgba(8,13,26,0.25)', borderBottom: '1px solid rgba(148,163,184,0.05)' }}>
              <p className="text-xs" style={{ color: 'rgba(148,163,184,0.3)' }}>
                Completed notes are automatically removed 3 months after completion.
              </p>
            </div>
            <ul>
              {done.map((note, idx) => (
                <li key={note.id}
                  className="px-5 py-3.5 group transition-colors duration-150"
                  style={{ borderBottom: idx < done.length - 1 ? '1px solid rgba(148,163,184,0.05)' : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-0.5 self-stretch rounded-full shrink-0 mt-0.5"
                      style={{ background: 'rgba(34,197,94,0.25)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed line-through"
                        style={{ color: 'rgba(148,163,184,0.4)' }}>
                        {note.content}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-xs" style={{ color: 'rgba(148,163,184,0.25)' }}>
                          created {formatDate(note.createdAt)}
                        </span>
                        <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(34,197,94,0.5)' }}>
                          <CheckCircle2 size={10} /> done {formatDate(note.doneAt)}
                        </span>
                        <span className="text-xs" style={{ color: 'rgba(148,163,184,0.2)' }}>
                          · auto-deletes {autoDeleteDate(note.doneAt)}
                        </span>
                      </div>
                    </div>
                    {/* Remove from history */}
                    <button
                      onClick={() => setDone(prev => prev.filter(n => n.id !== note.id))}
                      title="Remove from history"
                      className="p-1.5 rounded-lg transition-all shrink-0 mt-0.5 opacity-0 group-hover:opacity-100"
                      style={{ color: 'rgba(148,163,184,0.4)' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#fca5a5'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(148,163,184,0.4)'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )
      )}
    </div>
  );
}
