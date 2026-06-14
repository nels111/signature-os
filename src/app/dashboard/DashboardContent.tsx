'use client';

import { useId, useState, useEffect } from 'react';
import Link from 'next/link';
import { Target, ArrowUp, ArrowRight, TrendingUp, Clock, Calendar } from 'lucide-react';
import { VaDashboard } from './VaDashboard';

// ── Data shapes (match /api/dashboard) ──────────────────────────────────────────
interface HoursSheetData {
  activeContracts: number;
  pipelineContracts: number;
  weeklyHours: number;
  weeklyEarnings: number;
  monthlyEarnings: number;
  annualValue: number;
  totalMonthlyEarnings?: number;
  companyValuation?: {
    annualRecurringRevenue: number;
    marginPct: number;
    annualProfit: number;
    multiple: number;
    companyValue: number;
    systemisedMultiple: number;
    systemisedUpside: number;
    sheetLegacyValue: number;
    assumptions: string;
  };
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

interface ActualHoursData {
  weeklyActualHours: number;
  clockedShifts: number;
  uniqueOperatives: number;
  weekStart: string;
  weekEnd: string;
  fetchedAt: string;
}

interface DashboardData {
  totalLeads: number;
  totalDeals: number;
  overdueTasks: number;
  upcomingEvents: number;
  pipelineValue: PipelineStage[];
  quotesThisMonth: QuotesData;
  hoursSheet: HoursSheetData | null;
  actualHours: ActualHoursData | null;
}

const TARGET = 1000; // weekly contracted-hours growth goal

// ── Formatting helpers (mirror prototype) ───────────────────────────────────────
function fmtGBP(n: number): string {
  return '£' + Math.round(n).toLocaleString('en-GB');
}
function fmtK(n: number): string {
  if (n >= 1000) return '£' + (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'k';
  return '£' + Math.round(n);
}

// ── Pipeline / deal stage colors (DealStage + LeadStage enums) ──────────────────
const STAGE_META: Record<string, { label: string; color: string }> = {
  quote_sent: { label: 'Quote Sent', color: 'var(--deal-quote-sent, #2563EB)' },
  follow_up_from_quote: { label: 'Follow-Up', color: 'var(--deal-follow-up, #D97706)' },
  closed_won: { label: 'Won', color: 'var(--deal-won, #059669)' },
  closed_lost: { label: 'Lost', color: 'var(--deal-lost, #DC2626)' },
};
function stageLabel(stage: string): string {
  return STAGE_META[stage]?.label ?? stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
function stageColor(stage: string): string {
  return STAGE_META[stage]?.color ?? '#64748B';
}

// ── 270° arc gauge (SVG, no library) ─────────────────────────────────────────────
function ArcGauge({
  value,
  max,
  size = 130,
  stroke = 11,
  color = '#9FE870',
  track = 'rgba(255,255,255,0.10)',
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
}) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = 135;
  const sweep = 270;
  const pct = Math.min(1, Math.max(0, value / max));
  const polar = (deg: number): [number, number] => {
    const a = (deg - 90) * (Math.PI / 180);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const arc = (frac: number): string => {
    const a0 = startAngle;
    const a1 = startAngle + sweep * frac;
    const [x0, y0] = polar(a0);
    const [x1, y1] = polar(a1);
    const large = sweep * frac > 180 ? 1 : 0;
    return `M ${x0},${y0} A ${r},${r} 0 ${large} 1 ${x1},${y1}`;
  };
  const fullLen = 2 * Math.PI * r * (sweep / 360);
  const shown = fullLen * pct;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      <path d={arc(1)} fill="none" stroke={track} strokeWidth={stroke} strokeLinecap="round" />
      <path
        d={arc(pct)}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${shown} ${fullLen}`}
        strokeDashoffset={0}
        style={{
          filter: `drop-shadow(0 0 6px ${color}66)`,
          transition: 'stroke-dasharray 1.1s cubic-bezier(0.23,1,0.32,1)',
        }}
      />
    </svg>
  );
}

// ── Tiny sparkline for stat cards ────────────────────────────────────────────────
function smoothPath(pts: [number, number][], tension = 0.5): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension * 2;
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension * 2;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension * 2;
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension * 2;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}
function Sparkline({
  data,
  color = '#2056A4',
  width = 78,
  height = 26,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const uid = useId().replace(/:/g, '');
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const x = (i: number) => (i / (data.length - 1)) * width;
  const y = (v: number) => height - 2 - ((v - min) / (max - min || 1)) * (height - 6);
  const pts: [number, number][] = data.map((v, i) => [x(i), y(v)]);
  const line = smoothPath(pts);
  const area = `${line} L ${width},${height} L 0,${height} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`sp-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sp-${uid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.25" fill={color} />
    </svg>
  );
}

// ── RunFig (hero run-rate row) ────────────────────────────────────────────────────
function RunFig({ label, value, sub, hi }: { label: string; value: string; sub?: string; hi?: boolean }) {
  return (
    <div className={`sig-runfig${hi ? ' hi' : ''}${sub ? ' has-sub' : ''}`}>
      <span className="sig-runfig-lbl">{label}</span>
      <span className="sig-runfig-valwrap">
        <span className="sig-runfig-val">{value}</span>
        {sub && <span className="sig-runfig-sub">{sub}</span>}
      </span>
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────────
interface DashboardContentProps {
  role: string;
  userName: string | null | undefined;
}

type View = 'overview' | 'sales' | 'ops';

export function DashboardContent({ role, userName }: DashboardContentProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const isSales = role === 'sales' || role === 'admin';
  const isOps = role === 'operations' || role === 'admin';

  // Default to the view this role cares about; admins start on Overview.
  const [view, setView] = useState<View>(
    role === 'sales' ? 'sales' : role === 'operations' ? 'ops' : 'overview',
  );

  useEffect(() => {
    if (role === 'va') return;
    fetch('/api/dashboard')
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [role]);

  if (role === 'va') return <VaDashboard userName={userName ?? ''} />;

  const hs = data?.hoursSheet;
  const ah = data?.actualHours;
  const firstName = userName ? userName.split(' ')[0] : null;
  const hour = new Date().getHours();
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

  const weeklyHours = hs?.weeklyHours ?? 0;
  const weeklyHoursDisplay = Math.round(weeklyHours); // clean integer for display; gauge uses the precise value
  const pct = hs ? Math.round((weeklyHours / TARGET) * 100) : 0;
  const pipelineTotal = data?.pipelineValue?.reduce((sum, s) => sum + s.value, 0) ?? 0;
  const liveDeals = data?.pipelineValue?.reduce((sum, s) => sum + s.count, 0) ?? 0;
  const overdueShifts = (data?.actualHours as { overdueShifts?: number } | null)?.overdueShifts ?? 0;

  // Which view switches are available for this role.
  const views: { id: View; label: string }[] = [
    ...(role === 'admin' ? [{ id: 'overview' as View, label: 'Overview' }] : []),
    ...(isSales ? [{ id: 'sales' as View, label: 'Sales' }] : []),
    ...(isOps ? [{ id: 'ops' as View, label: 'Operations' }] : []),
  ];
  const showSeg = views.length > 1;
  const activeIdx = Math.max(0, views.findIndex((v) => v.id === view));

  const showSales = view === 'overview' || view === 'sales';
  const showOps = view === 'overview' || view === 'ops';

  // ── Stat cards, built only from REAL data (no fabricated numbers). ─────────────
  type Stat = { id: string; label: string; value: string; sub: string; color: string; spark: number[]; views: View[] };
  const allStats: Stat[] = [];
  if (hs) {
    allStats.push({
      id: 'contracts',
      label: 'Active contracts',
      value: `${hs.activeContracts}`,
      sub: `${hs.pipelineContracts} in mobilisation`,
      color: '#5C7A1E',
      spark: [],
      views: ['overview', 'ops'],
    });
  }
  if (pipelineTotal > 0 || (data && data.totalDeals > 0)) {
    allStats.push({
      id: 'pipeline',
      label: 'Open pipeline',
      value: fmtK(pipelineTotal),
      sub: `${liveDeals} live deal${liveDeals === 1 ? '' : 's'}`,
      color: '#2056A4',
      spark: [],
      views: ['overview', 'sales'],
    });
  }
  if (data) {
    allStats.push({
      id: 'quotes',
      label: 'Quotes this month',
      value: `${data.quotesThisMonth?.count ?? 0}`,
      sub: `${fmtK(data.quotesThisMonth?.totalValue ?? 0)} sent value`,
      color: '#0D9488',
      spark: [],
      views: ['overview', 'sales'],
    });
    allStats.push({
      id: 'leads',
      label: 'Total leads',
      value: `${data.totalLeads ?? 0}`,
      sub: `${data.totalDeals ?? 0} deals tracked`,
      color: '#7C3AED',
      spark: [],
      views: ['overview', 'sales'],
    });
  }
  if (ah) {
    allStats.push({
      id: 'actual',
      label: 'Actual hours / wk',
      value: `${ah.weeklyActualHours}`,
      sub: hs ? `vs ${Math.round(hs.weeklyHours)} contracted` : 'logged this week',
      color: '#16A34A',
      spark: [],
      views: ['overview', 'ops'],
    });
    allStats.push({
      id: 'operatives',
      label: 'Operatives clocked',
      value: `${ah.uniqueOperatives}`,
      sub: `${ah.clockedShifts} shift${ah.clockedShifts === 1 ? '' : 's'} this week`,
      color: '#D97706',
      spark: [],
      views: ['ops'],
    });
  }
  const statCards = allStats.filter((c) => c.views.includes(view)).slice(0, 4);

  const activePipeline = (data?.pipelineValue ?? []).filter((s) => s.count > 0 || s.value > 0);
  const maxPipe = Math.max(1, ...activePipeline.map((s) => s.count));

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap, 18px)' }}>
        {/* ── Greeting + view switch ── */}
        <div className="sig-greet">
          <div>
            <h1 className="sig-greet-title">
              Good {part}{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="sig-greet-sub">
              {hs
                ? `Here's where Signature Cleans stands today — ${hs.companyValuation ? `${fmtGBP(hs.companyValuation.companyValue)} company value` : `${fmtGBP(hs.annualValue)} annual run-rate`}, ${weeklyHoursDisplay} contracted hours/wk toward 1,000.`
                : "Here's where Signature Cleans stands today."}
            </p>
          </div>
          {showSeg && (
            <div className="sig-seg" role="tablist" style={{ ['--seg-count' as string]: views.length }}>
              <span
                className="sig-seg-glider"
                style={{
                  width: `calc((100% - 8px)/${views.length})`,
                  transform: `translateX(${activeIdx * 100}%)`,
                }}
              />
              {views.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`sig-seg-btn${view === v.id ? ' is-on' : ''}`}
                  onClick={() => setView(v.id)}
                  role="tab"
                  aria-selected={view === v.id}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: '2px solid var(--brand-blue)',
                borderTopColor: 'transparent',
                animation: 'spin 0.7s linear infinite',
              }}
            />
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading...</p>
          </div>
        )}

        {/* ── Hero growth band (dark) — centerpiece: hours toward 1,000 ── */}
        {!loading && hs && (
          <section className="sig-hero sig-hero--nochart">
            <div className="sig-hero-grain" />
            <div className="sig-hero-left">
              <div className="sig-eyebrow sig-eyebrow-on-dark">
                <Target size={14} /> Growth to 1,000 / wk
              </div>
              <div className="sig-hero-figure">
                <span className="sig-hero-num">{weeklyHoursDisplay}</span>
                <span className="sig-hero-den">/ {TARGET.toLocaleString()} hrs</span>
              </div>
              <div className="sig-hero-pills">
                <span className="sig-pill sig-pill-ghost">{pct}% to target</span>
                {ah && (
                  <span className="sig-pill sig-pill-green">
                    <TrendingUp size={13} strokeWidth={2.2} /> {ah.weeklyActualHours} actual hrs
                  </span>
                )}
              </div>
              <div className="sig-hero-foot">
                <span>Contracted weekly hours · {hs.activeContracts} active contracts</span>
              </div>
            </div>

            <div className="sig-hero-right">
              <div className="sig-gauge-wrap">
                <ArcGauge value={weeklyHours} max={TARGET} color="#9FE870" size={130} />
                <div className="sig-gauge-center">
                  <span className="sig-gauge-pct">
                    {pct}
                    <i>%</i>
                  </span>
                  <span className="sig-gauge-lbl">of target</span>
                </div>
              </div>
              <div className="sig-runrate">
                <RunFig label="Weekly" value={fmtGBP(hs.weeklyEarnings)} />
                <RunFig label="Monthly" value={fmtGBP(hs.monthlyEarnings)} />
                {hs.companyValuation ? (
                  <RunFig
                    label="Company value"
                    value={fmtGBP(hs.companyValuation.companyValue)}
                    sub={`${hs.companyValuation.multiple}× profit · ${fmtGBP(hs.companyValuation.systemisedUpside)} at ${hs.companyValuation.systemisedMultiple}× systemised`}
                    hi
                  />
                ) : (
                  <RunFig label="Annual run-rate" value={fmtGBP(hs.annualValue)} hi />
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Stat row (real metrics only) ── */}
        {!loading && statCards.length > 0 && (
          <div className="sig-stat-row">
            {statCards.map((c) => (
              <div key={c.id} className="sig-card sig-stat-card">
                <div className="sig-stat-top">
                  <span className="sig-stat-label">{c.label}</span>
                </div>
                <div className="sig-stat-value">{c.value}</div>
                <div className="sig-stat-bottom">
                  <span className="sig-stat-sub">{c.sub}</span>
                  {c.spark.length > 1 && <Sparkline data={c.spark} color={c.color} width={78} height={26} />}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Section tiles → drill into Sales / Operations ── */}
        {!loading && data && (
          <div
            className="sig-section-tiles"
            style={{
              display: 'grid',
              gap: 'var(--gap, 18px)',
              gridTemplateColumns: showSales && showOps && isSales && isOps ? '1fr 1fr' : '1fr',
            }}
          >
            {showSales && isSales && (
              <Link href="/dashboard/sales" className="sig-stat-link" style={{ textDecoration: 'none', display: 'block' }}>
                <section className="sig-card sig-pipe">
                  <div className="sig-card-head">
                    <div>
                      <span className="sig-eyebrow">
                        <TrendingUp size={14} /> Sales pipeline
                      </span>
                      <h3 className="sig-card-title">{pipelineTotal > 0 ? fmtK(pipelineTotal) : '£0'} open</h3>
                    </div>
                    <span className="sig-link">
                      Open board <ArrowRight size={14} />
                    </span>
                  </div>
                  {activePipeline.length > 0 ? (
                    <div className="sig-funnel">
                      {activePipeline.map((st) => (
                        <div key={st.stage} className="sig-funnel-row">
                          <span className="sig-funnel-label">{stageLabel(st.stage)}</span>
                          <div className="sig-funnel-track">
                            <div
                              className="sig-funnel-bar"
                              style={{ width: `${Math.max(8, (st.count / maxPipe) * 100)}%`, background: stageColor(st.stage) }}
                            >
                              <span className="sig-funnel-count">{st.count}</span>
                            </div>
                          </div>
                          <span className="sig-lead-val" style={{ minWidth: 56, textAlign: 'right' }}>
                            {fmtK(st.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="sig-stat-sub">No open deals yet.</p>
                  )}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16 }}>
                    {[
                      `${data.totalLeads ?? 0} leads`,
                      `${data.totalDeals ?? 0} deals`,
                      `${data.quotesThisMonth?.count ?? 0} quotes`,
                    ].map((label) => (
                      <span
                        key={label}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: 20,
                          background: 'var(--brand-blue-subtle, rgba(32,86,164,0.07))',
                          color: 'var(--brand-blue)',
                          border: '1px solid rgba(32,86,164,0.12)',
                        }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </section>
              </Link>
            )}

            {showOps && isOps && hs && (
              <Link href="/dashboard/ops" className="sig-stat-link" style={{ textDecoration: 'none', display: 'block' }}>
                <section className="sig-card sig-shifts">
                  <div className="sig-card-head">
                    <div>
                      <span className="sig-eyebrow">
                        <Clock size={14} /> Operations
                      </span>
                      <h3 className="sig-card-title">{weeklyHoursDisplay} hrs/wk contracted</h3>
                    </div>
                    <span className="sig-link">
                      View ops <ArrowRight size={14} />
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className="sig-shift-tally">
                      <b>{hs.activeContracts}</b> contracts
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
                    {[
                      `${fmtGBP(hs.monthlyEarnings)}/mo`,
                      ...(ah ? [`${ah.uniqueOperatives} clocked`, `${ah.weeklyActualHours} actual hrs`] : []),
                      ...(overdueShifts > 0 ? [`${overdueShifts} overdue`] : []),
                    ].map((label) => (
                      <span
                        key={label}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: 20,
                          background: 'var(--brand-green-subtle, rgba(107,142,35,0.10))',
                          color: '#5a8f1c',
                          border: '1px solid rgba(125,178,39,0.16)',
                        }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  {ah && (
                    <div className="sig-shift-foot">
                      <Clock size={13} /> {ah.weeklyActualHours} actual hours logged this week
                    </div>
                  )}
                </section>
              </Link>
            )}
          </div>
        )}

        {/* ── Alerts (overdue tasks / upcoming events) ── */}
        {!loading && data && (data.overdueTasks > 0 || data.upcomingEvents > 0) && (
          <div className="sig-section-tiles" style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr' }}>
            <div className="sig-today">
              <div className="sig-today-head">
                <span className="sig-eyebrow">
                  <Calendar size={14} /> Today
                </span>
                <span className="sig-today-meta">
                  {data.overdueTasks} overdue · {data.upcomingEvents} event{data.upcomingEvents === 1 ? '' : 's'} this week
                </span>
              </div>
              <div className="sig-today-list">
                {data.overdueTasks > 0 && (
                  <Link href="/dashboard/tasks" className="sig-today-item" style={{ textDecoration: 'none' }}>
                    <span className="sig-today-time" style={{ color: 'var(--status-danger)' }}>
                      {data.overdueTasks}
                    </span>
                    <span className="sig-today-bar" style={{ background: 'var(--status-danger)' }} />
                    <span className="sig-today-title">
                      Overdue task{data.overdueTasks === 1 ? '' : 's'}
                    </span>
                    <span className="sig-today-tag" style={{ ['--c' as string]: 'var(--status-danger)' }}>
                      Action
                    </span>
                  </Link>
                )}
                {data.upcomingEvents > 0 && (
                  <Link href="/dashboard/calendar" className="sig-today-item" style={{ textDecoration: 'none' }}>
                    <span className="sig-today-time" style={{ color: 'var(--status-info)' }}>
                      {data.upcomingEvents}
                    </span>
                    <span className="sig-today-bar" style={{ background: 'var(--status-info)' }} />
                    <span className="sig-today-title">
                      Event{data.upcomingEvents === 1 ? '' : 's'} this week
                    </span>
                    <span className="sig-today-tag" style={{ ['--c' as string]: 'var(--status-info)' }}>
                      Calendar
                    </span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Sync footer ── */}
        {!loading && hs && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: 'var(--status-success)',
                flexShrink: 0,
              }}
            />
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Synced {new Date(hs.fetchedAt).toLocaleString('en-GB')}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
