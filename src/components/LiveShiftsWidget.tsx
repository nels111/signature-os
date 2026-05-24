'use client';

import { useState, useEffect, useCallback } from 'react';

interface ShiftEntry {
  operativeName: string;
  operativeId: string;
  jobTitle: string;
  startTime: number;
  endTime: number;
  status: 'clocked_in' | 'overdue' | 'upcoming' | 'completed';
  clockedInAt: number | null;
  clockedOutAt: number | null;
  minutesLate: number | null;
}

interface ShiftCounts {
  clocked_in: number;
  overdue: number;
  upcoming: number;
  completed: number;
}

interface ShiftsData {
  shifts: ShiftEntry[];
  counts: ShiftCounts;
  fetchedAt: string;
  error: string | null;
}

const STATUS_CONFIG = {
  clocked_in: {
    label: 'In',
    colour: '#22c55e',
    bg: '#f0fdf4',
    borderColour: '#22c55e',
    dot: '●',
  },
  overdue: {
    label: 'Overdue',
    colour: '#ef4444',
    bg: '#fef2f2',
    borderColour: '#ef4444',
    dot: '●',
  },
  upcoming: {
    label: 'Due',
    colour: '#f59e0b',
    bg: '#fffbeb',
    borderColour: '#f59e0b',
    dot: '○',
  },
  completed: {
    label: 'Done',
    colour: '#9ca3af',
    bg: '#f9fafb',
    borderColour: '#e5e7eb',
    dot: '✓',
  },
};

function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function ShiftCard({ shift }: { shift: ShiftEntry }) {
  const cfg = STATUS_CONFIG[shift.status];
  const firstName = shift.operativeName.split(' ')[0];

  let statusDetail: string | null = null;
  if (shift.status === 'clocked_in' && shift.clockedInAt) {
    statusDetail = `Clocked in ${fmtTime(shift.clockedInAt)}`;
    if (shift.minutesLate !== null && shift.minutesLate > 0) {
      statusDetail += ` (+${shift.minutesLate}min)`;
    }
  } else if (shift.status === 'overdue') {
    statusDetail = 'No clock-in';
  } else if (shift.status === 'completed' && shift.clockedOutAt) {
    statusDetail = `Out ${fmtTime(shift.clockedOutAt)}`;
  } else if (shift.status === 'upcoming') {
    statusDetail = `Due ${fmtTime(shift.startTime)}`;
  }

  return (
    <div style={{
      background: shift.status === 'overdue'
        ? 'rgba(220,38,38,0.04)'
        : shift.status === 'clocked_in'
          ? 'rgba(22,163,74,0.03)'
          : 'var(--surface)',
      border: shift.status === 'overdue'
        ? '1px solid rgba(220,38,38,0.15)'
        : '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
    }}>
      {/* Avatar */}
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: cfg.bg,
        border: `2px solid ${cfg.borderColour}`,
        fontSize: 11, fontWeight: 700, color: cfg.colour,
      }}>
        {shift.status === 'completed' ? '✓' : initials(shift.operativeName)}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {firstName}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px',
            borderRadius: 'var(--radius-full)',
            background: cfg.bg,
            color: cfg.colour,
            border: `1px solid color-mix(in srgb, ${cfg.colour} 25%, transparent)`,
            flexShrink: 0,
          }}>
            {cfg.label}
          </span>
        </div>
        <div style={{
          fontSize: 12, color: 'var(--text-muted)', marginBottom: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {shift.jobTitle}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {fmtTime(shift.startTime)} – {fmtTime(shift.endTime)}
          {statusDetail && (
            <span style={{
              marginLeft: 6,
              color: shift.status === 'overdue'
                ? cfg.colour
                : shift.minutesLate && shift.minutesLate > 0
                  ? '#f59e0b'
                  : shift.status === 'clocked_in'
                    ? cfg.colour
                    : 'var(--text-muted)',
              fontWeight: shift.status === 'overdue' ? 600 : 400,
            }}>
              · {statusDetail}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function LiveShiftsWidget() {
  const [data, setData] = useState<ShiftsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<'all' | 'clocked_in' | 'overdue' | 'upcoming' | 'completed'>('all');

  const load = useCallback(async () => {
    const res = await fetch('/api/shifts/today');
    if (!res.ok) { setLoading(false); return; }
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  const totalShifts = data ? data.shifts.length : 0;
  const filtered = data
    ? (filter === 'all' ? data.shifts : data.shifts.filter(s => s.status === filter))
    : [];
  const visible = showAll ? filtered : filtered.slice(0, 9);

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-card)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: data?.counts.overdue ? '#ef4444' : '#22c55e',
            animation: data?.counts.overdue ? 'pulse 1.5s infinite' : 'none',
          }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            Shifts Today
          </span>
          {totalShifts > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
              {totalShifts} total
            </span>
          )}
        </div>
        <button
          onClick={load}
          title="Refresh"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 12, padding: '2px 4px',
            borderRadius: 'var(--radius-sm)',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand-blue)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          ↻
        </button>
      </div>

      {/* Filter chips */}
      {data && totalShifts > 0 && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'clocked_in', 'overdue', 'upcoming', 'completed'] as const).map(f => {
            const count = f === 'all' ? totalShifts : data.counts[f] ?? 0;
            if (f !== 'all' && count === 0) return null;
            const cfg = f === 'all' ? null : STATUS_CONFIG[f];
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 9px', borderRadius: 'var(--radius-full)',
                  border: active ? `1.5px solid ${cfg?.colour ?? 'var(--brand-blue)'}` : '1.5px solid var(--border)',
                  background: active ? (cfg?.bg ?? 'var(--surface-accent)') : 'var(--surface)',
                  color: active ? (cfg?.colour ?? 'var(--brand-blue)') : 'var(--text-secondary)',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {f === 'all' ? 'All' : STATUS_CONFIG[f].label} {count}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ padding: '12px 16px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 10,
          }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                display: 'flex', gap: 10,
              }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--border)', flexShrink: 0, animation: 'pulse 1.5s infinite' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 13, width: '60%', background: 'var(--border)', borderRadius: 4, marginBottom: 6, animation: 'pulse 1.5s infinite' }} />
                  <div style={{ height: 11, width: '80%', background: 'var(--border)', borderRadius: 4, marginBottom: 4, animation: 'pulse 1.5s infinite' }} />
                  <div style={{ height: 10, width: '50%', background: 'var(--border)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !data || totalShifts === 0 ? (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          {data?.error ? `⚠️ ${data.error}` : 'No shifts scheduled today'}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No {filter.replace('_', ' ')} shifts
        </div>
      ) : (
        <>
          <div style={{
            padding: '12px 16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 10,
          }}>
            {visible.map(shift => (
              <ShiftCard
                key={`${shift.operativeId}-${shift.startTime}`}
                shift={shift}
              />
            ))}
          </div>

          {filtered.length > 9 && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => setShowAll(!showAll)}
                style={{
                  width: '100%', padding: '6px 0', background: 'none', border: 'none',
                  cursor: 'pointer', color: 'var(--brand-blue)', fontSize: 12, fontWeight: 600,
                }}
              >
                {showAll ? '↑ Show less' : `↓ Show all ${filtered.length} shifts`}
              </button>
            </div>
          )}
        </>
      )}

      {/* Footer */}
      {data && !loading && (
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--background)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: data.error ? '#f59e0b' : '#22c55e', flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {data.error
              ? data.error
              : `Updated ${new Date(data.fetchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · auto-refreshes every 2 min`
            }
          </span>
        </div>
      )}
    </div>
  );
}
