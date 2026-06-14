'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { CalendarForm } from '../CalendarForm';

const EVENT_COLORS: Record<string, string> = {
  meeting: '#3b82f6', site_survey: '#8b5cf6', follow_up: '#f59e0b', calendly: '#10b981', personal: '#6b7280',
};
const INVITE_COLORS: Record<string, string> = {
  pending: '#f59e0b', accepted: '#10b981', declined: '#ef4444',
};

function formatLabel(s: string) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function CalendarEventDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<Record<string, unknown> | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/calendar/' + id).then(r => r.json()).then(setEvent);
  }, [id]);

  const handleUpdate = async (data: Record<string, unknown>) => {
    setSaving(true);
    const res = await fetch('/api/calendar/' + id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { const updated = await res.json(); setEvent(updated); setShowEdit(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this event?')) return;
    await fetch('/api/calendar/' + id, { method: 'DELETE' });
    router.push('/dashboard/calendar');
  };

  const handleInviteResponse = async (status: string) => {
    await fetch('/api/calendar/' + id + '/invite', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    const res = await fetch('/api/calendar/' + id);
    setEvent(await res.json());
  };

  if (!event) return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading...</p>;

  const invites = (event.invites as Array<{ id: string; status: string; invitee: { id: string; name: string } }>) || [];

  return (
    <div>
      <button onClick={() => router.push('/dashboard/calendar')}
        className="text-sm mb-4 hover:underline" style={{ color: 'var(--brand-blue)' }}>← Back to Calendar</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{event.title as string}</h1>
          <div className="flex gap-2 mt-2">
            <Badge color={EVENT_COLORS[(event.eventType as string)] || '#6b7280'}>{formatLabel(event.eventType as string)}</Badge>
            <Badge color={event.calendarType === 'personal' ? '#6b7280' : 'var(--brand-blue)'}>{formatLabel(event.calendarType as string)}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowEdit(true)}
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50" style={{ borderColor: 'var(--border)' }}>Edit</button>
          <button onClick={handleDelete}
            className="px-3 py-1.5 text-sm text-white rounded-lg" style={{ backgroundColor: '#ef4444' }}>Delete</button>
        </div>
      </div>

      <div className="border rounded-xl p-6 space-y-3 mb-4" style={{ borderColor: 'var(--border)' }}>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span style={{ color: 'var(--text-secondary)' }}>Start:</span> <span className="ml-2 font-medium">{formatDateTime(event.startDate as string)}</span></div>
          <div><span style={{ color: 'var(--text-secondary)' }}>End:</span> <span className="ml-2 font-medium">{formatDateTime(event.endDate as string)}</span></div>
          <div><span style={{ color: 'var(--text-secondary)' }}>All Day:</span> <span className="ml-2">{event.allDay ? 'Yes' : 'No'}</span></div>
          <div><span style={{ color: 'var(--text-secondary)' }}>Owner:</span> <span className="ml-2">{String((event.owner as Record<string, unknown>)?.name || '—')}</span></div>
        </div>
        {typeof event.location === 'string' && event.location && (
          <div className="pt-2 border-t text-sm" style={{ borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Location:</span>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location as string)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 underline"
              style={{ color: '#2056A4' }}
            >
              {event.location as string} · Open in Maps
            </a>
          </div>
        )}
        {typeof event.notes === 'string' && event.notes && (
          <div className="pt-2 border-t text-sm" style={{ borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Notes:</span>
            <p className="mt-1 whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{event.notes as string}</p>
          </div>
        )}
      </div>

      {/* Invites */}
      {event.calendarType === 'shared' && (
        <div className="border rounded-xl p-6" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Invitees</h3>
          {invites.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No invitees yet.</p>
          ) : (
            <div className="space-y-2">
              {invites.map(inv => (
                <div key={inv.id} className="flex items-center justify-between text-sm">
                  <span>{inv.invitee.name}</span>
                  <Badge color={INVITE_COLORS[inv.status] || '#6b7280'}>{formatLabel(inv.status)}</Badge>
                </div>
              ))}
            </div>
          )}
          {/* Accept/Decline if user has pending invite */}
          <div className="flex gap-2 mt-3">
            <button onClick={() => handleInviteResponse('accepted')}
              className="px-3 py-1 text-xs text-white rounded" style={{ backgroundColor: '#10b981' }}>Accept</button>
            <button onClick={() => handleInviteResponse('declined')}
              className="px-3 py-1 text-xs text-white rounded" style={{ backgroundColor: '#ef4444' }}>Decline</button>
          </div>
        </div>
      )}

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Event">
        <CalendarForm initialData={event} onSubmit={handleUpdate} onCancel={() => setShowEdit(false)} loading={saving} />
      </Modal>
    </div>
  );
}
