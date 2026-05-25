'use client';

import { useRouter } from 'next/navigation';
import { CalEvent, CalTask, DAYS_SHORT } from './calendarTypes';
import { dateKey, getMonthDays } from './calendarHelpers';
import { EventChip } from './EventChip';

interface MonthViewProps {
  year: number;
  month: number;
  events: CalEvent[];
  tasks: CalTask[];
  todayKey: string;
  onDayClick: (key: string) => void;
  onEventClick: (e: CalEvent) => void;
  selectedIds: Set<string>;
  selectMode: boolean;
}

export function MonthView({
  year,
  month,
  events,
  tasks,
  todayKey,
  onDayClick,
  onEventClick,
  selectedIds,
}: MonthViewProps) {
  const router = useRouter();
  const days = getMonthDays(year, month);

  const eventsByDate: Record<string, CalEvent[]> = {};
  for (const ev of events) {
    const key = ev.startDate.slice(0, 10);
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key].push(ev);
  }
  const tasksByDate: Record<string, CalTask[]> = {};
  for (const t of tasks) {
    const key = t.dueDate.slice(0, 10);
    if (!tasksByDate[key]) tasksByDate[key] = [];
    tasksByDate[key].push(t);
  }

  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <div className="overflow-x-auto">
        <div style={{ minWidth: 560 }}>
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            {DAYS_SHORT.map((d) => (
              <div key={d} className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{d}</div>
            ))}
          </div>
          {/* Weeks */}
          {Array.from({ length: days.length / 7 }, (_, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
              {days.slice(weekIdx * 7, weekIdx * 7 + 7).map((day, i) => {
                const key = dateKey(day.date);
                const isToday = key === todayKey;
                const dayEvents = (eventsByDate[key] || []).sort((a, b) => a.startDate.localeCompare(b.startDate));
                const dayTasks = tasksByDate[key] || [];
                const overflow = dayEvents.length + dayTasks.length > 4;
                return (
                  <div
                    key={i}
                    className="min-h-[110px] p-1.5 border-r last:border-r-0 cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
                    style={{
                      borderColor: 'var(--border)',
                      background: isToday
                        ? 'color-mix(in srgb, var(--brand-blue) 6%, var(--surface))'
                        : day.inMonth ? 'var(--surface)' : 'var(--background)',
                    }}
                    onClick={() => onDayClick(key)}
                  >
                    <div className="flex justify-end mb-1">
                      <span
                        className="text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full"
                        style={{
                          color: isToday ? '#fff' : day.inMonth ? 'var(--text-primary)' : 'var(--text-muted)',
                          background: isToday ? 'var(--brand-blue)' : 'transparent',
                        }}
                      >
                        {day.date.getDate()}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <EventChip
                          key={ev.id}
                          event={ev}
                          compact
                          selected={selectedIds.has(ev.id)}
                          onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                        />
                      ))}
                      {dayTasks.slice(0, overflow ? 1 : 2).map((t) => (
                        <button
                          key={t.id}
                          className="w-full text-left rounded px-1 py-0.5 truncate text-[11px] border border-dashed hover:opacity-80"
                          style={{ borderColor: 'var(--text-secondary)', color: 'var(--text-secondary)' }}
                          onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/tasks/${t.id}`); }}
                          title={t.subject}
                        >
                          ✓ {t.subject}
                        </button>
                      ))}
                      {overflow && (
                        <div className="text-[10px] font-medium px-1" style={{ color: 'var(--text-secondary)' }}>
                          +{dayEvents.length + dayTasks.length - 4} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
