'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface TimeStatus {
  isClockedIn: boolean;
  clockedInAt: string | null;
  todayMinutes: number;
  weekMinutes: number;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function ClockWidget() {
  const [status, setStatus] = useState<TimeStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = () => {
    fetch('/api/time-tracking/status')
      .then(r => r.json())
      .then(setStatus)
      .catch(() => {});
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleClock = async () => {
    setLoading(true);
    const endpoint = status?.isClockedIn ? '/api/time-tracking/clock-out' : '/api/time-tracking/clock-in';
    await fetch(endpoint, { method: 'POST' });
    await fetchStatus();
    setLoading(false);
  };

  const isClockedIn = status?.isClockedIn ?? false;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isClockedIn) return;
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, [isClockedIn]);
  const liveMinutes = isClockedIn && status?.clockedInAt
    ? Math.round((now - new Date(status.clockedInAt).getTime()) / 60000)
    : 0;
  const todayTotal = (status?.todayMinutes ?? 0);
  const weekTotal = (status?.weekMinutes ?? 0);

  return (
    <div
      className="rounded-2xl p-5 flex items-center justify-between gap-4"
      style={{
        background: isClockedIn ? 'color-mix(in srgb, #22c55e 8%, var(--surface))' : 'var(--surface)',
        border: `1px solid ${isClockedIn ? '#22c55e40' : 'var(--border)'}`,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: isClockedIn ? '#22c55e20' : 'var(--surface-hover)', color: isClockedIn ? '#22c55e' : 'var(--text-muted)' }}
        >
          <Clock size={20} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {isClockedIn ? `Clocked in ${liveMinutes > 0 ? `· ${formatDuration(liveMinutes)}` : ''}` : 'Not clocked in'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Today: {formatDuration(todayTotal)} · This week: {formatDuration(weekTotal)}
          </p>
        </div>
      </div>
      <button
        onClick={handleClock}
        disabled={loading}
        className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 flex-shrink-0"
        style={{
          background: isClockedIn ? '#ef4444' : '#22c55e',
          color: '#fff',
        }}
      >
        {loading ? '...' : isClockedIn ? 'Clock Out' : 'Clock In'}
      </button>
    </div>
  );
}
