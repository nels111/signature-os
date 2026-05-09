'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { TaskForm } from '../TaskForm';

const PRIORITY_COLORS: Record<string, string> = {
  highest: '#ef4444', high: '#f59e0b', normal: '#3b82f6', low: '#6b7280', lowest: '#9ca3af',
};
const STATUS_COLORS: Record<string, string> = {
  not_started: '#6b7280', in_progress: '#3b82f6', completed: '#10b981', deferred: '#f59e0b', waiting: '#8b5cf6',
};

function formatLabel(s: string) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function TaskDetailClient() {
  const { id } = useParams();
  const router = useRouter();
  const [task, setTask] = useState<Record<string, unknown> | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    fetch('/api/tasks/' + id).then(r => r.json()).then(setTask);
  }, [id]);

  const handleUpdate = async (data: Record<string, unknown>) => {
    setSaving(true);
    const res = await fetch('/api/tasks/' + id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { const updated = await res.json(); setTask(updated); setShowEdit(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this task?')) return;
    await fetch('/api/tasks/' + id, { method: 'DELETE' });
    router.push('/dashboard/tasks');
  };

  if (!task) return <p className="text-sm" style={{ color: '#64748b' }}>Loading...</p>;

  return (
    <div>
      <button onClick={() => router.push('/dashboard/tasks')}
        className="text-sm mb-4 hover:underline" style={{ color: '#2c5f2d' }}>← Back to Tasks</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#1a1a1a' }}>{task.subject as string}</h1>
          <div className="flex gap-2 mt-2">
            <Badge color={PRIORITY_COLORS[(task.priority as string)] || '#6b7280'}>{formatLabel(task.priority as string)}</Badge>
            <Badge color={STATUS_COLORS[(task.status as string)] || '#6b7280'}>{formatLabel(task.status as string)}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowEdit(true)}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50" style={{ borderColor: '#e2e8f0' }}>Edit</button>
          <button onClick={handleDelete}
            className="px-3 py-1.5 text-sm text-white rounded-md" style={{ backgroundColor: '#ef4444' }}>Delete</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b" style={{ borderColor: '#e2e8f0' }}>
        {['details', 'description', 'linked'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-4 py-2 text-sm font-medium -mb-px"
            style={activeTab === tab
              ? { borderBottom: '2px solid #2c5f2d', color: '#1a1a1a' }
              : { color: '#64748b' }}>
            {tab === 'linked' ? 'Linked Entities' : formatLabel(tab)}
          </button>
        ))}
      </div>

      {activeTab === 'details' && (
        <div className="bg-white border rounded-lg p-6 space-y-3" style={{ borderColor: '#e2e8f0' }}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span style={{ color: '#64748b' }}>Due Date:</span> <span className="ml-2 font-medium">{formatDate(task.dueDate as string)}</span></div>
            <div><span style={{ color: '#64748b' }}>Type:</span> <span className="ml-2">{formatLabel(task.taskType as string)}</span></div>
            <div><span style={{ color: '#64748b' }}>Owner:</span> <span className="ml-2">{String((task.owner as Record<string, unknown>)?.name || '—')}</span></div>
            <div><span style={{ color: '#64748b' }}>Created:</span> <span className="ml-2">{formatDate(task.createdAt as string)}</span></div>
            {typeof task.completedAt === 'string' && task.completedAt && (
              <div><span style={{ color: '#64748b' }}>Completed:</span> <span className="ml-2">{formatDate(task.completedAt as string)}</span></div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'description' && (
        <div className="bg-white border rounded-lg p-6" style={{ borderColor: '#e2e8f0' }}>
          <p className="text-sm whitespace-pre-wrap" style={{ color: '#1a1a1a' }}>
            {(task.description as string) || 'No description.'}
          </p>
        </div>
      )}

      {activeTab === 'linked' && (
        <div className="bg-white border rounded-lg p-6 space-y-3" style={{ borderColor: '#e2e8f0' }}>
          {task.linkedLead != null && (
            <div className="text-sm">
              <span style={{ color: '#64748b' }}>Lead:</span>
              <a href={'/dashboard/leads/' + (task.linkedLead as Record<string, unknown>).id}
                className="ml-2 hover:underline" style={{ color: '#2c5f2d' }}>
                {(task.linkedLead as Record<string, unknown>).companyName as string}
              </a>
            </div>
          )}
          {task.linkedDeal != null && (
            <div className="text-sm">
              <span style={{ color: '#64748b' }}>Deal:</span>
              <a href={'/dashboard/deals/' + (task.linkedDeal as Record<string, unknown>).id}
                className="ml-2 hover:underline" style={{ color: '#2c5f2d' }}>
                {(task.linkedDeal as Record<string, unknown>).name as string}
              </a>
            </div>
          )}
          {task.linkedContact != null && (
            <div className="text-sm">
              <span style={{ color: '#64748b' }}>Contact:</span>
              <a href={'/dashboard/contacts/' + (task.linkedContact as Record<string, unknown>).id}
                className="ml-2 hover:underline" style={{ color: '#2c5f2d' }}>
                {(task.linkedContact as Record<string, unknown>).firstName as string} {(task.linkedContact as Record<string, unknown>).lastName as string}
              </a>
            </div>
          )}
          {task.linkedLead == null && task.linkedDeal == null && task.linkedContact == null && (
            <p className="text-sm" style={{ color: '#64748b' }}>No linked entities.</p>
          )}
        </div>
      )}

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Task">
        <TaskForm initialData={task} onSubmit={handleUpdate} onCancel={() => setShowEdit(false)} loading={saving} />
      </Modal>
    </div>
  );
}
