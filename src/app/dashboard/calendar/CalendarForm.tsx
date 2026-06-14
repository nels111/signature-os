'use client';

import { useState, useEffect } from 'react';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import { useSession } from 'next-auth/react';
import { Users, Check, UserPlus, X, Mail, RefreshCw } from 'lucide-react';

const EVENT_TYPES = ['meeting', 'site_survey', 'follow_up', 'calendly', 'personal'];
const CALENDAR_TYPES = ['shared', 'personal'];

function formatLabel(s: string) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

interface User { id: string; name: string; email: string; role: string; }
interface ExternalParticipant { email: string; name: string; }

interface CalendarFormProps {
  initialData?: Record<string, unknown>;
  defaultDate?: string;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function CalendarForm({ initialData, defaultDate, onSubmit, onCancel, loading }: CalendarFormProps) {
  const { data: session } = useSession();
  const [title, setTitle] = useState((initialData?.title as string) || '');
  const [eventType, setEventType] = useState((initialData?.eventType as string) || 'meeting');
  const [calendarType, setCalendarType] = useState((initialData?.calendarType as string) || 'shared');
  const [allDay, setAllDay] = useState((initialData?.allDay as boolean) || false);
  const [notes, setNotes] = useState((initialData?.notes as string) || '');
  const [location, setLocation] = useState((initialData?.location as string) || '');
  const [users, setUsers] = useState<User[]>([]);
  const [participantIds, setParticipantIds] = useState<string[]>(() => {
    const invites = initialData?.invites as Array<{ invitee: { id: string } }> | undefined;
    return invites ? invites.map((i) => i.invitee.id) : [];
  });
  const [externalParticipants, setExternalParticipants] = useState<ExternalParticipant[]>(() => {
    const ext = initialData?.externalInvites as Array<{ email: string; name?: string }> | undefined;
    return ext ? ext.map(e => ({ email: e.email, name: e.name ?? '' })) : [];
  });
  const [extEmail, setExtEmail] = useState('');
  const [extName, setExtName] = useState('');

  // Repeat
  const [repeatFreq, setRepeatFreq] = useState<string>(() => {
    const r = initialData?.repeat as { freq?: string } | null | undefined;
    return r?.freq || '';
  });
  const [repeatEndDate, setRepeatEndDate] = useState<string>(() => {
    const r = initialData?.repeat as { endDate?: string } | null | undefined;
    return r?.endDate ? (r.endDate as string).slice(0, 10) : '';
  });

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

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(d => setUsers(d.users || []))
      .catch(() => {});
  }, []);

  const toggleParticipant = (userId: string) => {
    setParticipantIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const otherUsers = users.filter(u => u.id !== session?.user?.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startDate || !endDate) return;
    onSubmit({
      title, eventType, calendarType, allDay,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      notes: notes || null,
      location: location || null,
      participantIds,
      externalParticipants,
      repeat: repeatFreq ? { freq: repeatFreq, interval: 1, endDate: repeatEndDate || null } : null,
    });
  };

  const inputStyle = {
    borderColor: 'var(--border)',
    background: 'var(--background)',
    color: 'var(--text-primary)',
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Title *</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
          className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none"
          style={inputStyle}
          placeholder="Event title" />
      </div>

      {/* Type + Calendar */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Event Type</label>
          <select value={eventType} onChange={e => setEventType(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm" style={inputStyle}>
            {EVENT_TYPES.map(t => <option key={t} value={t}>{formatLabel(t)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Calendar</label>
          <select value={calendarType} onChange={e => setCalendarType(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm" style={inputStyle}>
            {CALENDAR_TYPES.map(t => <option key={t} value={t}>{formatLabel(t)}</option>)}
          </select>
        </div>
      </div>

      {/* All day */}
      <div className="flex items-center gap-2">
        <input type="checkbox" id="allDay" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
        <label htmlFor="allDay" className="text-sm" style={{ color: 'var(--text-primary)' }}>All day event</label>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Start *</label>
          <input type="datetime-local" value={startDate}
            onChange={e => {
              setStartDate(e.target.value);
              if (e.target.value && endDate <= e.target.value) {
                const d = new Date(e.target.value);
                d.setHours(d.getHours() + 1);
                const y = d.getFullYear();
                const mo = String(d.getMonth() + 1).padStart(2, '0');
                const da = String(d.getDate()).padStart(2, '0');
                const h = String(d.getHours()).padStart(2, '0');
                const mi = String(d.getMinutes()).padStart(2, '0');
                setEndDate(`${y}-${mo}-${da}T${h}:${mi}`);
              }
            }}
            required className="w-full px-3 py-2 border rounded-lg text-sm" style={inputStyle} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>End *</label>
          <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} required
            className="w-full px-3 py-2 border rounded-lg text-sm" style={inputStyle} />
        </div>
      </div>

      {/* Repeat */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          <RefreshCw size={13} className="inline mr-1.5 mb-0.5" />
          Repeat
        </label>
        <select
          value={repeatFreq}
          onChange={e => setRepeatFreq(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm"
          style={inputStyle}
        >
          <option value="">Does not repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        {repeatFreq && (
          <div className="mt-2">
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Ends on (leave blank for never)</label>
            <input
              type="date"
              value={repeatEndDate}
              onChange={e => setRepeatEndDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none"
              style={inputStyle}
            />
          </div>
        )}
      </div>

      {/* Participants */}
      {otherUsers.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            <Users size={13} className="inline mr-1.5 mb-0.5" />
            Participants
          </label>
          <div className="space-y-1">
            {otherUsers.map(u => {
              const selected = participantIds.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleParticipant(u.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-colors text-left"
                  style={{
                    borderColor: selected ? 'var(--brand-blue)' : 'var(--border)',
                    background: selected ? 'var(--brand-blue-subtle)' : 'transparent',
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                    style={{ backgroundColor: selected ? 'var(--brand-blue)' : 'var(--text-muted)' }}
                  >
                    {u.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{u.name}</div>
                    <div className="text-xs truncate capitalize" style={{ color: 'var(--text-muted)' }}>{u.role}</div>
                  </div>
                  {selected && (
                    <Check size={15} style={{ color: 'var(--brand-blue)', flexShrink: 0 }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* External Participants */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          <Mail size={13} className="inline mr-1.5 mb-0.5" />
          External Guests
          <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
            (email invite + .ics sent)
          </span>
        </label>

        {/* Existing external participants */}
        {externalParticipants.length > 0 && (
          <div className="space-y-1 mb-2">
            {externalParticipants.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
              >
                <UserPlus size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  {p.name && <span className="font-medium mr-1.5" style={{ color: 'var(--text-primary)' }}>{p.name}</span>}
                  <span style={{ color: 'var(--text-secondary)' }}>{p.email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setExternalParticipants(prev => prev.filter((_, idx) => idx !== i))}
                  className="p-0.5 rounded hover:opacity-60 transition-opacity"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new external participant */}
        <div className="flex gap-2">
          <input
            type="text"
            value={extName}
            onChange={e => setExtName(e.target.value)}
            placeholder="Name (optional)"
            className="px-3 py-2 border rounded-lg text-sm flex-1 min-w-0 focus:outline-none"
            style={inputStyle}
          />
          <input
            type="email"
            value={extEmail}
            onChange={e => setExtEmail(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (extEmail && extEmail.includes('@') && !externalParticipants.find(p => p.email === extEmail.toLowerCase())) {
                  setExternalParticipants(prev => [...prev, { email: extEmail.toLowerCase(), name: extName.trim() }]);
                  setExtEmail('');
                  setExtName('');
                }
              }
            }}
            placeholder="email@company.com"
            className="px-3 py-2 border rounded-lg text-sm flex-1 min-w-0 focus:outline-none"
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => {
              if (extEmail && extEmail.includes('@') && !externalParticipants.find(p => p.email === extEmail.toLowerCase())) {
                setExternalParticipants(prev => [...prev, { email: extEmail.toLowerCase(), name: extName.trim() }]);
                setExtEmail('');
                setExtName('');
              }
            }}
            className="px-3 py-2 rounded-lg text-sm font-medium flex-shrink-0 transition-opacity hover:opacity-80"
            style={{ background: 'var(--brand-blue)', color: '#fff' }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Location</label>
        <LocationAutocomplete value={location} onChange={setLocation} inputStyle={inputStyle}
          placeholder="Start typing a place — becomes a tap-to-open Maps link" />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full px-3 py-2 border rounded-lg text-sm resize-none" style={inputStyle}
          placeholder="Agenda or any notes..." />
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm border rounded-lg transition-opacity hover:opacity-70"
          style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
          style={{ backgroundColor: 'var(--brand-blue)' }}>
          {loading ? 'Saving...' : 'Save Event'}
        </button>
      </div>
    </form>
  );
}
