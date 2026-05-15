'use client';

import { useState } from 'react';

const PRIORITIES = ['highest', 'high', 'normal', 'low', 'lowest'];
const STATUSES = ['not_started', 'in_progress', 'completed', 'deferred', 'waiting'];
const TASK_TYPES = ['business', 'personal', 'mobilisation', 'onboarding', 'audit_action', 'issue_followup'];

function formatLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface TaskFormProps {
  initialData?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function TaskForm({ initialData, onSubmit, onCancel, loading }: TaskFormProps) {
  const [subject, setSubject] = useState((initialData?.subject as string) || '');
  const dueDateInit = initialData?.dueDate
    ? new Date(initialData.dueDate as string).toISOString().slice(0, 16)
    : '';
  const [dueDate, setDueDate] = useState(dueDateInit);
  const [priority, setPriority] = useState((initialData?.priority as string) || 'normal');
  const [status, setStatus] = useState((initialData?.status as string) || 'not_started');
  const [taskType, setTaskType] = useState((initialData?.taskType as string) || 'business');
  const [description, setDescription] = useState((initialData?.description as string) || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !dueDate) return;
    onSubmit({ subject, dueDate: new Date(dueDate).toISOString(), priority, status, taskType, description: description || null });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Subject *</label>
        <input type="text" value={subject} onChange={e => setSubject(e.target.value)} required
          className="w-full px-3 py-2 border rounded-lg text-sm" style={{ borderColor: 'var(--border)' }}
          placeholder="Task subject" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Due Date *</label>
        <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} required
          className="w-full px-3 py-2 border rounded-lg text-sm" style={{ borderColor: 'var(--border)' }} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Priority</label>
          <select value={priority} onChange={e => setPriority(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm" style={{ borderColor: 'var(--border)' }}>
            {PRIORITIES.map(p => <option key={p} value={p}>{formatLabel(p)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm" style={{ borderColor: 'var(--border)' }}>
            {STATUSES.map(s => <option key={s} value={s}>{formatLabel(s)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Type</label>
          <select value={taskType} onChange={e => setTaskType(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm" style={{ borderColor: 'var(--border)' }}>
            {TASK_TYPES.map(t => <option key={t} value={t}>{formatLabel(t)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          className="w-full px-3 py-2 border rounded-lg text-sm" style={{ borderColor: 'var(--border)' }}
          placeholder="Task details..." />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50" style={{ borderColor: 'var(--border)' }}>
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50" style={{ backgroundColor: 'var(--brand-blue)' }}>
          {loading ? 'Saving...' : 'Save Task'}
        </button>
      </div>
    </form>
  );
}
