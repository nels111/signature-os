'use client';

import { CheckCircle2 } from 'lucide-react';
import { CalEvent, EVENT_TYPE_CONFIG } from './calendarTypes';
import { formatTime } from './calendarHelpers';

export function EventChip({
  event,
  compact,
  onClick,
  selected,
}: {
  event: CalEvent;
  compact?: boolean;
  onClick: (e: React.MouseEvent) => void;
  selected?: boolean;
}) {
  const cfg = EVENT_TYPE_CONFIG[event.eventType] ?? EVENT_TYPE_CONFIG.meeting;
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded px-1.5 py-0.5 truncate transition-all hover:opacity-80 relative"
      style={{
        background: selected ? '#1e40af' : cfg.color,
        color: '#fff',
        fontSize: compact ? 11 : 12,
        outline: selected ? '2px solid #fff' : 'none',
        outlineOffset: selected ? '-2px' : '0',
      }}
      title={event.title}
    >
      {selected && <CheckCircle2 size={10} className="inline mr-1 opacity-90" />}
      {!selected && !event.allDay && <span className="opacity-80 mr-1">{formatTime(event.startDate)}</span>}
      {event.title}
    </button>
  );
}

export function EventLegend() {
  return (
    <div className="flex flex-wrap gap-3">
      {Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => (
        <div key={key} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: cfg.color }} />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{cfg.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-sm border border-dashed" style={{ borderColor: 'var(--text-secondary)' }} />
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Task due</span>
      </div>
    </div>
  );
}
