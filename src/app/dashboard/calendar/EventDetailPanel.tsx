'use client';

import { Clock, CalendarDays, RefreshCw, MapPin } from 'lucide-react';
import { CalEvent, EVENT_TYPE_CONFIG } from './calendarTypes';
import { formatTime, formatDateShort } from './calendarHelpers';

interface EventDetailPanelProps {
  event: CalEvent;
  onClose: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
}

export function EventDetailPanel({ event, onClose, onEdit, onDelete }: EventDetailPanelProps) {
  const cfg = EVENT_TYPE_CONFIG[event.eventType] ?? EVENT_TYPE_CONFIG.meeting;
  const noteLines = event.notes ? event.notes.split('\n').filter(Boolean) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-3 h-3 rounded-sm mt-1 flex-shrink-0" style={{ background: cfg.color }} />
        <div>
          <p className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>{event.title}</p>
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium mt-1"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {cfg.label}
          </span>
        </div>
      </div>

      {!event.allDay && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Clock size={14} />
          <span>{formatDateShort(event.startDate)} · {formatTime(event.startDate)} – {formatTime(event.endDate)}</span>
        </div>
      )}
      {event.allDay && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <CalendarDays size={14} />
          <span>{formatDateShort(event.startDate)} · All day</span>
        </div>
      )}

      {event.repeat?.freq && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <RefreshCw size={13} />
          <span>
            Repeats {event.repeat.freq}
            {event.repeat.endDate
              ? ` · until ${new Date(event.repeat.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
              : ''}
          </span>
        </div>
      )}

      {noteLines.length > 0 && (
        <div className="space-y-1">
          {noteLines.map((line, i) => (
            <div key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {line.startsWith('Location:') ? <MapPin size={14} className="mt-0.5 flex-shrink-0" /> : <span className="w-3.5" />}
              <span>{line.replace(/^(Location|Booked by|Notes):\s*/, (_, label) => label ? '' : _)}</span>
            </div>
          ))}
        </div>
      )}

      {event.owner && (
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Owner: </span>{event.owner.name}
        </div>
      )}

      {event.invites && event.invites.length > 0 && (
        <div className="text-sm">
          <span className="font-medium block mb-1" style={{ color: 'var(--text-primary)' }}>Internal Attendees</span>
          <div className="flex flex-wrap gap-1.5">
            {event.invites.map((inv) => (
              <span
                key={inv.invitee.id}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              >
                {inv.invitee.name ?? inv.invitee.id}
              </span>
            ))}
          </div>
        </div>
      )}

      {event.externalInvites && event.externalInvites.length > 0 && (
        <div className="text-sm">
          <span className="font-medium block mb-1" style={{ color: 'var(--text-primary)' }}>External Guests</span>
          <div className="space-y-1">
            {event.externalInvites.map((ei) => {
              const statusConfig = {
                accepted:  { label: 'Accepted',  color: '#16a34a', bg: '#f0fdf4',           border: '#bbf7d0' },
                declined:  { label: 'Declined',  color: '#dc2626', bg: '#fef2f2',           border: '#fecaca' },
                tentative: { label: 'Tentative', color: '#d97706', bg: '#fffbeb',           border: '#fde68a' },
                pending:   { label: 'Awaiting',  color: '#6b7280', bg: 'var(--surface)',    border: 'var(--border)' },
              }[ei.status] ?? { label: ei.status, color: '#6b7280', bg: 'var(--surface)', border: 'var(--border)' };
              return (
                <div
                  key={ei.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border text-xs"
                  style={{ borderColor: statusConfig.border, background: statusConfig.bg }}
                >
                  <div>
                    {ei.name && <span className="font-medium mr-1.5" style={{ color: 'var(--text-primary)' }}>{ei.name}</span>}
                    <span style={{ color: 'var(--text-secondary)' }}>{ei.email}</span>
                  </div>
                  <span className="font-semibold" style={{ color: statusConfig.color }}>{statusConfig.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={onEdit}
          className="px-4 py-2 text-sm text-white rounded-lg"
          style={{ background: 'var(--brand-blue)' }}
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(event.id)}
          className="px-4 py-2 text-sm text-white rounded-lg"
          style={{ background: 'var(--status-danger)' }}
        >
          Delete
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm border rounded-lg"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
