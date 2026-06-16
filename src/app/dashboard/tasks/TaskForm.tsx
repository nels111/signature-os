'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Bell } from 'lucide-react';
import { taskSchema, TASK_TYPES } from '@/lib/schemas/task';
import { REMINDER_PRESETS } from '@/lib/reminders';
import LocationAutocomplete from '@/components/LocationAutocomplete';

const PRIORITIES = ['highest', 'high', 'normal', 'low', 'lowest'];
const STATUSES = ['not_started', 'in_progress', 'completed', 'deferred', 'waiting'];

function formatLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface TaskFormProps {
  initialData?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function TaskForm({ initialData, onSubmit, onCancel, loading }: TaskFormProps) {
  const { data: session } = useSession();
  const [subject, setSubject] = useState((initialData?.subject as string) || '');
  const dueDateInit = initialData?.dueDate
    ? new Date(initialData.dueDate as string).toISOString().slice(0, 16)
    : '';
  const [dueDate, setDueDate] = useState(dueDateInit);
  const [priority, setPriority] = useState((initialData?.priority as string) || 'normal');
  const [status, setStatus] = useState((initialData?.status as string) || 'not_started');
  const [taskType, setTaskType] = useState((initialData?.taskType as string) || 'business');
  const [description, setDescription] = useState((initialData?.description as string) || '');
  const [location, setLocation] = useState((initialData?.location as string) || '');
  const [ownerId, setOwnerId] = useState((initialData?.ownerId as string) || '');
  const [users, setUsers] = useState<UserOption[]>([]);
  // Reminder: '' = no reminder, otherwise minutes-before-due as a string.
  const [reminderMin, setReminderMin] = useState<string>(() => {
    const r = initialData?.reminder as { minutesBefore?: number | null } | null | undefined;
    if (r && typeof r.minutesBefore === 'number') return String(r.minutesBefore);
    return '';
  });

  // Default ownerId to current user once session loads
  useEffect(() => {
    if (!ownerId && session?.user?.id) {
      setOwnerId(session.user.id);
    }
  }, [session, ownerId]);

  // Fetch users for assign-to dropdown
  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(json => setUsers(json.users ?? []))
      .catch(() => {});
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = taskSchema.safeParse({ subject, dueDate, priority, status, taskType, description, ownerId });
    if (!parsed.success) return; // zod catches missing required fields
    onSubmit({
      subject,
      dueDate: new Date(dueDate).toISOString(),
      priority,
      status,
      taskType,
      description: description || null,
      location: location || null,
      ownerId: ownerId || undefined,
      reminder: reminderMin === '' ? null : { minutesBefore: Number(reminderMin) },
    });
  };

  const inputStyle = {
    borderColor: 'var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Subject *</label>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          required
          className="w-full px-3 py-2 border rounded-lg text-sm"
          style={inputStyle}
          placeholder="Task subject"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Due Date *</label>
          <input
            type="datetime-local"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-lg text-sm"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
            Assign To
          </label>
          <select
            value={ownerId}
            onChange={e => setOwnerId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            style={inputStyle}
          >
            {users.length === 0 && (
              <option value={session?.user?.id ?? ''}>Me</option>
            )}
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
                {u.id === session?.user?.id ? ' (me)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Priority</label>
          <select
            value={priority}
            onChange={e => setPriority(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            style={inputStyle}
          >
            {PRIORITIES.map(p => <option key={p} value={p}>{formatLabel(p)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            style={inputStyle}
          >
            {STATUSES.map(s => <option key={s} value={s}>{formatLabel(s)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Type</label>
          <select
            value={taskType}
            onChange={e => setTaskType(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            style={inputStyle}
          >
            {TASK_TYPES.map(t => <option key={t} value={t}>{formatLabel(t)}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border rounded-lg text-sm"
          style={inputStyle}
          placeholder="Task details..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Location</label>
        <LocationAutocomplete value={location} onChange={setLocation} inputStyle={inputStyle}
          placeholder="Start typing a place — becomes a tap-to-open Maps link" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          <Bell size={13} className="inline mr-1.5 mb-0.5" />
          Reminder
        </label>
        <select
          value={reminderMin}
          onChange={e => setReminderMin(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm"
          style={inputStyle}
        >
          {REMINDER_PRESETS.map(p => (
            <option key={p.value ?? 'none'} value={p.value === null ? '' : String(p.value)}>
              {p.value === 0 ? (p.atLabel ?? p.label) : p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm border rounded-lg"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
          style={{ backgroundColor: 'var(--brand-blue)' }}
        >
          {loading ? 'Saving...' : 'Save Task'}
        </button>
      </div>
    </form>
  );
}
