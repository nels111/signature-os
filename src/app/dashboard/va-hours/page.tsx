'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';

interface TimeSession {
  id: string;
  user_id: string;
  user_name: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
}

// Group sessions by date
function groupByDate(sessions: TimeSession[]): Record<string, TimeSession[]> {
  const groups: Record<string, TimeSession[]> = {};
  for (const s of sessions) {
    const date = new Date(s.clocked_in_at).toLocaleDateString('en-CA'); // YYYY-MM-DD
    if (!groups[date]) groups[date] = [];
    groups[date].push(s);
  }
  return groups;
}

export default function VaHoursPage() {
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/time-tracking/sessions?from=${from}&to=${to}`);
      const data = await res.json();
      setSessions(data.sessions || []);
      setTotalMinutes(data.totalMinutes || 0);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const grouped = groupByDate(sessions);
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const totalHours = (totalMinutes / 60).toFixed(1);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            VA Hours
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Time tracking sessions for VA users
          </p>
        </div>
      </div>

      {/* Filters */}
      <div
        className="rounded-xl p-4 mb-6 flex flex-wrap items-end gap-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>FROM</label>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>TO</label>
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
          />
        </div>
        <button
          onClick={fetchSessions}
          className="px-4 py-1.5 rounded-lg text-sm font-medium text-white"
          style={{ background: 'var(--brand-blue)' }}
        >
          Apply
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Total Hours — blue */}
        <div
          className="sig-stat rounded-2xl p-5"
          style={{
            background: 'radial-gradient(ellipse at 15% 0%, rgba(32,86,164,0.10) 0%, #ffffff 60%)',
            boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(32,86,164,0.13), 0 2px 8px rgba(32,86,164,0.07), 0 14px 36px rgba(32,86,164,0.05)',
          }}
        >
          <p className="text-[10px] font-bold uppercase mb-3" style={{ color: '#2056A4', letterSpacing: '0.07em' }}>Total Hours</p>
          <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{totalHours}h</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>in selected period</p>
        </div>
        {/* Sessions — green */}
        <div
          className="sig-stat rounded-2xl p-5"
          style={{
            background: 'radial-gradient(ellipse at 15% 0%, rgba(22,163,74,0.10) 0%, #ffffff 60%)',
            boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(22,163,74,0.13), 0 2px 8px rgba(22,163,74,0.07), 0 14px 36px rgba(22,163,74,0.05)',
          }}
        >
          <p className="text-[10px] font-bold uppercase mb-3" style={{ color: '#16a34a', letterSpacing: '0.07em' }}>Sessions</p>
          <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            {sessions.filter(s => s.clocked_out_at).length}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>completed</p>
        </div>
        {/* Avg per Day — amber */}
        <div
          className="sig-stat rounded-2xl p-5"
          style={{
            background: 'radial-gradient(ellipse at 15% 0%, rgba(245,158,11,0.10) 0%, #ffffff 60%)',
            boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(245,158,11,0.13), 0 2px 8px rgba(245,158,11,0.07), 0 14px 36px rgba(245,158,11,0.05)',
          }}
        >
          <p className="text-[10px] font-bold uppercase mb-3" style={{ color: '#d97706', letterSpacing: '0.07em' }}>Avg per Day</p>
          <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            {sortedDates.length > 0 ? (Number(totalHours) / sortedDates.length).toFixed(1) : '0.0'}h
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>across {sortedDates.length} day{sortedDates.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Sessions grouped by date */}
      {loading ? (
        <div className="flex items-center gap-2 py-8 justify-center">
          <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--brand-blue)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading sessions...</p>
        </div>
      ) : sortedDates.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{ background: '#ffffff', boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.05)' }}
        >
          <Clock size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No sessions in this period</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sessions will appear once the VA starts clocking in.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDates.map(date => {
            const daySessions = grouped[date];
            const dayMinutes = daySessions
              .filter(s => s.clocked_out_at)
              .reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
            return (
              <div
                key={date}
                className="rounded-xl overflow-hidden"
                style={{
                  background: '#ffffff',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.05), 0 10px 28px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-hover)' }}
                >
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {formatDate(date + 'T12:00:00')}
                  </p>
                  <span className="text-sm font-semibold" style={{ color: 'var(--brand-blue)' }}>
                    {formatDuration(dayMinutes)}
                  </span>
                </div>
                {daySessions.map((s, i) => (
                  <div
                    key={s.id}
                    className="px-4 py-3 flex items-center gap-4"
                    style={{ borderBottom: i < daySessions.length - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        {formatDateTime(s.clocked_in_at)}
                        {s.clocked_out_at && (
                          <span style={{ color: 'var(--text-muted)' }}> → {new Date(s.clocked_out_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </p>
                      {s.notes && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {s.clocked_out_at ? (
                        <span
                          className="text-sm font-semibold tabular-nums"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {formatDuration(s.duration_minutes)}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#22c55e20', color: '#22c55e' }}>
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
