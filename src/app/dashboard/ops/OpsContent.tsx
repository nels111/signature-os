'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Clock,
  Zap,
  Users,
  Target,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { LiveShiftsWidget } from '@/components/LiveShiftsWidget';

interface HoursSheetData {
  activeContracts: number;
  pipelineContracts: number;
  weeklyHours: number;
  weeklyEarnings: number;
  monthlyEarnings: number;
  annualValue: number;
  contracts: {
    name: string;
    cleanType: string;
    weeklyHours: number;
    monthlyEarnings: number;
    status: 'active' | 'pipeline';
    firstAuditDate: string | null;
  }[];
  fetchedAt: string;
}

interface OpsData {
  hoursSheet: HoursSheetData | null;
  actualHours: {
    weeklyActualHours: number;
    clockedShifts: number;
    uniqueOperatives: number;
    weekStart: string;
    weekEnd: string;
    fetchedAt: string;
  } | null;
}

function StatCard({
  label, value, change, positive, icon, accent, href,
}: {
  label: string; value: string; change?: string; positive?: boolean;
  icon?: React.ReactNode; accent?: string; href?: string;
}) {
  const accentColor = accent || 'var(--brand-green-accent)';
  const inner = (
    <div
      className={`rounded-2xl p-5 sig-stat ${href ? 'sig-stat-link' : ''}`}
      style={{
        background: '#ffffff',
        boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)',
        cursor: href ? 'pointer' : 'default',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{label}</p>
        {icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${accentColor} 10%, transparent)`, color: accentColor }}>
            {icon}
          </div>
        )}
      </div>
      <p className="text-[28px] font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</p>
      {change && (
        <div className="flex items-center gap-1 mt-2">
          {positive !== undefined && (
            positive
              ? <TrendingUp size={12} style={{ color: 'var(--status-success)' }} />
              : <TrendingDown size={12} style={{ color: 'var(--status-danger)' }} />
          )}
          <p className="text-xs font-medium" style={{ color: positive !== undefined ? (positive ? 'var(--status-success)' : 'var(--status-danger)') : 'var(--text-muted)' }}>
            {change}
          </p>
        </div>
      )}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

function GrowthProgressBar({ current, target }: { current: number; target: number }) {
  const pct = Math.min((current / target) * 100, 100);
  return (
    <div className="rounded-2xl p-5" style={{ background: 'radial-gradient(ellipse at 80% 0%, rgba(125,178,39,0.08) 0%, #ffffff 55%)', boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(125,178,39,0.16), 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)' }}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Target size={16} style={{ color: 'var(--brand-blue)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Growth Target</p>
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {current.toFixed(0)}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / {target} hrs</span>
        </p>
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Weekly contracted hours toward 1,000 goal</p>
      <div className="relative">
        <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--brand-blue) 0%, var(--brand-green-accent) 100%)' }} />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[11px] font-semibold" style={{ color: 'var(--brand-blue)' }}>{pct.toFixed(1)}%</span>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{(target - current).toFixed(0)} hrs to go</span>
        </div>
      </div>
    </div>
  );
}

function ContractList({ contracts }: { contracts: HoursSheetData['contracts'] }) {
  const active = contracts.filter(c => c.status === 'active');
  const top = active.sort((a, b) => b.weeklyHours - a.weeklyHours).slice(0, 8);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#ffffff', boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)' }}>
      <div className="px-5 py-4 flex justify-between items-center" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <Building2 size={16} style={{ color: 'var(--brand-blue)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Top Contracts</h3>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: 'var(--brand-blue-subtle)', color: 'var(--brand-blue)' }}>
          {active.length} active
        </span>
      </div>
      {top.map((c, i) => (
        <Link
          key={i}
          href="/dashboard/financials"
          className="px-5 py-3.5 flex items-center justify-between transition-colors duration-150 block"
          style={{ borderBottom: i < top.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: `hsl(${(i * 47) % 360}, 30%, 95%)`, color: `hsl(${(i * 47) % 360}, 40%, 40%)` }}>
              {c.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{c.cleanType}</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-3">
            <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{c.weeklyHours}h/wk</p>
            <p className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>£{Number(c.monthlyEarnings).toFixed(0)}/mo</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function OpsContent() {
  const [data, setData] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(json => { setData(json); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const hs = data?.hoursSheet;
  const ah = data?.actualHours;

  return (
    <div style={{ position: 'relative' }}>
      <div aria-hidden style={{ position: 'absolute', top: -40, right: -40, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(125,178,39,0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      {/* Back nav */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
          style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--brand-blue)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
        >
          <ArrowLeft size={14} />
          Dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#5a8f1c', margin: '0 0 3px' }}>Operations</p>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>Overview</h1>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 mb-6">
          <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--brand-blue)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      ) : (
        <>
          {/* Growth bar */}
          <div className="mb-4">
            <GrowthProgressBar current={hs?.weeklyHours ?? 0} target={1000} />
          </div>

          {/* Hours + operatives cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <StatCard label="Active Contracts" value={String(hs?.activeContracts ?? 0)} icon={<Building2 size={16} />} href="/dashboard/financials" />
            <StatCard label="Contracted Hrs/Wk" value={hs ? `${hs.weeklyHours}` : '0'} icon={<Clock size={16} />} href="/dashboard/financials" />
            <StatCard
              label="Actual Hrs This Week"
              value={ah ? `${ah.weeklyActualHours}` : '--'}
              change={ah && hs ? (ah.weeklyActualHours >= hs.weeklyHours ? `+${(ah.weeklyActualHours - hs.weeklyHours).toFixed(1)} over contracted` : `${(hs.weeklyHours - ah.weeklyActualHours).toFixed(1)} under contracted`) : undefined}
              positive={ah && hs ? ah.weeklyActualHours >= hs.weeklyHours : undefined}
              icon={<Zap size={16} />}
              accent={ah && hs ? (ah.weeklyActualHours >= hs.weeklyHours ? 'var(--status-success)' : 'var(--status-danger)') : undefined}
              href="/dashboard/financials"
            />
            <StatCard
              label="Operatives Clocked"
              value={ah ? `${ah.uniqueOperatives}` : '--'}
              change={ah ? `${ah.clockedShifts} shifts` : undefined}
              icon={<Users size={16} />}
              href="/dashboard/financials"
            />
          </div>

          {/* Revenue cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <StatCard label="Weekly Revenue" value={hs ? `£${Number(hs.weeklyEarnings).toFixed(0)}` : '£0'} href="/dashboard/financials" />
            <StatCard label="Monthly Revenue" value={hs ? `£${Number(hs.monthlyEarnings).toFixed(0)}` : '£0'} href="/dashboard/financials" />
            <StatCard label="Annual Value" value={hs ? `£${(Number(hs.annualValue) / 1000).toFixed(1)}k` : '£0'} href="/dashboard/financials" />
            <StatCard label="In Pipeline" value={String(hs?.pipelineContracts ?? 0)} change={hs && hs.pipelineContracts > 0 ? `${hs.pipelineContracts} pending` : undefined} href="/dashboard/pipeline" />
          </div>

          {/* Contracts list */}
          {hs && hs.contracts.length > 0 && (
            <div className="mb-4">
              <ContractList contracts={hs.contracts} />
            </div>
          )}
        </>
      )}

      {/* Live shifts — always renders (fetches own data) */}
      <div className="mt-2">
        <LiveShiftsWidget />
      </div>

      {/* Timestamp */}
      {hs && (
        <div className="flex items-center gap-1.5 mt-4">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--status-success)' }} />
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Last synced {new Date(hs.fetchedAt).toLocaleString('en-GB')}
          </p>
        </div>
      )}
    </div>
  );
}
