'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  UserPlus,
  FileText,
  Clock,
  Building2,
  Target,
  Zap,
} from 'lucide-react';

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

interface PipelineStage {
  stage: string;
  count: number;
  value: number;
}

interface QuotesData {
  count: number;
  totalValue: number;
}

interface DashboardData {
  totalLeads: number;
  totalDeals: number;
  overdueTasks: number;
  upcomingEvents: number;
  pipelineValue: PipelineStage[];
  quotesThisMonth: QuotesData;
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

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
  icon?: React.ReactNode;
  accent?: string;
}

function StatCard({ label, value, change, positive, icon, accent }: StatCardProps) {
  return (
    <div
      className="rounded-2xl p-5 transition-all duration-200 group"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-card)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div className="flex items-start justify-between mb-3">
        <p
          className="text-[11px] font-semibold uppercase"
          style={{
            color: 'var(--text-muted)',
            letterSpacing: '0.06em',
          }}
        >
          {label}
        </p>
        {icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: accent ? `${accent}10` : 'var(--brand-blue-subtle)',
              color: accent || 'var(--brand-blue)',
            }}
          >
            {icon}
          </div>
        )}
      </div>
      <p
        className="text-[28px] font-bold"
        style={{
          color: 'var(--text-primary)',
          letterSpacing: '-0.03em',
          lineHeight: 1,
        }}
      >
        {value}
      </p>
      {change && (
        <div className="flex items-center gap-1 mt-2">
          {positive !== undefined && (
            positive ? <TrendingUp size={12} style={{ color: 'var(--status-success)' }} /> : <TrendingDown size={12} style={{ color: 'var(--status-danger)' }} />
          )}
          <p
            className="text-xs font-medium"
            style={{
              color: positive !== undefined
                ? (positive ? 'var(--status-success)' : 'var(--status-danger)')
                : 'var(--text-muted)',
            }}
          >
            {change}
          </p>
        </div>
      )}
    </div>
  );
}

function GrowthProgressBar({ current, target }: { current: number; target: number }) {
  const pct = Math.min((current / target) * 100, 100);

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Target size={16} style={{ color: 'var(--brand-blue)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Growth Target
          </p>
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {current.toFixed(0)}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / {target} hrs</span>
        </p>
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        Weekly contracted hours toward 1,000 goal
      </p>
      <div className="relative">
        <div
          className="w-full h-2 rounded-full overflow-hidden"
          style={{ background: 'var(--background)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${pct}%`,
              background: pct > 50
                ? 'linear-gradient(90deg, var(--brand-blue), var(--status-success))'
                : 'var(--brand-blue)',
            }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[11px] font-semibold" style={{ color: 'var(--brand-blue)' }}>
            {pct.toFixed(1)}%
          </span>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {(target - current).toFixed(0)} hrs to go
          </span>
        </div>
      </div>
    </div>
  );
}

function ContractList({ contracts }: { contracts: HoursSheetData['contracts'] }) {
  const active = contracts.filter(c => c.status === 'active');
  const top = active.sort((a, b) => b.weeklyHours - a.weeklyHours).slice(0, 8);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div
        className="px-5 py-4 flex justify-between items-center"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <Building2 size={16} style={{ color: 'var(--brand-blue)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Top Contracts
          </h3>
        </div>
        <span
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{
            background: 'var(--brand-blue-subtle)',
            color: 'var(--brand-blue)',
          }}
        >
          {active.length} active
        </span>
      </div>
      {top.map((c, i) => (
        <div
          key={i}
          className="px-5 py-3.5 flex items-center justify-between transition-colors duration-150"
          style={{ borderBottom: i < top.length - 1 ? '1px solid var(--border)' : 'none' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{
                background: `hsl(${(i * 47) % 360}, 30%, 95%)`,
                color: `hsl(${(i * 47) % 360}, 40%, 40%)`,
              }}
            >
              {c.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {c.name}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {c.cleanType}
              </p>
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-3">
            <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {c.weeklyHours}h/wk
            </p>
            <p className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              £{Number(c.monthlyEarnings).toFixed(0)}/mo
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

interface DashboardContentProps {
  role: string;
  userName: string;
}

export function DashboardContent({ role, userName }: DashboardContentProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const isSales = role === 'sales' || role === 'admin';
  const isOps = role === 'operations' || role === 'admin';
  const hs = data?.hoursSheet;
  const ah = data?.actualHours;

  // Calculate pipeline totals
  const pipelineTotal = data?.pipelineValue?.reduce((sum, s) => sum + s.value, 0) ?? 0;
  const pipelineDeals = data?.pipelineValue?.reduce((sum, s) => sum + s.count, 0) ?? 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-[28px] font-bold"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}
        >
          Welcome back, {userName.split(' ')[0]}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 mb-6">
          <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--brand-blue)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading dashboard...
          </p>
        </div>
      )}

      {/* Sales */}
      {isSales && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full" style={{ background: 'var(--brand-blue)' }} />
            <h2
              className="text-xs font-semibold uppercase"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
            >
              Sales
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Active Leads"
              value={String(data?.totalLeads ?? 0)}
              icon={<UserPlus size={16} />}
            />
            <StatCard
              label="Open Deals"
              value={String(data?.totalDeals ?? 0)}
              icon={<Zap size={16} />}
            />
            <StatCard
              label="Pipeline Value"
              value={pipelineTotal > 0 ? `£${(pipelineTotal / 1000).toFixed(1)}k` : '£0'}
              change={pipelineDeals > 0 ? `${pipelineDeals} deals in play` : undefined}
              icon={<TrendingUp size={16} />}
            />
            <StatCard
              label="Quotes This Month"
              value={String(data?.quotesThisMonth?.count ?? 0)}
              change={data?.quotesThisMonth?.totalValue ? `£${Number(data.quotesThisMonth.totalValue).toFixed(0)} total value` : undefined}
              icon={<FileText size={16} />}
            />
          </div>
        </div>
      )}

      {/* Ops */}
      {isOps && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full" style={{ background: 'var(--status-success)' }} />
            <h2
              className="text-xs font-semibold uppercase"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
            >
              Operations
            </h2>
          </div>

          <GrowthProgressBar current={hs?.weeklyHours ?? 0} target={1000} />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <StatCard
              label="Active Contracts"
              value={String(hs?.activeContracts ?? 0)}
              icon={<Building2 size={16} />}
            />
            <StatCard
              label="Contracted Hrs/Wk"
              value={hs ? `${hs.weeklyHours}` : '0'}
              icon={<Clock size={16} />}
            />
            <StatCard
              label="Actual Hrs This Week"
              value={ah ? `${ah.weeklyActualHours}` : '--'}
              change={ah && hs ? (
                ah.weeklyActualHours >= hs.weeklyHours
                  ? `+${(ah.weeklyActualHours - hs.weeklyHours).toFixed(1)} over contracted`
                  : `${(hs.weeklyHours - ah.weeklyActualHours).toFixed(1)} under contracted`
              ) : undefined}
              positive={ah && hs ? ah.weeklyActualHours >= hs.weeklyHours : undefined}
              icon={<Zap size={16} />}
              accent={ah && hs ? (ah.weeklyActualHours >= hs.weeklyHours ? 'var(--status-success)' : 'var(--status-danger)') : undefined}
            />
            <StatCard
              label="Operatives Clocked"
              value={ah ? `${ah.uniqueOperatives}` : '--'}
              change={ah ? `${ah.clockedShifts} shifts` : undefined}
              icon={<Users size={16} />}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <StatCard
              label="Weekly Revenue"
              value={hs ? `£${Number(hs.weeklyEarnings).toFixed(0)}` : '£0'}
            />
            <StatCard
              label="Monthly Revenue"
              value={hs ? `£${Number(hs.monthlyEarnings).toFixed(0)}` : '£0'}
            />
            <StatCard
              label="Annual Value"
              value={hs ? `£${(Number(hs.annualValue) / 1000).toFixed(1)}k` : '£0'}
            />
            <StatCard
              label="In Pipeline"
              value={String(hs?.pipelineContracts ?? 0)}
              change={hs && hs.pipelineContracts > 0 ? `${hs.pipelineContracts} pending` : undefined}
            />
          </div>

          {/* Contracts list */}
          {hs && hs.contracts.length > 0 && (
            <div className="mt-4">
              <ContractList contracts={hs.contracts} />
            </div>
          )}
        </div>
      )}

      {/* Alerts */}
      {data && (data.overdueTasks > 0 || data.upcomingEvents > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {data.overdueTasks > 0 && (
            <div
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{
                background: 'var(--status-danger-bg)',
                border: '1px solid color-mix(in srgb, var(--status-danger) 20%, transparent)',
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--status-danger)', color: 'white' }}
              >
                <span className="text-sm font-bold">{data.overdueTasks}</span>
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--status-danger)' }}>
                  Overdue task{data.overdueTasks > 1 ? 's' : ''}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Requires attention
                </p>
              </div>
            </div>
          )}
          {data.upcomingEvents > 0 && (
            <div
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{
                background: 'var(--status-info-bg)',
                border: '1px solid color-mix(in srgb, var(--status-info) 20%, transparent)',
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--status-info)', color: 'white' }}
              >
                <span className="text-sm font-bold">{data.upcomingEvents}</span>
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--status-info)' }}>
                  Event{data.upcomingEvents > 1 ? 's' : ''} this week
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Calendar
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timestamp */}
      {hs && (
        <div className="flex items-center gap-1.5 mt-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--status-success)' }} />
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Last synced {new Date(hs.fetchedAt).toLocaleString('en-GB')}
          </p>
        </div>
      )}
    </div>
  );
}
