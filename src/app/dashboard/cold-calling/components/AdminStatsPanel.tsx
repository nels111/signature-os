'use client';

import { useState, useEffect, useCallback } from 'react';
import { Phone, TrendingUp, Calendar, CalendarCheck, RefreshCw, BarChart2 } from 'lucide-react';
import type { ColdCallingStats } from '@/lib/cold-calling/types';

const OUTCOME_LABELS: Record<string, string> = {
  no_answer: 'No Answer',
  voicemail_left: 'Voicemail',
  gatekeeper: 'Gatekeeper',
  callback_booked: 'Callback Booked',
  decision_maker_spoke: 'DM Spoke',
  site_visit_booked: 'Site Visit',
  contract_renewal_date: 'Renewal Date',
  not_interested: 'Not Interested',
  bad_data: 'Bad Data',
};

const OUTCOME_COLORS: Record<string, string> = {
  no_answer: '#6b7280',
  voicemail_left: '#8b5cf6',
  gatekeeper: '#3b82f6',
  callback_booked: '#f59e0b',
  decision_maker_spoke: '#22c55e',
  site_visit_booked: '#10b981',
  contract_renewal_date: '#06b6d4',
  not_interested: '#ef4444',
  bad_data: '#94a3b8',
};

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) {
  return (
    <div className="flex flex-col gap-1 p-4 rounded-2xl"
      style={{
        background: `radial-gradient(ellipse at 15% 0%, ${color}15 0%, #ffffff 60%)`,
        boxShadow: `0 0 0 1px ${color}20, 0 2px 8px ${color}10`,
      }}>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon size={13} style={{ color }} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{label}</span>
      </div>
      <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{value}</p>
    </div>
  );
}

function OutcomeBar({ outcomes }: { outcomes: Record<string, number> }) {
  const total = Object.values(outcomes).reduce((a, b) => a + b, 0);
  if (total === 0) return <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No calls recorded.</p>;

  const entries = Object.entries(outcomes).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-2.5">
      <div className="flex h-3 rounded-full overflow-hidden gap-px" style={{ background: 'var(--surface-hover)' }}>
        {entries.map(([key, count]) => {
          const pct = (count / total) * 100;
          const color = OUTCOME_COLORS[key] ?? '#6b7280';
          return <div key={key} style={{ width: `${pct}%`, background: color, minWidth: pct > 0 ? 2 : 0 }} title={`${OUTCOME_LABELS[key] ?? key}: ${count}`} />;
        })}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-1.5 gap-x-4">
        {entries.map(([key, count]) => {
          const color = OUTCOME_COLORS[key] ?? '#6b7280';
          const pct = Math.round((count / total) * 100);
          return (
            <div key={key} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
              <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{OUTCOME_LABELS[key] ?? key}</span>
              <span className="text-xs font-semibold ml-auto" style={{ color: 'var(--text-primary)' }}>
                {count} <span className="font-normal" style={{ color: 'var(--text-secondary)' }}>({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QueueDepth({ depth }: { depth: ColdCallingStats['queueDepth'] }) {
  const items = [
    { label: 'Callbacks', value: depth.callbacks, color: '#f59e0b' },
    { label: 'Fresh', value: depth.fresh, color: '#22c55e' },
    { label: 'Follow-ups', value: depth.followUps, color: '#3b82f6' },
    { label: 'Recycle', value: depth.recycle, color: '#8b5cf6' },
    { label: 'Dormant', value: depth.dormant, color: '#94a3b8' },
  ];
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs w-20 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
          <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--surface-hover)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(item.value / max) * 100}%`, background: item.color }} />
          </div>
          <span className="text-xs font-semibold w-8 text-right" style={{ color: 'var(--text-primary)' }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function AdminStatsPanel() {
  const [stats, setStats] = useState<ColdCallingStats | null>(null);
  const [range, setRange] = useState<'today' | 'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async (r: 'today' | 'week' | 'month') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cold-calling/stats?range=${r}`);
      if (res.ok) setStats(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStats(range); }, [fetchStats, range]);

  // Auto-refresh on call logged
  useEffect(() => {
    const handler = () => fetchStats(range);
    window.addEventListener('sigos:call-logged', handler);
    return () => window.removeEventListener('sigos:call-logged', handler);
  }, [fetchStats, range]);

  const RANGES = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
  ] as const;

  return (
    <div className="flex-shrink-0 border-t p-5 space-y-5 overflow-y-auto" style={{ borderColor: 'var(--border)', maxHeight: '45vh', background: 'var(--bg)' }}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 size={15} style={{ color: 'var(--brand-blue)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Team Stats</span>
        </div>
        <div className="flex items-center gap-1">
          {RANGES.map(r => (
            <button key={r.value} onClick={() => setRange(r.value)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
              style={{
                background: range === r.value ? 'var(--brand-blue)' : 'var(--surface)',
                color: range === r.value ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${range === r.value ? 'var(--brand-blue)' : 'var(--border)'}`,
              }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'var(--surface-hover)' }} />)}
        </div>
      ) : stats ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Calls Made" value={stats.callsMade} icon={Phone} color="#2056A4" />
            <StatCard label="DM Conversations" value={stats.decisionMakerConversations} icon={TrendingUp} color="#22c55e" />
            <StatCard label="Callbacks Booked" value={stats.callbacksBooked} icon={Calendar} color="#f59e0b" />
            <StatCard label="Site Visits" value={stats.siteVisitsBooked} icon={CalendarCheck} color="#10b981" />
          </div>

          {/* Outcome breakdown */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Outcome breakdown</p>
            <OutcomeBar outcomes={stats.outcomes} />
          </div>

          {/* Queue depth */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Queue depth</p>
            <QueueDepth depth={stats.queueDepth} />
          </div>
        </>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Failed to load stats</p>
      )}
    </div>
  );
}
