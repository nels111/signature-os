'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { TaskForm } from './TaskForm';

interface TaskItem {
  id: string;
  subject: string;
  dueDate: string;
  priority: string;
  status: string;
  taskType: string;
  previousStatus?: string | null;
  owner: { id: string; name: string | null } | null;
  createdAt: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  highest: 'var(--priority-highest)', high: 'var(--priority-high)', normal: 'var(--priority-normal)', low: 'var(--priority-low)', lowest: 'var(--priority-lowest)',
};
const STATUS_COLORS: Record<string, string> = {
  not_started: 'var(--task-not-started)', in_progress: 'var(--task-in-progress)', completed: 'var(--task-completed)', deferred: 'var(--task-deferred)', waiting: 'var(--task-waiting)',
};
const STATUS_ORDER = ['not_started', 'in_progress', 'completed', 'deferred', 'waiting'];

function formatLabel(s: string) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isOverdue(dueDate: string, status: string) {
  return status !== 'completed' && new Date(dueDate) < new Date();
}

export function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'business' | 'personal'>('business');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [undo, setUndo] = useState<{ id: string; message: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadTasks() {
      const params = new URLSearchParams({ page: String(page), limit: '20', sortBy: 'dueDate', sortDir: 'asc' });
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      params.set('taskType', activeTab === 'personal' ? 'personal' : 'NOT_personal');

      const res = await fetch('/api/tasks?' + params.toString());
      const json = await res.json();

      const data = json.data || [];

      if (!cancelled) {
        setTasks(data);
        setTotal(json.total || 0);
        setLoading(false);
        // Reset selection when result set changes (filters, page, tab change)
        setSelected(new Set());
      }
    }
    loadTasks();
    return () => { cancelled = true; };
  }, [page, search, filterStatus, activeTab, refreshKey]);

  useEffect(() => {
    return () => { if (undoTimer.current) clearTimeout(undoTimer.current); };
  }, []);

  const handleCreate = async (data: Record<string, unknown>) => {
    setSaving(true);
    if (activeTab === 'personal') data.taskType = 'personal';
    const res = await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setShowCreate(false); setRefreshKey(k => k + 1); }
  };

  const toggleDone = useCallback(async (task: TaskItem, e?: React.MouseEvent | React.ChangeEvent) => {
    if (e && 'stopPropagation' in e) e.stopPropagation();

    // Snapshot for rollback
    const snapshot = tasks;
    const wasCompleted = task.status === 'completed';

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? {
      ...t,
      status: wasCompleted ? (t.previousStatus || 'not_started') : 'completed',
      previousStatus: wasCompleted ? null : t.status,
    } : t));

    try {
      const res = await fetch('/api/tasks/' + task.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toggleDone: true }),
      });
      if (!res.ok) throw new Error('toggle failed');
      const updated = await res.json();
      // Reconcile with server response
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updated } : t));

      // Show undo toast for mark-done (not for unmark)
      if (!wasCompleted) {
        if (undoTimer.current) clearTimeout(undoTimer.current);
        setUndo({ id: task.id, message: `"${task.subject.slice(0, 40)}" marked done` });
        undoTimer.current = setTimeout(() => setUndo(null), 5000);
      } else {
        setUndo(null);
      }
    } catch {
      // Rollback
      setTasks(snapshot);
      alert('Failed to update task. Please try again.');
    }
  }, [tasks]);

  const handleUndo = useCallback(async () => {
    if (!undo) return;
    const targetId = undo.id;
    setUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);

    const target = tasks.find(t => t.id === targetId);
    if (!target) return;
    if (target.status !== 'completed') return; // already changed elsewhere

    await fetch('/api/tasks/' + targetId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toggleDone: true }),
    });
    setRefreshKey(k => k + 1);
  }, [undo, tasks]);

  const toggleSelect = (id: string, e?: React.MouseEvent | React.ChangeEvent) => {
    if (e && 'stopPropagation' in e) e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(prev =>
      prev.size === tasks.length ? new Set() : new Set(tasks.map(t => t.id))
    );
  };

  const runBulk = async (action: 'mark_done' | 'mark_undone' | 'delete') => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch('/api/tasks/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), action }),
      });
      if (!res.ok) throw new Error('bulk failed');
      setSelected(new Set());
      setRefreshKey(k => k + 1);
    } catch {
      alert('Bulk action failed. Please try again.');
    } finally {
      setBulkBusy(false);
      setConfirmBulkDelete(false);
    }
  };

  const allOnPageSelected = tasks.length > 0 && selected.size === tasks.length;
  const someOnPageSelected = selected.size > 0 && selected.size < tasks.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Tasks</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{total} tasks total</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: 'var(--brand-blue)' }}>
          + New Task
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {(['business', 'personal'] as const).map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab); setPage(1); }}
            className="px-4 py-2 text-sm rounded-t-md font-medium"
            style={activeTab === tab
              ? { backgroundColor: 'var(--brand-blue)', color: '#fff' }
              : { backgroundColor: 'var(--background)', color: 'var(--text-secondary)' }}>
            {tab === 'business' ? 'Business' : 'Personal'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input type="text" placeholder="Search tasks..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-lg text-sm flex-1" style={{ borderColor: 'var(--border)' }} />
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-lg text-sm" style={{ borderColor: 'var(--border)' }}>
          <option value="">All Statuses</option>
          {STATUS_ORDER.map(s => <option key={s} value={s}>{formatLabel(s)}</option>)}
        </select>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between mb-3 px-4 py-2 rounded-lg"
          style={{ backgroundColor: 'var(--surface-accent)', border: '1px solid var(--border)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {selected.size} selected
          </span>
          <div className="flex gap-2">
            <button disabled={bulkBusy} onClick={() => runBulk('mark_done')}
              className="px-3 py-1 text-xs rounded text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--brand-green, #6B8E23)' }}>
              Mark Done
            </button>
            <button disabled={bulkBusy} onClick={() => runBulk('mark_undone')}
              className="px-3 py-1 text-xs rounded disabled:opacity-50"
              style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              Mark Undone
            </button>
            <button disabled={bulkBusy} onClick={() => setConfirmBulkDelete(true)}
              className="px-3 py-1 text-xs rounded text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--status-danger, #D1242F)' }}>
              Delete
            </button>
            <button disabled={bulkBusy} onClick={() => setSelected(new Set())}
              className="px-3 py-1 text-xs rounded disabled:opacity-50"
              style={{ color: 'var(--text-secondary)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm min-w-[600px]">
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  {[40, 20, 15, 15, 10].map((w, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 rounded animate-pulse" style={{ background: 'var(--border)', width: `${w}%` }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No tasks found.</p>
      ) : (
        <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead style={{ backgroundColor: 'var(--surface-accent)' }}>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all on page"
                    checked={allOnPageSelected}
                    ref={el => { if (el) el.indeterminate = someOnPageSelected; }}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 cursor-pointer"
                  />
                </th>
                <th className="px-2 py-3 w-10" aria-label="Done"></th>
                <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Subject</th>
                <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Due Date</th>
                <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide hidden sm:table-cell" style={{ color: 'var(--text-secondary)' }}>Priority</th>
                <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Status</th>
                <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide hidden md:table-cell" style={{ color: 'var(--text-secondary)' }}>Owner</th>
                <th className="px-2 py-3 w-10" aria-label="Edit"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => {
                const done = task.status === 'completed';
                const overdue = isOverdue(task.dueDate, task.status);
                const isSelected = selected.has(task.id);
                return (
                  <tr key={task.id}
                    className="border-b cursor-pointer transition-colors group"
                    style={{
                      borderColor: 'var(--border)',
                      borderLeft: overdue ? '3px solid var(--status-danger, #D1242F)' : undefined,
                      backgroundColor: isSelected ? 'var(--surface-accent)' : undefined,
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    onClick={() => router.push('/dashboard/tasks/' + task.id)}>
                    <td className="px-3 py-3 align-middle" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select task ${task.subject}`}
                        checked={isSelected}
                        onChange={e => toggleSelect(task.id, e)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-2 py-3 align-middle" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={done ? `Mark "${task.subject}" undone` : `Mark "${task.subject}" done`}
                        checked={done}
                        onChange={e => toggleDone(task, e)}
                        className="w-5 h-5 cursor-pointer"
                        style={{ accentColor: 'var(--brand-green, #6B8E23)' }}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium" style={{
                      color: done ? 'var(--text-muted)' : 'var(--text-primary)',
                      textDecoration: done ? 'line-through' : undefined,
                    }}>{task.subject}</td>
                    <td className="px-4 py-3" style={{ color: overdue ? 'var(--status-danger, #D1242F)' : 'var(--text-secondary)' }}>
                      {formatDate(task.dueDate)}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge color={PRIORITY_COLORS[task.priority] || '#6b7280'}>{formatLabel(task.priority)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={STATUS_COLORS[task.status] || '#6b7280'}>{formatLabel(task.status)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs hidden md:table-cell" style={{ color: 'var(--text-secondary)' }}>{task.owner?.name || '\u2014'}</td>
                    <td className="px-2 py-3 align-middle" onClick={e => e.stopPropagation()}>
                      <button
                        aria-label={`Edit ${task.subject}`}
                        onClick={() => router.push('/dashboard/tasks/' + task.id)}
                        className="opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/5"
                        style={{ color: 'var(--text-secondary)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 20h9"/>
                          <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex gap-2 mt-4 justify-center">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>Prev</button>
          <span className="px-3 py-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Page {page}</span>
          <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>Next</button>
        </div>
      )}

      {/* Undo toast */}
      {undo && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-3 rounded-lg shadow-lg flex items-center gap-4 z-50"
          style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface)' }}>
          <span className="text-sm">{undo.message}</span>
          <button onClick={handleUndo} className="text-sm font-semibold underline">Undo</button>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Task">
        <TaskForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} loading={saving} />
      </Modal>

      {/* Bulk delete confirm */}
      <Modal open={confirmBulkDelete} onClose={() => setConfirmBulkDelete(false)} title={`Delete ${selected.size} tasks?`}>
        <div className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          This will soft-delete the selected tasks. They will no longer appear in lists. This action can be reversed by an admin.
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => setConfirmBulkDelete(false)}
            className="px-3 py-2 text-sm rounded" style={{ border: '1px solid var(--border)' }}>Cancel</button>
          <button disabled={bulkBusy} onClick={() => runBulk('delete')}
            className="px-3 py-2 text-sm rounded text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--status-danger, #D1242F)' }}>
            {bulkBusy ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
