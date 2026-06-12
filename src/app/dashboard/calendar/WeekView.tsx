'use client';

import { useRouter } from 'next/navigation';
import { CalEvent, CalTask, DAYS_SHORT } from './calendarTypes';
import { dateKey, formatTime } from './calendarHelpers';
import { EventChip } from './EventChip';

interface WeekViewProps {
  weekDays: Date[];
  events: CalEvent[];
  tasks: CalTask[];
  todayKey: string;
  onDayClick: (key: string) => void;
  onEventClick: (e: CalEvent) => void;
  selectedIds: Set<string>;
  selectMode: boolean;
}

export function WeekView({
  weekDays,
  events,
  tasks,
  todayKey,
  onDayClick,
  onEventClick,
  selectedIds,
}: WeekViewProps) {
  const router = useRouter();
  const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00 – 22:00

  // Group events by day
  const byDay: Record<string, CalEvent[]> = {};
  const allDayByDay: Record<string, CalEvent[]> = {};
  for (const day of weekDays) {
    const key = dateKey(day);
    byDay[key] = [];
    allDayByDay[key] = [];
  }
  for (const ev of events) {
    const key = ev.startDate.slice(0, 10);
    if (byDay[key]) {
      if (ev.allDay) allDayByDay[key].push(ev);
      else byDay[key].push(ev);
    }
  }
  const tasksByDay: Record<string, CalTask[]> = {};
  for (const t of tasks) {
    const key = t.dueDate.slice(0, 10);
    if (!tasksByDay[key]) tasksByDay[key] = [];
    tasksByDay[key].push(t);
  }

  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <div className="overflow-x-auto">
        <div style={{ minWidth: 560 }}>
          {/* Day headers */}
          <div className="grid border-b" style={{
            gridTemplateColumns: '56px repeat(7, 1fr)',
            borderColor: 'var(--border)',
            background: 'var(--surface)',
          }}>
            <div style={{ borderRight: '1px solid var(--border)' }} />
            {weekDays.map((day) => {
              const key = dateKey(day);
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  className="px-2 py-2.5 text-center border-r last:border-r-0"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                    {DAYS_SHORT[(day.getDay() + 6) % 7]}
                  </div>
                  <div
                    className="text-lg font-bold mt-0.5 w-8 h-8 flex items-center justify-center mx-auto rounded-full"
                    style={{
                      color: isToday ? '#fff' : 'var(--text-primary)',
                      background: isToday ? 'var(--brand-blue)' : 'transparent',
                    }}
                  >
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* All-day row */}
          {weekDays.some((d) => (allDayByDay[dateKey(d)] ?? []).length > 0) && (
            <div className="grid border-b" style={{
              gridTemplateColumns: '56px repeat(7, 1fr)',
              borderColor: 'var(--border)',
              background: 'var(--surface-hover)',
            }}>
              <div className="text-[10px] font-medium px-1.5 py-1 self-center" style={{ color: 'var(--text-secondary)', borderRight: '1px solid var(--border)' }}>
                All day
              </div>
              {weekDays.map((day) => {
                const key = dateKey(day);
                return (
                  <div key={key} className="px-1 py-1 space-y-0.5 border-r last:border-r-0 min-h-[28px]" style={{ borderColor: 'var(--border)' }}>
                    {(allDayByDay[key] ?? []).map((ev) => (
                      <EventChip key={ev.id} event={ev} compact selected={selectedIds.has(ev.id)} onClick={(e) => { e.stopPropagation(); onEventClick(ev); }} />
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* Time grid — single page-level scroll (no nested overflow-y) to avoid
              the iOS nested-scroll trap. */}
          <div style={{ minWidth: 560 }}>
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="grid border-b last:border-b-0"
                style={{ gridTemplateColumns: '56px repeat(7, 1fr)', borderColor: 'var(--border)', minHeight: 56 }}
              >
                <div
                  className="text-[11px] font-medium px-1.5 pt-1 text-right flex-shrink-0"
                  style={{ color: 'var(--text-secondary)', borderRight: '1px solid var(--border)' }}
                >
                  {String(hour).padStart(2, '0')}:00
                </div>
                {weekDays.map((day) => {
                  const key = dateKey(day);
                  const isToday = key === todayKey;
                  const hourEvents = (byDay[key] ?? []).filter((ev) => new Date(ev.startDate).getHours() === hour);
                  const hourTasks = hour === 9 ? (tasksByDay[key] ?? []) : [];
                  return (
                    <div
                      key={key}
                      className="border-r last:border-r-0 px-0.5 py-0.5 cursor-pointer relative"
                      style={{
                        borderColor: 'var(--border)',
                        background: isToday ? 'var(--surface-hover)' : 'var(--surface)',
                      }}
                      onClick={() => onDayClick(key)}
                    >
                      <div className="space-y-0.5">
                        {hourEvents.map((ev) => (
                          <EventChip key={ev.id} event={ev} compact selected={selectedIds.has(ev.id)} onClick={(e) => { e.stopPropagation(); onEventClick(ev); }} />
                        ))}
                        {hourTasks.map((t) => (
                          <button
                            key={t.id}
                            onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/tasks/${t.id}`); }}
                            className="w-full text-left rounded px-1 py-0.5 truncate text-[11px] border border-dashed hover:opacity-80"
                            style={{ borderColor: 'var(--text-secondary)', color: 'var(--text-secondary)' }}
                            title={t.subject}
                          >
                            ✓ {t.subject}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
