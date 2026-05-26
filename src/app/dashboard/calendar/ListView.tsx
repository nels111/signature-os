'use client';

import { useRouter } from 'next/navigation';
import { CalendarDays, Clock, MapPin, CheckCircle2 } from 'lucide-react';
import { CalEvent, CalTask, EVENT_TYPE_CONFIG, DAYS_LONG, MONTHS_SHORT } from './calendarTypes';
import { dateKey, formatTime } from './calendarHelpers';

interface ListViewProps {
  events: CalEvent[];
  tasks: CalTask[];
  onEventClick: (e: CalEvent) => void;
  selectedIds: Set<string>;
  selectMode: boolean;
}

export function ListView({ events, tasks, onEventClick, selectedIds }: ListViewProps) {
  const router = useRouter();

  // Group by date
  const dateSet = new Set<string>();
  for (const ev of events) dateSet.add(ev.startDate.slice(0, 10));
  for (const t of tasks) dateSet.add(t.dueDate.slice(0, 10));

  const sorted = Array.from(dateSet).sort();
  const items = sorted.map((date) => ({
    date,
    events: events.filter((e) => e.startDate.slice(0, 10) === date).sort((a, b) => a.startDate.localeCompare(b.startDate)),
    tasks:  tasks.filter((t) => t.dueDate.slice(0, 10) === date),
  }));

  if (items.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
        <CalendarDays size={32} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">No events this month.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map(({ date, events: dayEvents, tasks: dayTasks }) => {
        const d = new Date(date + 'T00:00:00');
        const isToday = date === dateKey(new Date());
        return (
          <div key={date} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {/* Date header */}
            <div
              className="px-4 py-2 flex items-center gap-3"
              style={{ background: isToday ? 'var(--brand-blue)' : 'var(--surface)', borderBottom: '1px solid var(--border)' }}
            >
              <span className="text-sm font-bold" style={{ color: isToday ? '#fff' : 'var(--text-primary)' }}>
                {DAYS_LONG[(d.getDay() + 6) % 7]}
              </span>
              <span className="text-sm" style={{ color: isToday ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)' }}>
                {d.getDate()} {MONTHS_SHORT[d.getMonth()]} {d.getFullYear()}
              </span>
              {isToday && (
                <span className="ml-auto text-xs font-semibold text-white bg-white/20 px-2 py-0.5 rounded-full">Today</span>
              )}
            </div>
            {/* Items */}
            <div className="divide-y divide-[var(--border)]">
              {dayEvents.map((ev) => {
                const cfg = EVENT_TYPE_CONFIG[ev.eventType] ?? EVENT_TYPE_CONFIG.meeting;
                const isSelected = selectedIds.has(ev.id);
                return (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors"
                    style={{
                      background: isSelected ? 'color-mix(in srgb, #1e40af 8%, var(--surface))' : 'var(--surface)',
                      outline: isSelected ? '2px solid #1e40af' : 'none',
                      outlineOffset: isSelected ? '-2px' : '0',
                    }}
                  >
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: isSelected ? '#1e40af' : cfg.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                        {isSelected && <CheckCircle2 size={14} style={{ color: '#1e40af', flexShrink: 0 }} />}
                        {ev.title}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {!ev.allDay && (
                          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <Clock size={11} />
                            {formatTime(ev.startDate)} – {formatTime(ev.endDate)}
                          </span>
                        )}
                        {ev.notes && ev.notes.includes('Location:') && (
                          <span className="flex items-center gap-1 text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                            <MapPin size={11} />
                            {ev.notes.split('\n').find((l) => l.startsWith('Location:'))?.replace('Location: ', '')}
                          </span>
                        )}
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{ background: cfg.bg, color: cfg.color }}
                        >
                          {cfg.label}
                        </span>
                        {ev.owner && (
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{ev.owner.name}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {dayTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => router.push(`/dashboard/tasks/${t.id}`)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: 'var(--text-secondary)', opacity: 0.4 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>✓ {t.subject}</p>
                    <span className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: 'var(--text-muted)' }}>Task due</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
