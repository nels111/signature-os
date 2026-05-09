'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { CalendarForm } from './CalendarForm';

interface CalEvent {
  id: string;
  title: string;
  eventType: string;
  calendarType: string;
  allDay: boolean;
  startDate: string;
  endDate: string;
  owner: { id: string; name: string | null } | null;
}

interface CalTask {
  id: string;
  subject: string;
  dueDate: string;
  priority: string;
  status: string;
}

const EVENT_COLORS: Record<string, string> = {
  meeting: '#3b82f6', site_survey: '#8b5cf6', follow_up: '#f59e0b', calendly: '#10b981', personal: '#6b7280',
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
  const days: { date: Date; inMonth: boolean }[] = [];

  // Previous month padding
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, inMonth: false });
  }
  // Current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), inMonth: true });
  }
  // Next month padding
  while (days.length % 7 !== 0) {
    const d = new Date(year, month + 1, days.length - startOffset - lastDay.getDate() + 1);
    days.push({ date: d, inMonth: false });
  }
  return days;
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [view, setView] = useState<'month' | 'week'>('month');
  const [filter, setFilter] = useState<'all' | 'shared' | 'personal'>('all');
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [tasks, setTasks] = useState<CalTask[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const params = new URLSearchParams({ start, end });
      if (filter !== 'all') params.set('calendarType', filter);

      const res = await fetch('/api/calendar?' + params.toString());
      const json = await res.json();
      if (!cancelled) {
        setEvents(json.events || []);
        setTasks(json.tasks || []);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [year, month, filter, refreshKey]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); };

  const handleCreate = async (data: Record<string, unknown>) => {
    setSaving(true);
    const res = await fetch('/api/calendar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setShowCreate(false); setRefreshKey(k => k + 1); }
  };

  const days = getMonthDays(year, month);
  const todayKey = dateKey(now);

  // Group events/tasks by date
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#1a1a1a' }}>Calendar</h1>
        </div>
        <div className="flex gap-2">
          <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}
            className="px-3 py-1.5 text-sm border rounded-md" style={{ borderColor: '#e2e8f0' }}>
            <option value="all">All</option>
            <option value="shared">Shared Only</option>
            <option value="personal">Personal Only</option>
          </select>
          <button onClick={() => setView(view === 'month' ? 'week' : 'month')}
            className="px-3 py-1.5 text-sm border rounded-md" style={{ borderColor: '#e2e8f0' }}>
            {view === 'month' ? 'Week View' : 'Month View'}
          </button>
          <button onClick={() => { setSelectedDate(''); setShowCreate(true); }}
            className="px-4 py-1.5 text-sm text-white rounded-md" style={{ backgroundColor: '#2c5f2d' }}>
            + New Event
          </button>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="px-3 py-1 text-sm border rounded hover:bg-gray-50" style={{ borderColor: '#e2e8f0' }}>←</button>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium" style={{ color: '#1a1a1a' }}>{MONTHS[month]} {year}</h2>
          <button onClick={goToday} className="px-2 py-0.5 text-xs border rounded" style={{ borderColor: '#e2e8f0', color: '#2c5f2d' }}>Today</button>
        </div>
        <button onClick={nextMonth} className="px-3 py-1 text-sm border rounded hover:bg-gray-50" style={{ borderColor: '#e2e8f0' }}>→</button>
      </div>

      {/* Month Grid */}
      <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b" style={{ borderColor: '#e2e8f0' }}>
          {DAYS.map(d => (
            <div key={d} className="px-2 py-2 text-center text-xs font-medium" style={{ color: '#64748b' }}>{d}</div>
          ))}
        </div>
        {/* Weeks */}
        {Array.from({ length: days.length / 7 }, (_, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 border-b last:border-b-0" style={{ borderColor: '#e2e8f0' }}>
            {days.slice(weekIdx * 7, weekIdx * 7 + 7).map((day, i) => {
              const key = dateKey(day.date);
              const isToday = key === todayKey;
              const dayEvents = eventsByDate[key] || [];
              const dayTasks = tasksByDate[key] || [];
              return (
                <div key={i}
                  className="min-h-[100px] p-1 border-r last:border-r-0 cursor-pointer hover:bg-gray-50"
                  style={{ borderColor: '#e2e8f0', backgroundColor: isToday ? '#f0fdf4' : day.inMonth ? '#fff' : '#f9fafb' }}
                  onClick={() => { setSelectedDate(key); setShowCreate(true); }}>
                  <div className="text-right">
                    <span className={`text-xs ${isToday ? 'bg-green-600 text-white rounded-full px-1.5 py-0.5' : ''}`}
                      style={{ color: day.inMonth ? '#1a1a1a' : '#cbd5e1' }}>
                      {day.date.getDate()}
                    </span>
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {dayEvents.slice(0, 3).map(ev => (
                      <div key={ev.id} className="text-xs px-1 py-0.5 rounded truncate text-white"
                        style={{ backgroundColor: EVENT_COLORS[ev.eventType] || '#6b7280' }}>
                        {ev.title}
                      </div>
                    ))}
                    {dayTasks.slice(0, 2).map(t => (
                      <div key={t.id} className="text-xs px-1 py-0.5 rounded truncate border border-dashed"
                        style={{ borderColor: '#6b7280', color: '#6b7280' }}>
                        ✓ {t.subject}
                      </div>
                    ))}
                    {(dayEvents.length + dayTasks.length > 5) && (
                      <div className="text-xs" style={{ color: '#64748b' }}>+{dayEvents.length + dayTasks.length - 5} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Event">
        <CalendarForm defaultDate={selectedDate} onSubmit={handleCreate} onCancel={() => setShowCreate(false)} loading={saving} />
      </Modal>
    </div>
  );
}
