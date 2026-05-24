'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { CalendarForm } from './CalendarForm';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  List,
  LayoutGrid,
  Plus,
  MapPin,
  Clock,
  Trash2,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

// ---------- Types ----------
interface CalEvent {
  id: string;
  title: string;
  eventType: string;
  calendarType: string;
  allDay: boolean;
  startDate: string;
  endDate: string;
  notes: string | null;
  repeat?: { freq: string; endDate?: string | null } | null;
  owner: { id: string; name: string | null } | null;
  invites?: Array<{ invitee: { id: string; name: string | null }; status: string }>;
  externalInvites?: Array<{ id: string; email: string; name: string | null; status: string }>;
}

interface CalTask {
  id: string;
  subject: string;
  dueDate: string;
  priority: string;
  status: string;
}

// ---------- Constants ----------
const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  meeting:     { label: 'Meeting',      color: '#1a56db', bg: '#1a56db18' },
  site_survey: { label: 'Site Survey',  color: '#7c3aed', bg: '#7c3aed18' },
  follow_up:   { label: 'Follow-up',    color: '#f59e0b', bg: '#f59e0b18' },
  calendly:    { label: 'Calendly',     color: '#06b6d4', bg: '#06b6d418' },
  personal:    { label: 'Personal',     color: '#6b7280', bg: '#6b728018' },
};

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_LONG  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS     = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type ViewMode = 'month' | 'week' | 'list';

// ---------- Helpers ----------
function dateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const days: { date: Date; inMonth: boolean }[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month, -i), inMonth: false });
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), inMonth: true });
  }
  while (days.length % 7 !== 0) {
    const d = new Date(year, month + 1, days.length - startOffset - lastDay.getDate() + 1);
    days.push({ date: d, inMonth: false });
  }
  return days;
}

function getWeekDays(baseDate: Date): Date[] {
  const d = new Date(baseDate);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return day;
  });
}

// ---------- Sub-components ----------

function EventChip({
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

function EventLegend() {
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

// ---------- Week View ----------
function WeekView({
  weekDays,
  events,
  tasks,
  todayKey,
  onDayClick,
  onEventClick,
  selectedIds,
  selectMode,
}: {
  weekDays: Date[];
  events: CalEvent[];
  tasks: CalTask[];
  todayKey: string;
  onDayClick: (key: string) => void;
  onEventClick: (e: CalEvent) => void;
  selectedIds: Set<string>;
  selectMode: boolean;
}) {
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

      {/* Time grid */}
      <div className="overflow-y-auto" style={{ maxHeight: '60vh', minWidth: 560 }}>
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
              const hourEvents = (byDay[key] ?? []).filter((ev) => {
                const h = new Date(ev.startDate).getHours();
                return h === hour;
              });
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

// ---------- Month View ----------
function MonthView({
  year,
  month,
  events,
  tasks,
  todayKey,
  onDayClick,
  onEventClick,
  selectedIds,
  selectMode,
}: {
  year: number;
  month: number;
  events: CalEvent[];
  tasks: CalTask[];
  todayKey: string;
  onDayClick: (key: string) => void;
  onEventClick: (e: CalEvent) => void;
  selectedIds: Set<string>;
  selectMode: boolean;
}) {
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

// ---------- List View ----------
function ListView({
  events,
  tasks,
  onEventClick,
  selectedIds,
  selectMode,
}: {
  events: CalEvent[];
  tasks: CalTask[];
  onEventClick: (e: CalEvent) => void;
  selectedIds: Set<string>;
  selectMode: boolean;
}) {
  const router = useRouter();

  // Group by date
  const items: Array<{ date: string; events: CalEvent[]; tasks: CalTask[] }> = [];
  const dateSet = new Set<string>();

  for (const ev of events) dateSet.add(ev.startDate.slice(0, 10));
  for (const t of tasks) dateSet.add(t.dueDate.slice(0, 10));

  const sorted = Array.from(dateSet).sort();
  for (const d of sorted) {
    items.push({
      date: d,
      events: events.filter((e) => e.startDate.slice(0, 10) === d).sort((a, b) => a.startDate.localeCompare(b.startDate)),
      tasks: tasks.filter((t) => t.dueDate.slice(0, 10) === d),
    });
  }

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
        const todayStr = dateKey(new Date());
        const isToday = date === todayStr;
        return (
          <div key={date} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {/* Date header */}
            <div
              className="px-4 py-2 flex items-center gap-3"
              style={{ background: isToday ? 'var(--brand-blue)' : 'var(--surface)', borderBottom: '1px solid var(--border)' }}
            >
              <span className={`text-sm font-bold ${isToday ? 'text-white' : ''}`} style={{ color: isToday ? '#fff' : 'var(--text-primary)' }}>
                {DAYS_LONG[(d.getDay() + 6) % 7]}
              </span>
              <span className={`text-sm ${isToday ? 'text-white opacity-80' : ''}`} style={{ color: isToday ? '#fff' : 'var(--text-secondary)' }}>
                {d.getDate()} {MONTHS_SHORT[d.getMonth()]} {d.getFullYear()}
              </span>
              {isToday && (
                <span className="ml-auto text-xs font-semibold text-white bg-white/20 px-2 py-0.5 rounded-full">Today</span>
              )}
            </div>
            {/* Events */}
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
                      borderBottom: '1px solid var(--border)',
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

// ---------- Event Detail Panel ----------
function EventDetailPanel({
  event,
  onClose,
  onEdit,
  onDelete,
}: {
  event: CalEvent;
  onClose: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
}) {
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
              <span>{line.replace(/^(Location|Booked by|Notes):\s*/, (m, label) => label ? '' : m)}</span>
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
                accepted: { label: 'Accepted', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
                declined: { label: 'Declined', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
                tentative: { label: 'Tentative', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
                pending: { label: 'Awaiting', color: '#6b7280', bg: 'var(--surface)', border: 'var(--border)' },
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

// ---------- Main Page ----------
export function CalendarPage() {
  const now = new Date();
  const [view, setView] = useState<ViewMode>('week');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [weekBase, setWeekBase] = useState(now); // base date for week view
  const [filter, setFilter] = useState<'all' | 'shared' | 'personal'>('all');
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [tasks, setTasks] = useState<CalTask[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [detailEvent, setDetailEvent] = useState<CalEvent | null>(null);
  const [editEvent, setEditEvent] = useState<CalEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const weekDays = getWeekDays(weekBase);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      let start: string;
      let end: string;
      if (view === 'week') {
        start = new Date(weekDays[0].getFullYear(), weekDays[0].getMonth(), weekDays[0].getDate()).toISOString();
        end   = new Date(weekDays[6].getFullYear(), weekDays[6].getMonth(), weekDays[6].getDate(), 23, 59, 59).toISOString();
      } else {
        start = new Date(year, month, 1).toISOString();
        end   = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      }
      const params = new URLSearchParams({ start, end });
      if (filter !== 'all') params.set('calendarType', filter);
      const res = await fetch('/api/calendar?' + params.toString());
      const json = await res.json();
      if (!cancelled) {
        setEvents(json.events || []);
        setTasks(json.tasks || []);
        setLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, view, weekBase, filter, refreshKey]);

  const goTodayMonthWeek = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setWeekBase(now);
  };

  const prevPeriod = () => {
    if (view === 'week') {
      const d = new Date(weekBase);
      d.setDate(d.getDate() - 7);
      setWeekBase(d);
    } else {
      if (month === 0) { setMonth(11); setYear((y) => y - 1); }
      else setMonth((m) => m - 1);
    }
  };

  const nextPeriod = () => {
    if (view === 'week') {
      const d = new Date(weekBase);
      d.setDate(d.getDate() + 7);
      setWeekBase(d);
    } else {
      if (month === 11) { setMonth(0); setYear((y) => y + 1); }
      else setMonth((m) => m + 1);
    }
  };

  const handleCreate = async (data: Record<string, unknown>) => {
    setSaving(true);
    const res = await fetch('/api/calendar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setShowCreate(false); setRefreshKey((k) => k + 1); }
  };

  const handleEdit = async (data: Record<string, unknown>) => {
    if (!editEvent) return;
    setSaving(true);
    const res = await fetch(`/api/calendar/${editEvent.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setEditEvent(null); setDetailEvent(null); setRefreshKey((k) => k + 1); }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Delete this event? This cannot be undone.')) return;
    await fetch(`/api/calendar/${eventId}`, { method: 'DELETE' });
    setDetailEvent(null);
    setRefreshKey((k) => k + 1);
  };

  const toggleSelectEvent = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} event${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    await Promise.all(
      Array.from(selectedIds).map(id => fetch(`/api/calendar/${id}`, { method: 'DELETE' }))
    );
    setBulkDeleting(false);
    setSelectedIds(new Set());
    setSelectMode(false);
    setRefreshKey(k => k + 1);
  };

  const handleDayClick = (key: string) => {
    setSelectedDate(key);
    setShowCreate(true);
  };

  const handleEventClick = (ev: CalEvent) => {
    if (selectMode) { toggleSelectEvent(ev.id); return; }
    setDetailEvent(ev);
  };

  const periodLabel = view === 'week'
    ? (() => {
        const start = weekDays[0];
        const end = weekDays[6];
        if (start.getMonth() === end.getMonth()) {
          return `${start.getDate()}–${end.getDate()} ${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
        }
        return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]} ${end.getFullYear()}`;
      })()
    : `${MONTHS[month]} ${year}`;

  const todayKey = dateKey(now);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Calendar</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {loading ? 'Loading...' : `${events.length} event${events.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            {([
              { key: 'week', icon: CalendarDays, label: 'Week' },
              { key: 'month', icon: LayoutGrid, label: 'Month' },
              { key: 'list', icon: List, label: 'List' },
            ] as const).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  background: view === key ? 'var(--brand-blue)' : 'var(--surface)',
                  color: view === key ? '#fff' : 'var(--text-secondary)',
                  borderRight: key !== 'list' ? '1px solid var(--border)' : 'none',
                }}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Calendar type filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-3 py-1.5 text-sm border rounded-lg"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
          >
            <option value="all">All calendars</option>
            <option value="shared">Shared only</option>
            <option value="personal">Personal only</option>
          </select>

          <button
            onClick={() => { setSelectedDate(''); setShowCreate(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white rounded-lg"
            style={{ backgroundColor: 'var(--brand-blue)' }}
          >
            <Plus size={14} />
            <span>New Event</span>
          </button>

          <button
            onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-all"
            style={{
              borderColor: selectMode ? 'var(--status-danger)' : 'var(--border)',
              background: selectMode ? '#fef2f2' : 'var(--surface)',
              color: selectMode ? 'var(--status-danger)' : 'var(--text-secondary)',
            }}
          >
            <Trash2 size={13} />
            <span className="hidden sm:inline">{selectMode ? 'Cancel' : 'Select'}</span>
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={prevPeriod}
            className="p-2 rounded-lg border transition-all"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={nextPeriod}
            className="p-2 rounded-lg border transition-all"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' }}
          >
            <ChevronRight size={16} />
          </button>
          <h2 className="text-base font-semibold ml-1" style={{ color: 'var(--text-primary)' }}>
            {periodLabel}
          </h2>
        </div>
        <button
          onClick={goTodayMonthWeek}
          className="px-3 py-1.5 text-xs font-medium border rounded-lg transition-all"
          style={{ borderColor: 'var(--brand-blue)', color: 'var(--brand-blue)', background: 'var(--surface)' }}
        >
          Today
        </button>
      </div>

      {/* Legend */}
      <div className="mb-3">
        <EventLegend />
      </div>

      {/* View */}
      {view === 'week' && (
        <WeekView
          weekDays={weekDays}
          events={events}
          tasks={tasks}
          todayKey={todayKey}
          onDayClick={handleDayClick}
          onEventClick={handleEventClick}
          selectedIds={selectedIds}
          selectMode={selectMode}
        />
      )}
      {view === 'month' && (
        <MonthView
          year={year}
          month={month}
          events={events}
          tasks={tasks}
          todayKey={todayKey}
          onDayClick={handleDayClick}
          onEventClick={handleEventClick}
          selectedIds={selectedIds}
          selectMode={selectMode}
        />
      )}
      {view === 'list' && (
        <ListView
          events={events}
          tasks={tasks}
          onEventClick={handleEventClick}
          selectedIds={selectedIds}
          selectMode={selectMode}
        />
      )}

      {/* Create Event Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Event">
        <CalendarForm defaultDate={selectedDate} onSubmit={handleCreate} onCancel={() => setShowCreate(false)} loading={saving} />
      </Modal>

      {/* Event Detail Modal */}
      <Modal open={!!detailEvent && !editEvent} onClose={() => setDetailEvent(null)} title="Event Details">
        {detailEvent && (
          <EventDetailPanel
            event={detailEvent}
            onClose={() => setDetailEvent(null)}
            onEdit={() => { setEditEvent(detailEvent); setDetailEvent(null); }}
            onDelete={handleDelete}
          />
        )}
      </Modal>

      {/* Edit Event Modal */}
      <Modal open={!!editEvent} onClose={() => setEditEvent(null)} title="Edit Event">
        {editEvent && (
          <CalendarForm
            initialData={editEvent as unknown as Record<string, unknown>}
            onSubmit={handleEdit}
            onCancel={() => setEditEvent(null)}
            loading={saving}
          />
        )}
      </Modal>

      {/* Floating bulk-delete action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: 'var(--status-danger)' }}
          >
            <Trash2 size={13} />
            {bulkDeleting ? 'Deleting...' : 'Delete All'}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1.5 text-sm border rounded-lg transition-opacity hover:opacity-70"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
