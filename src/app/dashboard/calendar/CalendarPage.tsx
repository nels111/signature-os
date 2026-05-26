'use client';

import { useState, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, CalendarDays,
  List, LayoutGrid, Plus, Trash2,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { CalendarForm } from './CalendarForm';
import { CalEvent, CalTask, ViewMode, MONTHS, MONTHS_SHORT } from './calendarTypes';
import { dateKey, getWeekDays } from './calendarHelpers';
import { EventLegend } from './EventChip';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
import { ListView } from './ListView';
import { EventDetailPanel } from './EventDetailPanel';

export function CalendarPage() {
  const now = new Date();
  const [view, setView]           = useState<ViewMode>('week');
  const [year, setYear]           = useState(now.getFullYear());
  const [month, setMonth]         = useState(now.getMonth());
  const [weekBase, setWeekBase]   = useState(now);
  const [filter, setFilter]       = useState<'all' | 'shared' | 'personal'>('all');
  const [events, setEvents]       = useState<CalEvent[]>([]);
  const [tasks, setTasks]         = useState<CalTask[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [detailEvent, setDetailEvent]   = useState<CalEvent | null>(null);
  const [editEvent, setEditEvent]       = useState<CalEvent | null>(null);
  const [saving, setSaving]       = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading]     = useState(true);
  const [selectMode, setSelectMode]   = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const weekDays = getWeekDays(weekBase);
  const todayKey = dateKey(now);

  // ---- Data loading ----
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
      if (!cancelled) { setEvents(json.events || []); setTasks(json.tasks || []); setLoading(false); }
    }
    loadData();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, view, weekBase, filter, refreshKey]);

  // ---- Navigation ----
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); setWeekBase(now); };

  const prevPeriod = () => {
    if (view === 'week') { const d = new Date(weekBase); d.setDate(d.getDate() - 7); setWeekBase(d); }
    else if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextPeriod = () => {
    if (view === 'week') { const d = new Date(weekBase); d.setDate(d.getDate() + 7); setWeekBase(d); }
    else if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  // ---- CRUD ----
  const handleCreate = async (data: Record<string, unknown>) => {
    setSaving(true);
    const res = await fetch('/api/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    setSaving(false);
    if (res.ok) { setShowCreate(false); setRefreshKey((k) => k + 1); }
  };

  const handleEdit = async (data: Record<string, unknown>) => {
    if (!editEvent) return;
    setSaving(true);
    const res = await fetch(`/api/calendar/${editEvent.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    setSaving(false);
    if (res.ok) { setEditEvent(null); setDetailEvent(null); setRefreshKey((k) => k + 1); }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Delete this event? This cannot be undone.')) return;
    await fetch(`/api/calendar/${eventId}`, { method: 'DELETE' });
    setDetailEvent(null);
    setRefreshKey((k) => k + 1);
  };

  // ---- Select / bulk delete ----
  const toggleSelectEvent = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} event${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    await Promise.all(Array.from(selectedIds).map((id) => fetch(`/api/calendar/${id}`, { method: 'DELETE' })));
    setBulkDeleting(false);
    setSelectedIds(new Set());
    setSelectMode(false);
    setRefreshKey((k) => k + 1);
  };

  const handleDayClick  = (key: string) => { setSelectedDate(key); setShowCreate(true); };
  const handleEventClick = (ev: CalEvent) => { if (selectMode) { toggleSelectEvent(ev.id); return; } setDetailEvent(ev); };

  // ---- Period label ----
  const periodLabel = view === 'week'
    ? (() => {
        const s = weekDays[0], e = weekDays[6];
        if (s.getMonth() === e.getMonth()) return `${s.getDate()}–${e.getDate()} ${MONTHS[s.getMonth()]} ${s.getFullYear()}`;
        return `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]} ${e.getFullYear()}`;
      })()
    : `${MONTHS[month]} ${year}`;

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
              { key: 'week',  icon: CalendarDays, label: 'Week'  },
              { key: 'month', icon: LayoutGrid,   label: 'Month' },
              { key: 'list',  icon: List,         label: 'List'  },
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

          {/* Filter */}
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
            onClick={() => { setSelectMode((m) => !m); setSelectedIds(new Set()); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-all"
            style={{
              borderColor: selectMode ? 'var(--status-danger)' : 'var(--border)',
              background:  selectMode ? '#fef2f2' : 'var(--surface)',
              color:       selectMode ? 'var(--status-danger)' : 'var(--text-secondary)',
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
          <button onClick={prevPeriod} className="p-2 rounded-lg border transition-all" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' }}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={nextPeriod} className="p-2 rounded-lg border transition-all" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' }}>
            <ChevronRight size={16} />
          </button>
          <h2 className="text-base font-semibold ml-1" style={{ color: 'var(--text-primary)' }}>{periodLabel}</h2>
        </div>
        <button onClick={goToday} className="px-3 py-1.5 text-xs font-medium border rounded-lg" style={{ borderColor: 'var(--brand-blue)', color: 'var(--brand-blue)', background: 'var(--surface)' }}>
          Today
        </button>
      </div>

      {/* Legend */}
      <div className="mb-3"><EventLegend /></div>

      {/* Views */}
      {view === 'week' && (
        <WeekView weekDays={weekDays} events={events} tasks={tasks} todayKey={todayKey} onDayClick={handleDayClick} onEventClick={handleEventClick} selectedIds={selectedIds} selectMode={selectMode} />
      )}
      {view === 'month' && (
        <MonthView year={year} month={month} events={events} tasks={tasks} todayKey={todayKey} onDayClick={handleDayClick} onEventClick={handleEventClick} selectedIds={selectedIds} selectMode={selectMode} />
      )}
      {view === 'list' && (
        <ListView events={events} tasks={tasks} onEventClick={handleEventClick} selectedIds={selectedIds} selectMode={selectMode} />
      )}

      {/* Modals */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Event">
        <CalendarForm defaultDate={selectedDate} onSubmit={handleCreate} onCancel={() => setShowCreate(false)} loading={saving} />
      </Modal>

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

      <Modal open={!!editEvent} onClose={() => setEditEvent(null)} title="Edit Event">
        {editEvent && (
          <CalendarForm initialData={editEvent as unknown as Record<string, unknown>} onSubmit={handleEdit} onCancel={() => setEditEvent(null)} loading={saving} />
        )}
      </Modal>

      {/* Bulk delete bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedIds.size} selected</span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: 'var(--status-danger)' }}
          >
            <Trash2 size={13} />
            {bulkDeleting ? 'Deleting...' : 'Delete All'}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 text-sm border rounded-lg" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
