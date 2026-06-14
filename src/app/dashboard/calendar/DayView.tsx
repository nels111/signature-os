'use client';

import { useRouter } from 'next/navigation';
import { Clock, MapPin, User, CalendarDays, CheckCircle2 } from 'lucide-react';
import { CalEvent, CalTask, EVENT_TYPE_CONFIG, DAYS_SHORT, DAYS_LONG, MONTHS_SHORT } from './calendarTypes';
import { dateKey, formatTime } from './calendarHelpers';

interface DayViewProps {
  weekDays: Date[];
  selectedKey: string;
  events: CalEvent[];
  tasks: CalTask[];
  todayKey: string;
  onSelectDay: (key: string) => void;
  onEventClick: (e: CalEvent) => void;
  selectedIds: Set<string>;
}

function eventLocation(ev: CalEvent): string | null {
  if (ev.location) return ev.location;
  if (ev.notes && ev.notes.includes('Location:')) {
    return ev.notes.split('\n').find((l) => l.startsWith('Location:'))?.replace('Location: ', '') ?? null;
  }
  return null;
}

function mapsHref(loc: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`;
}

export function DayView({
  weekDays,
  selectedKey,
  events,
  tasks,
  todayKey,
  onSelectDay,
  onEventClick,
  selectedIds,
}: DayViewProps) {
  const router = useRouter();

  // Which days in the strip have something on them (for the dot indicator)
  const eventDays = new Set<string>();
  for (const ev of events) eventDays.add(ev.startDate.slice(0, 10));
  const taskDays = new Set<string>();
  for (const t of tasks) taskDays.add(t.dueDate.slice(0, 10));

  const dayEvents = events
    .filter((e) => e.startDate.slice(0, 10) === selectedKey)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const dayTasks = tasks.filter((t) => t.dueDate.slice(0, 10) === selectedKey);

  const selDate = new Date(selectedKey + 'T00:00:00');
  const selLabel = `${DAYS_LONG[(selDate.getDay() + 6) % 7]} ${selDate.getDate()} ${MONTHS_SHORT[selDate.getMonth()]}`;

  return (
    <div>
      {/* Week strip */}
      <div
        className="grid rounded-xl overflow-hidden mb-4"
        style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', border: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        {weekDays.map((day) => {
          const key = dateKey(day);
          const isSelected = key === selectedKey;
          const isToday = key === todayKey;
          const has = eventDays.has(key) || taskDays.has(key);
          return (
            <button
              key={key}
              onClick={() => onSelectDay(key)}
              className="flex flex-col items-center gap-1 py-2.5 transition-colors"
              style={{ background: 'transparent' }}
            >
              <span
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: isSelected ? 'var(--brand-blue)' : 'var(--text-secondary)' }}
              >
                {DAYS_SHORT[(day.getDay() + 6) % 7]}
              </span>
              <span
                className="text-base font-bold w-9 h-9 flex items-center justify-center rounded-xl"
                style={{
                  color: isSelected ? '#fff' : isToday ? 'var(--brand-blue)' : 'var(--text-primary)',
                  background: isSelected ? 'var(--brand-blue)' : 'transparent',
                  boxShadow: !isSelected && isToday ? 'inset 0 0 0 1.5px var(--brand-blue)' : 'none',
                }}
              >
                {day.getDate()}
              </span>
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: has ? (isSelected ? 'var(--brand-blue)' : 'var(--text-secondary)') : 'transparent' }}
              />
            </button>
          );
        })}
      </div>

      {/* Selected-day heading */}
      <div className="flex items-baseline justify-between mb-2 px-0.5">
        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{selLabel}</h3>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
          {dayTasks.length > 0 ? ` · ${dayTasks.length} task${dayTasks.length !== 1 ? 's' : ''}` : ''}
        </span>
      </div>

      {/* Day agenda */}
      {dayEvents.length === 0 && dayTasks.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ color: 'var(--text-secondary)', border: '1px dashed var(--border)' }}>
          <CalendarDays size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nothing scheduled.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dayEvents.map((ev) => {
            const cfg = EVENT_TYPE_CONFIG[ev.eventType] ?? EVENT_TYPE_CONFIG.meeting;
            const isSelected = selectedIds.has(ev.id);
            const loc = eventLocation(ev);
            return (
              <div
                key={ev.id}
                onClick={() => onEventClick(ev)}
                className="flex items-stretch gap-3 rounded-xl p-3 cursor-pointer transition-shadow hover:shadow-sm"
                style={{
                  background: 'var(--surface)',
                  border: isSelected ? '2px solid var(--brand-blue)' : '1px solid var(--border)',
                }}
              >
                {/* Time column */}
                <div className="flex flex-col items-start justify-start w-14 flex-shrink-0 pt-0.5">
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {ev.allDay ? 'All' : formatTime(ev.startDate)}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {ev.allDay ? 'day' : formatTime(ev.endDate)}
                  </span>
                </div>

                {/* Colour spine */}
                <div className="w-1 rounded-full flex-shrink-0" style={{ background: isSelected ? 'var(--brand-blue)' : cfg.color }} />

                {/* Main */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                    {isSelected && <CheckCircle2 size={14} style={{ color: 'var(--brand-blue)', flexShrink: 0 }} />}
                    {ev.title}
                  </p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                    {ev.owner?.name && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <User size={11} /> {ev.owner.name}
                      </span>
                    )}
                    {loc && (
                      <span className="flex items-center gap-1 text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                        <MapPin size={11} /> {loc}
                      </span>
                    )}
                  </div>
                </div>

                {/* Location pin → Maps */}
                {loc && (
                  <a
                    href={mapsHref(loc)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Open in Maps"
                    title="Open in Maps"
                    className="flex-shrink-0 w-10 h-10 self-center flex items-center justify-center rounded-full text-white transition-opacity hover:opacity-90"
                    style={{ background: 'var(--brand-blue)' }}
                  >
                    <MapPin size={18} />
                  </a>
                )}
              </div>
            );
          })}

          {dayTasks.map((t) => (
            <button
              key={t.id}
              onClick={() => router.push(`/dashboard/tasks/${t.id}`)}
              className="w-full flex items-center gap-3 rounded-xl p-3 text-left transition-shadow hover:shadow-sm"
              style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}
            >
              <Clock size={14} className="flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>✓ {t.subject}</p>
                <span className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: 'var(--text-muted)' }}>Task due</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
