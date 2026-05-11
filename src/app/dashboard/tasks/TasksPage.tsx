'use client';

import { useState, useEffect } from 'react';
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
  owner: { id: string; name: string | null } | null;
  createdAt: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  highest: '#ef4444', high: '#f59e0b', normal: '#3b82f6', low: '#6b7280', lowest: '#9ca3af',
};
const STATUS_COLORS: Record<string, string> = {
  not_started: '#6b7280', in_progress: '#3b82f6', completed: '#10b981', deferred: '#f59e0b', waiting: '#8b5cf6',
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
      }
    }
    loadTasks();
    return () => { cancelled = true; };
  }, [page, search, filterStatus, activeTab, refreshKey]);

  const handleCreate = async (data: Record<string, unknown>) => {
    setSaving(true);
    if (activeTab === 'personal') data.taskType = 'personal';
    const res = await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setShowCreate(false); setRefreshKey(k => k + 1); }
  };

  const cycleStatus = async (task: TaskItem) => {
    const idx = STATUS_ORDER.indexOf(task.status);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    await fetch('/api/tasks/' + task.id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    setRefreshKey(k => k + 1);
  };

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
              : { backgroundColor: '#f1f5f9', color: 'var(--text-secondary)' }}>
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

      {/* Table */}
      {loading ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No tasks found.</p>
      ) : (
        <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Subject</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Due Date</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Priority</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Status</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Type</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Owner</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  style={{
                    borderColor: 'var(--border)',
                    borderLeft: isOverdue(task.dueDate, task.status) ? '3px solid #ef4444' : undefined,
                  }}
                  onClick={() => router.push('/dashboard/tasks/' + task.id)}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{task.subject}</td>
                  <td className="px-4 py-3" style={{ color: isOverdue(task.dueDate, task.status) ? '#ef4444' : 'var(--text-secondary)' }}>
                    {formatDate(task.dueDate)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={PRIORITY_COLORS[task.priority] || '#6b7280'}>{formatLabel(task.priority)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={e => { e.stopPropagation(); cycleStatus(task); }}>
                      <Badge color={STATUS_COLORS[task.status] || '#6b7280'}>{formatLabel(task.status)}</Badge>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{formatLabel(task.taskType)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{task.owner?.name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Task">
        <TaskForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} loading={saving} />
      </Modal>
    </div>
  );
}
