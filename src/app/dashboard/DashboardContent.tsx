'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Phone,
  Mail,
  CheckSquare,
  AlertCircle,
  ArrowRight,
  PhoneCall,
  ChevronRight,
  Building2,
  Target,
  Clock,
  UserPlus,
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

// StatCard, GrowthProgressBar, ContractList live in OpsContent / SalesContent.
// Kept below only as reference during VA dashboard transition — remove in next cleanup.

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
  icon?: React.ReactNode;
  accent?: string;
  href?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function StatCard({ label, value, change, positive, icon, accent, href }: StatCardProps) {
  const accentColor = accent || 'var(--brand-blue)';
  const inner = (
    <div
      className="rounded-2xl p-5 transition-all duration-200 relative overflow-hidden"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
        cursor: href ? 'pointer' : 'default',
      }}
      onMouseEnter={(e) => { if (href) { e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
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
              background: accent ? `${accent}14` : 'var(--brand-blue-subtle)',
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
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        <Link
          key={i}
          href="/dashboard/financials"
          className="px-5 py-3.5 flex items-center justify-between transition-colors duration-150 block"
          style={{ borderBottom: i < top.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
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
        </Link>
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

  const firstName = userName ? userName.split(' ')[0] : null;

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
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}{firstName ? `, ${firstName}` : ','}
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
                  background: (data?.overdueTasks ?? 0) > 0 ? 'rgba(220,38,38,0.03)' : 'var(--surface)',
                  border: (data?.overdueTasks ?? 0) > 0 ? '1px solid rgba(220,38,38,0.15)' : '1px solid var(--border)',
                  boxShadow: 'var(--shadow-card)',
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
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Your recent calls</h3>
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

// ── Donut chart (SVG, no library) ─────────────────────────────────────────
function DonutChart({ pct, color, size = 88 }: { pct: number; color: string; size?: number }) {
  const r = 33;
  const circ = 2 * Math.PI * r;
  const safe = Math.min(Math.max(pct, 0), 100);
  const dash = (safe / 100) * circ;
  const gap = circ - dash;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 88 88" style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx="44" cy="44" r={r} fill="none" stroke={`${color}22`} strokeWidth="8" />
        <circle
          cx="44" cy="44" r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(0.23,1,0.32,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, color }}>
          {safe.toFixed(1)}%
        </span>
        <span style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          of goal
        </span>
      </div>
    </div>
  );
}

// ── Pipeline bar chart (proportional, horizontal) ─────────────────────────
const PIPE_COLORS: Record<string, string> = {
  'New': '#818cf8',
  'Contacted': '#60a5fa',
  'Proposal Sent': '#fb923c',
  'Negotiation': '#f59e0b',
  'Won': '#4ade80',
  'Lost': '#f87171',
};

function PipelineBar({ stages }: { stages: PipelineStage[] }) {
  const total = stages.reduce((s, st) => s + st.value, 0);
  if (total === 0) return null;
  const active = stages.filter(s => s.value > 0);
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', height: 5, borderRadius: 4, overflow: 'hidden', gap: 1, background: 'rgba(32,86,164,0.06)' }}>
        {active.map((s, i) => (
          <div
            key={s.stage}
            style={{
              flex: s.value,
              background: PIPE_COLORS[s.stage] ?? '#94a3b8',
              marginLeft: i > 0 ? 1 : 0,
              transition: 'flex 0.9s cubic-bezier(0.23,1,0.32,1)',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        {active.slice(0, 5).map(s => (
          <span key={s.stage} style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: PIPE_COLORS[s.stage] ?? '#94a3b8', display: 'inline-block', flexShrink: 0 }} />
            {s.stage.replace(' Sent', '')} · £{(s.value / 1000).toFixed(0)}k
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────
interface DashboardContentProps {
  role: string;
  userName: string | null | undefined;
}

export function DashboardContent({ role, userName }: DashboardContentProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role === 'va') return;
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(json => { setData(json); setLoading(false); })
      .catch(() => setLoading(false));
  }, [role]);

  if (role === 'va') return <VaDashboard userName={userName ?? ''} />;

  const isSales = role === 'sales' || role === 'admin';
  const isOps = role === 'operations' || role === 'admin';
  const hs = data?.hoursSheet;
  const ah = data?.actualHours;
  const firstName = userName ? userName.split(' ')[0] : null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const pipelineTotal = data?.pipelineValue?.reduce((sum, s) => sum + s.value, 0) ?? 0;
  const goalPct = hs ? Math.min((hs.weeklyHours / 1000) * 100, 100) : 0;
  const overdueShifts = (data?.actualHours as { overdueShifts?: number } | null)?.overdueShifts ?? 0;

  return (
    <>
      <style>{`
        @keyframes tileIn {
          from { opacity: 0; transform: translateY(10px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @media (hover: hover) and (pointer: fine) {
          .sig-tile-sales:hover {
            transform: translateY(-2px) !important;
            box-shadow:
              0 1px 0 rgba(255,255,255,0.85) inset,
              0 0 0 1px rgba(32,86,164,0.22),
              0 4px 14px rgba(32,86,164,0.11),
              0 20px 48px rgba(32,86,164,0.07) !important;
          }
          .sig-tile-ops:hover {
            transform: translateY(-2px) !important;
            box-shadow:
              0 1px 0 rgba(255,255,255,0.85) inset,
              0 0 0 1px rgba(125,178,39,0.28),
              0 4px 14px rgba(125,178,39,0.11),
              0 20px 48px rgba(125,178,39,0.07) !important;
          }
        }
        .sig-tile-sales:active,
        .sig-tile-ops:active {
          transform: scale(0.98) !important;
          transition-duration: 80ms !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .sig-tile-sales, .sig-tile-ops {
            animation: none !important;
            transition: none !important;
          }
        }
        .sig-grid { display: grid; gap: 16px; margin-bottom: 20px; }
        .sig-grid-dual { grid-template-columns: 1fr 1fr; }
        @media (max-width: 639px) {
          .sig-grid-dual { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={{ position: 'relative' }}>
        {/* Ambient background orbs */}
        <div aria-hidden style={{
          position: 'absolute', top: -60, left: -60, width: 360, height: 360,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(32,86,164,0.05) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: 0,
        }} />
        <div aria-hidden style={{
          position: 'absolute', top: 40, right: -80, width: 300, height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(125,178,39,0.05) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: 0,
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* ── Header ──────────────────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            marginBottom: 20, paddingBottom: 18, borderBottom: '1px solid var(--border)',
          }}>
            <div>
              <h1 style={{
                fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em',
                color: 'var(--text-primary)', margin: 0, lineHeight: 1.2,
              }}>
                {greeting}{firstName ? `, ${firstName}` : ','}
              </h1>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, marginBottom: 0 }}>
                {dateStr}
              </p>
            </div>
            {hs && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 3 }}>
                  Weekly hours
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-primary)', lineHeight: 1 }}>
                  {hs.weeklyHours}
                  <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>/1,000</span>
                </p>
              </div>
            )}
          </div>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                border: '2px solid var(--brand-blue)', borderTopColor: 'transparent',
                animation: 'spin 0.7s linear infinite',
              }} />
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading...</p>
            </div>
          )}

          {/* ── Metric strip ──────────────────────────────────── */}
          {data && !loading && (
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 18 }}>
              {[
                { label: 'Contracts', value: `${hs?.activeContracts ?? 0}`, color: '#2563eb' },
                { label: 'Monthly rev', value: hs ? `£${Number(hs.monthlyEarnings).toFixed(0)}` : '—', color: '#059669' },
                { label: 'Clocked today', value: `${ah?.uniqueOperatives ?? 0}`, color: '#7c3aed' },
                ...(overdueShifts > 0 ? [{ label: 'Overdue shifts', value: `${overdueShifts}`, color: '#dc2626' }] : []),
              ].map(chip => (
                <span
                  key={chip.label}
                  style={{
                    fontSize: 11, fontWeight: 600,
                    padding: '4px 11px', borderRadius: 20,
                    background: `${chip.color}0d`,
                    color: chip.color,
                    border: `1px solid ${chip.color}20`,
                    letterSpacing: '0.01em',
                  }}
                >
                  {chip.label}: <strong style={{ fontWeight: 700 }}>{chip.value}</strong>
                </span>
              ))}
            </div>
          )}

          {/* ── Section tiles ─────────────────────────────────── */}
          <div className={`sig-grid ${isSales && isOps ? 'sig-grid-dual' : ''}`}>
            {/* Sales — 4D bubble */}
            {isSales && (
              <Link href="/dashboard/sales" style={{ textDecoration: 'none', display: 'block' }}>
                <div
                  className="sig-tile-sales rounded-2xl"
                  style={{
                    background: 'radial-gradient(ellipse at 22% 12%, rgba(32,86,164,0.1) 0%, rgba(32,86,164,0.02) 58%, transparent 100%), #ffffff',
                    boxShadow: '0 1px 0 rgba(255,255,255,0.75) inset, 0 0 0 1px rgba(32,86,164,0.13), 0 2px 5px rgba(32,86,164,0.06), 0 14px 36px rgba(32,86,164,0.05)',
                    padding: '22px 24px 24px',
                    cursor: 'pointer',
                    height: '100%',
                    animation: 'tileIn 440ms cubic-bezier(0.23,1,0.32,1) both',
                    transition: 'transform 180ms cubic-bezier(0.23,1,0.32,1), box-shadow 180ms cubic-bezier(0.23,1,0.32,1)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#2056a4' }}>
                      Sales Pipeline
                    </span>
                    <ChevronRight size={14} style={{ color: '#2056a4', opacity: 0.38 }} />
                  </div>

                  <p style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {pipelineTotal > 0 ? `£${(pipelineTotal / 1000).toFixed(1)}k` : '£0'}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 0 }}>total pipeline value</p>

                  {data?.pipelineValue && data.pipelineValue.length > 0 && (
                    <PipelineBar stages={data.pipelineValue} />
                  )}

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16 }}>
                    {[
                      `${data?.totalLeads ?? 0} leads`,
                      `${data?.totalDeals ?? 0} deals`,
                      `${data?.quotesThisMonth?.count ?? 0} quotes`,
                    ].map(label => (
                      <span key={label} style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                        background: 'rgba(32,86,164,0.07)', color: '#2056a4',
                        border: '1px solid rgba(32,86,164,0.12)',
                      }}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            )}

            {/* Ops — 4D bubble + donut */}
            {isOps && (
              <Link href="/dashboard/ops" style={{ textDecoration: 'none', display: 'block' }}>
                <div
                  className="sig-tile-ops rounded-2xl"
                  style={{
                    background: 'radial-gradient(ellipse at 78% 12%, rgba(125,178,39,0.11) 0%, rgba(125,178,39,0.02) 58%, transparent 100%), #ffffff',
                    boxShadow: '0 1px 0 rgba(255,255,255,0.75) inset, 0 0 0 1px rgba(125,178,39,0.17), 0 2px 5px rgba(125,178,39,0.06), 0 14px 36px rgba(125,178,39,0.05)',
                    padding: '22px 24px 24px',
                    cursor: 'pointer',
                    height: '100%',
                    animation: 'tileIn 440ms 55ms cubic-bezier(0.23,1,0.32,1) both',
                    transition: 'transform 180ms cubic-bezier(0.23,1,0.32,1), box-shadow 180ms cubic-bezier(0.23,1,0.32,1)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#5a8f1c' }}>
                        Operations
                      </span>
                      {overdueShifts > 0 && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                          background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                        }}>
                          {overdueShifts} overdue
                        </span>
                      )}
                    </div>
                    <ChevronRight size={14} style={{ color: '#5a8f1c', opacity: 0.38 }} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div>
                      <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1, color: 'var(--text-primary)' }}>
                        {hs ? hs.weeklyHours : '--'}
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 5 }}>hrs/wk</span>
                    </div>
                    {hs && <DonutChart pct={goalPct} color="#5a8f1c" size={82} />}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>contracted weekly hours</p>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      `${hs?.activeContracts ?? 0} contracts`,
                      ...(hs ? [`£${Number(hs.monthlyEarnings).toFixed(0)}/mo`] : []),
                      ...(ah ? [`${ah.uniqueOperatives} clocked`] : []),
                    ].map(label => (
                      <span key={label} style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                        background: 'rgba(125,178,39,0.09)', color: '#5a8f1c',
                        border: '1px solid rgba(125,178,39,0.16)',
                      }}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            )}
          </div>

          {/* ── Alerts ────────────────────────────────────────── */}
          {data && (data.overdueTasks > 0 || data.upcomingEvents > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              {data.overdueTasks > 0 && (
                <Link href="/dashboard/tasks" style={{ textDecoration: 'none' }}>
                  <div
                    className="rounded-xl"
                    style={{
                      background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)',
                      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                      transition: 'background 150ms ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.05)'; }}
                  >
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#dc2626', minWidth: 28, textAlign: 'center', lineHeight: 1 }}>
                      {data.overdueTasks}
                    </span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', margin: 0 }}>
                        overdue task{data.overdueTasks > 1 ? 's' : ''}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Needs attention</p>
                    </div>
                  </div>
                </Link>
              )}
              {data.upcomingEvents > 0 && (
                <Link href="/dashboard/calendar" style={{ textDecoration: 'none' }}>
                  <div
                    className="rounded-xl"
                    style={{
                      background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.15)',
                      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                      transition: 'background 150ms ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,99,235,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,99,235,0.05)'; }}
                  >
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#2563eb', minWidth: 28, textAlign: 'center', lineHeight: 1 }}>
                      {data.upcomingEvents}
                    </span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', margin: 0 }}>
                        event{data.upcomingEvents > 1 ? 's' : ''} this week
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Calendar</p>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          )}

          {/* ── Sync footer ───────────────────────────────────── */}
          {hs && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--status-success)', flexShrink: 0 }} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Synced {new Date(hs.fetchedAt).toLocaleString('en-GB')}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
