'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
  Phone,
  Mail,
  CheckSquare,
  AlertCircle,
  ArrowRight,
  PhoneCall,
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
  const accentColor = accent || 'var(--brand-blue)';
  return (
    <div
      className="rounded-2xl p-5 transition-all duration-200 relative overflow-hidden"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
        borderLeft: `3px solid ${accentColor}`,
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
          className="w-full h-3 rounded-full overflow-hidden"
          style={{ background: 'var(--border)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, var(--brand-blue) 0%, var(--brand-green-accent) 100%)',
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

interface VaDashboardData {
  queueCount: number;
  callsToday: number;
  emailsToday: number;
  openTasks: number;
  overdueTasks: number;
  myLeads: number;
  recentCalls: { id: string; description: string; createdAt: string; companyName: string; metadata: Record<string, string> | null }[];
}

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

function ClockWidget() {
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

function VaDashboard({ userName }: { userName: string }) {
  const [data, setData] = useState<VaDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/va')
      .then(res => res.json())
      .then(json => { setData(json); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const firstName = userName.split(' ')[0];

  const OUTCOME_COLORS: Record<string, string> = {
    answered: '#22c55e',
    no_answer: '#6b7280',
    voicemail: '#8b5cf6',
    callback_needed: '#f59e0b',
    not_interested: '#ef4444',
    gatekeeper: '#3b82f6',
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {firstName}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link
          href="/dashboard/cold-calling"
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
          style={{ background: 'var(--brand-blue)' }}
        >
          <Phone size={16} />
          Start Calling
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Clock in/out */}
      <div className="mb-6">
        <ClockWidget />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 mb-6">
          <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--brand-blue)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {/* Queue */}
            <Link href="/dashboard/cold-calling" className="block">
              <div
                className="rounded-2xl p-5 transition-all duration-200 cursor-pointer"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-card)',
                  borderLeft: '3px solid var(--brand-blue)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-hover)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-card)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
              >
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[11px] font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>Call Queue</p>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand-blue-subtle)', color: 'var(--brand-blue)' }}>
                    <Phone size={16} />
                  </div>
                </div>
                <p className="text-[28px] font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>{data?.queueCount ?? 0}</p>
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>leads to call</p>
              </div>
            </Link>

            {/* Calls today */}
            <div
              className="rounded-2xl p-5 transition-all duration-200"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-card)',
                borderLeft: '3px solid #22c55e',
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>Calls Today</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#22c55e18', color: '#22c55e' }}>
                  <PhoneCall size={16} />
                </div>
              </div>
              <p className="text-[28px] font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>{data?.callsToday ?? 0}</p>
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>logged</p>
            </div>

            {/* Emails today */}
            <div
              className="rounded-2xl p-5 transition-all duration-200"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-card)',
                borderLeft: '3px solid #8b5cf6',
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>Emails Sent</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#8b5cf618', color: '#8b5cf6' }}>
                  <Mail size={16} />
                </div>
              </div>
              <p className="text-[28px] font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>{data?.emailsToday ?? 0}</p>
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>follow-ups today</p>
            </div>

            {/* Tasks */}
            <Link href="/dashboard/tasks" className="block">
              <div
                className="rounded-2xl p-5 transition-all duration-200 cursor-pointer"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-card)',
                  borderLeft: `3px solid ${(data?.overdueTasks ?? 0) > 0 ? '#ef4444' : '#f59e0b'}`,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-hover)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-card)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
              >
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[11px] font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>Open Tasks</p>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: (data?.overdueTasks ?? 0) > 0 ? '#ef444418' : '#f59e0b18', color: (data?.overdueTasks ?? 0) > 0 ? '#ef4444' : '#f59e0b' }}>
                    {(data?.overdueTasks ?? 0) > 0 ? <AlertCircle size={16} /> : <CheckSquare size={16} />}
                  </div>
                </div>
                <p className="text-[28px] font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>{data?.openTasks ?? 0}</p>
                <p className="text-xs mt-2" style={{ color: (data?.overdueTasks ?? 0) > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                  {(data?.overdueTasks ?? 0) > 0 ? `${data?.overdueTasks} overdue` : 'all on track'}
                </p>
              </div>
            </Link>
          </div>

          {/* Recent calls */}
          {(data?.recentCalls?.length ?? 0) > 0 && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
            >
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <Clock size={16} style={{ color: 'var(--brand-blue)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Calls</h3>
                </div>
                <Link href="/dashboard/cold-calling" className="text-xs font-medium" style={{ color: 'var(--brand-blue)' }}>
                  View all
                </Link>
              </div>
              {data?.recentCalls?.map((call, i) => {
                const meta = call.metadata as Record<string, string> | null;
                const outcome = meta?.callOutcome || '';
                const color = OUTCOME_COLORS[outcome] || 'var(--text-muted)';
                return (
                  <div
                    key={call.id}
                    className="px-5 py-3.5 flex items-center gap-3"
                    style={{ borderBottom: i < (data?.recentCalls?.length ?? 0) - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{call.companyName}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{call.description}</p>
                    </div>
                    <p className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {new Date(call.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {(data?.queueCount ?? 0) === 0 && (data?.recentCalls?.length ?? 0) === 0 && (
            <div
              className="rounded-2xl p-10 text-center"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--brand-blue-subtle)', color: 'var(--brand-blue)' }}>
                <Phone size={24} />
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Queue is empty</p>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Import leads to get started with cold calling.</p>
              <Link href="/dashboard/leads" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--brand-blue)' }}>
                <UserPlus size={14} />
                Import Leads
              </Link>
            </div>
          )}
        </>
      )}
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
    if (role === 'va') return; // VA uses its own component
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [role]);

  // VA gets their own focused dashboard
  if (role === 'va') {
    return <VaDashboard userName={userName} />;
  }

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
            <div className="w-1.5 h-5 rounded-full" style={{ background: 'var(--brand-blue)' }} />
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
            <div className="w-1.5 h-5 rounded-full" style={{ background: 'var(--brand-green-accent)' }} />
            <h2
              className="text-xs font-semibold uppercase"
              style={{ color: 'var(--brand-green)', letterSpacing: '0.08em' }}
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
