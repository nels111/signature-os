'use client';

import { useState } from 'react';

const EVENT_TYPES = ['meeting', 'site_survey', 'follow_up', 'calendly', 'personal'];
const CALENDAR_TYPES = ['shared', 'personal'];

function formatLabel(s: string) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

interface CalendarFormProps {
  initialData?: Record<string, unknown>;
  defaultDate?: string;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function CalendarForm({ initialData, defaultDate, onSubmit, onCancel, loading }: CalendarFormProps) {
  const [title, setTitle] = useState((initialData?.title as string) || '');
  const [eventType, setEventType] = useState((initialData?.eventType as string) || 'meeting');
  const [calendarType, setCalendarType] = useState((initialData?.calendarType as string) || 'shared');
  const [allDay, setAllDay] = useState((initialData?.allDay as boolean) || false);
  function toLocalInput(dateStr: string): string {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${da}T${h}:${mi}`;
  }
  const startInit = initialData?.startDate
    ? toLocalInput(initialData.startDate as string)
    : defaultDate ? defaultDate + 'T09:00' : '';
  const endInit = initialData?.endDate
    ? toLocalInput(initialData.endDate as string)
    : defaultDate ? defaultDate + 'T10:00' : '';
  const [startDate, setStartDate] = useState(startInit);
  const [endDate, setEndDate] = useState(endInit);
  const [notes, setNotes] = useState((initialData?.notes as string) || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startDate || !endDate) return;
    onSubmit({
      title, eventType, calendarType, allDay,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      notes: notes || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: '#1a1a1a' }}>Title *</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
          className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#e2e8f0' }}
          placeholder="Event title" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#1a1a1a' }}>Event Type</label>
          <select value={eventType} onChange={e => setEventType(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#e2e8f0' }}>
            {EVENT_TYPES.map(t => <option key={t} value={t}>{formatLabel(t)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#1a1a1a' }}>Calendar</label>
          <select value={calendarType} onChange={e => setCalendarType(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#e2e8f0' }}>
            {CALENDAR_TYPES.map(t => <option key={t} value={t}>{formatLabel(t)}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="allDay" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
        <label htmlFor="allDay" className="text-sm" style={{ color: '#1a1a1a' }}>All day event</label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#1a1a1a' }}>Start *</label>
          <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} required
            className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#e2e8f0' }} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#1a1a1a' }}>End *</label>
          <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} required
            className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#e2e8f0' }} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: '#1a1a1a' }}>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#e2e8f0' }}
          placeholder="Event notes..." />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50" style={{ borderColor: '#e2e8f0' }}>Cancel</button>
        <button type="submit" disabled={loading}
          className="px-4 py-2 text-sm text-white rounded-md disabled:opacity-50" style={{ backgroundColor: '#2c5f2d' }}>
          {loading ? 'Saving...' : 'Save Event'}
        </button>
      </div>
    </form>
  );
}
