'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight, Target } from 'lucide-react';
import { VaDashboard } from './VaDashboard';

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

// ── Donut chart (SVG, no library) ─────────────────────────────────────────────
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

// ── Pipeline bar chart ─────────────────────────────────────────────────────────
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

// ── Main dashboard ─────────────────────────────────────────────────────────────
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
            box-shadow: 0 1px 0 rgba(255,255,255,0.85) inset, 0 0 0 1px rgba(32,86,164,0.22), 0 4px 14px rgba(32,86,164,0.11), 0 20px 48px rgba(32,86,164,0.07) !important;
          }
          .sig-tile-ops:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 1px 0 rgba(255,255,255,0.85) inset, 0 0 0 1px rgba(125,178,39,0.28), 0 4px 14px rgba(125,178,39,0.11), 0 20px 48px rgba(125,178,39,0.07) !important;
          }
        }
        .sig-tile-sales:active, .sig-tile-ops:active { transform: scale(0.98) !important; transition-duration: 80ms !important; }
        @media (prefers-reduced-motion: reduce) {
          .sig-tile-sales, .sig-tile-ops { animation: none !important; transition: none !important; }
        }
        .sig-grid { display: grid; gap: 16px; margin-bottom: 20px; }
        .sig-grid-dual { grid-template-columns: 1fr 1fr; }
        @media (max-width: 639px) { .sig-grid-dual { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ position: 'relative' }}>
        {/* Ambient background orbs */}
        <div aria-hidden style={{ position: 'absolute', top: -60, left: -60, width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(32,86,164,0.05) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
        <div aria-hidden style={{ position: 'absolute', top: 40, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(125,178,39,0.05) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
                {greeting}{firstName ? `, ${firstName}` : ','}
              </h1>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, marginBottom: 0 }}>{dateStr}</p>
            </div>
            {hs && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 3 }}>Weekly hours</p>
                <p style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-primary)', lineHeight: 1 }}>
                  {hs.weeklyHours}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>/1,000</span>
                </p>
              </div>
            )}
          </div>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--brand-blue)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading...</p>
            </div>
          )}

          {/* Metric strip */}
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
                  style={{ fontSize: 11, fontWeight: 600, padding: '4px 11px', borderRadius: 20, background: `${chip.color}0d`, color: chip.color, border: `1px solid ${chip.color}20`, letterSpacing: '0.01em' }}
                >
                  {chip.label}: <strong style={{ fontWeight: 700 }}>{chip.value}</strong>
                </span>
              ))}
            </div>
          )}

          {/* Section tiles */}
          <div className={`sig-grid ${isSales && isOps ? 'sig-grid-dual' : ''}`}>
            {isSales && (
              <Link href="/dashboard/sales" style={{ textDecoration: 'none', display: 'block' }}>
                <div
                  className="sig-tile-sales rounded-2xl"
                  style={{
                    background: 'radial-gradient(ellipse at 22% 12%, rgba(32,86,164,0.1) 0%, rgba(32,86,164,0.02) 58%, transparent 100%), #ffffff',
                    boxShadow: '0 1px 0 rgba(255,255,255,0.75) inset, 0 0 0 1px rgba(32,86,164,0.13), 0 2px 5px rgba(32,86,164,0.06), 0 14px 36px rgba(32,86,164,0.05)',
                    padding: '22px 24px 24px', cursor: 'pointer', height: '100%',
                    animation: 'tileIn 440ms cubic-bezier(0.23,1,0.32,1) both',
                    transition: 'transform 180ms cubic-bezier(0.23,1,0.32,1), box-shadow 180ms cubic-bezier(0.23,1,0.32,1)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#2056a4' }}>Sales Pipeline</span>
                    <ChevronRight size={14} style={{ color: '#2056a4', opacity: 0.38 }} />
                  </div>
                  <p style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {pipelineTotal > 0 ? `£${(pipelineTotal / 1000).toFixed(1)}k` : '£0'}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 0 }}>total pipeline value</p>
                  {data?.pipelineValue && data.pipelineValue.length > 0 && <PipelineBar stages={data.pipelineValue} />}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16 }}>
                    {[`${data?.totalLeads ?? 0} leads`, `${data?.totalDeals ?? 0} deals`, `${data?.quotesThisMonth?.count ?? 0} quotes`].map(label => (
                      <span key={label} style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: 'rgba(32,86,164,0.07)', color: '#2056a4', border: '1px solid rgba(32,86,164,0.12)' }}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            )}

            {isOps && (
              <Link href="/dashboard/ops" style={{ textDecoration: 'none', display: 'block' }}>
                <div
                  className="sig-tile-ops rounded-2xl"
                  style={{
                    background: 'radial-gradient(ellipse at 78% 12%, rgba(125,178,39,0.11) 0%, rgba(125,178,39,0.02) 58%, transparent 100%), #ffffff',
                    boxShadow: '0 1px 0 rgba(255,255,255,0.75) inset, 0 0 0 1px rgba(125,178,39,0.17), 0 2px 5px rgba(125,178,39,0.06), 0 14px 36px rgba(125,178,39,0.05)',
                    padding: '22px 24px 24px', cursor: 'pointer', height: '100%',
                    animation: 'tileIn 440ms 55ms cubic-bezier(0.23,1,0.32,1) both',
                    transition: 'transform 180ms cubic-bezier(0.23,1,0.32,1), box-shadow 180ms cubic-bezier(0.23,1,0.32,1)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#5a8f1c' }}>Operations</span>
                      {overdueShifts > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                          {overdueShifts} overdue
                        </span>
                      )}
                    </div>
                    <ChevronRight size={14} style={{ color: '#5a8f1c', opacity: 0.38 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div>
                      <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1, color: 'var(--text-primary)' }}>{hs ? hs.weeklyHours : '--'}</span>
                      <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 5 }}>hrs/wk</span>
                    </div>
                    {hs && <DonutChart pct={goalPct} color="#5a8f1c" size={82} />}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>contracted weekly hours</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[`${hs?.activeContracts ?? 0} contracts`, ...(hs ? [`£${Number(hs.monthlyEarnings).toFixed(0)}/mo`] : []), ...(ah ? [`${ah.uniqueOperatives} clocked`] : [])].map(label => (
                      <span key={label} style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: 'rgba(125,178,39,0.09)', color: '#5a8f1c', border: '1px solid rgba(125,178,39,0.16)' }}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            )}
          </div>

          {/* Alerts */}
          {data && (data.overdueTasks > 0 || data.upcomingEvents > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              {data.overdueTasks > 0 && (
                <Link href="/dashboard/tasks" style={{ textDecoration: 'none' }}>
                  <div
                    className="rounded-xl"
                    style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'background 150ms ease' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.05)'; }}
                  >
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#dc2626', minWidth: 28, textAlign: 'center', lineHeight: 1 }}>{data.overdueTasks}</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', margin: 0 }}>overdue task{data.overdueTasks > 1 ? 's' : ''}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Needs attention</p>
                    </div>
                  </div>
                </Link>
              )}
              {data.upcomingEvents > 0 && (
                <Link href="/dashboard/calendar" style={{ textDecoration: 'none' }}>
                  <div
                    className="rounded-xl"
                    style={{ background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.15)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'background 150ms ease' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,99,235,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,99,235,0.05)'; }}
                  >
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#2563eb', minWidth: 28, textAlign: 'center', lineHeight: 1 }}>{data.upcomingEvents}</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', margin: 0 }}>event{data.upcomingEvents > 1 ? 's' : ''} this week</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Calendar</p>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          )}

          {/* Sync footer */}
          {hs && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--status-success)', flexShrink: 0 }} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Synced {new Date(hs.fetchedAt).toLocaleString('en-GB')}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
