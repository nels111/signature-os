'use client';

import { useState, useEffect } from 'react';

interface Contract {
  name: string;
  cleanType: string;
  weeklyHours: number;
  weeklyEarnings: number;
  signedTerms: boolean;
}

interface GrowthData {
  currentHours: number;
  targetHours: number;
  progressPct: number;
  gap: number;
  weeksRemaining: number;
  weeklyGainNeeded: number;
  pipelineHours: number;
  activeContracts: Contract[];
  pipelineContracts: Contract[];
  weeklyEarnings: number;
  monthlyEarnings: number;
  fetchedAt: string | null;
}

const TARGET_DATE = new Date('2026-12-31');

export default function GrowthTracker() {
  const [data, setData] = useState<GrowthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllActive, setShowAllActive] = useState(false);

  useEffect(() => {
    fetch('/api/growth')
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)', fontSize: '14px' }}>
        Loading growth data...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#f87171', fontSize: '14px' }}>
        Failed to load data{error ? `: ${error}` : ''}
      </div>
    );
  }

  const pct = Math.min(100, (data.currentHours / data.targetHours) * 100);
  const now = new Date();
  const start = new Date('2026-01-01');
  const totalMs = TARGET_DATE.getTime() - start.getTime();
  const timePct = Math.min(100, Math.max(0, (now.getTime() - start.getTime()) / totalMs * 100));
  const coveragePct = data.pipelineHours > 0 ? Math.round((data.pipelineHours / data.gap) * 100) : 0;
  const requiredNewContracts = Math.ceil(data.weeklyGainNeeded / 15);
  const visibleActive = showAllActive ? data.activeContracts : data.activeContracts.slice(0, 6);

  const statColor = (type: 'good' | 'bad' | 'warn') =>
    type === 'good' ? '#4ade80' : type === 'bad' ? '#f87171' : '#fbbf24';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            G1: Hours Growth
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '3px 0 0 0' }}>
            1,000 hrs/wk by Dec 2026
            {data.fetchedAt && ` · ${new Date(data.fetchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </div>
        <span style={{
          padding: '4px 10px', borderRadius: 6, fontSize: '12px', fontWeight: 700,
          background: pct < 20 ? 'rgba(248,113,113,0.1)' : 'rgba(251,191,36,0.1)',
          color: pct < 20 ? '#f87171' : '#fbbf24',
          border: `1px solid ${pct < 20 ? 'rgba(248,113,113,0.25)' : 'rgba(251,191,36,0.25)'}`,
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          {pct.toFixed(1)}%
        </span>
      </div>

      {/* Compact progress bar */}
      <div style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(74,222,128,0.08) 0%, #ffffff 55%)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(74,222,128,0.2), 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)',
        borderRadius: 12, padding: '14px 16px',
      }}>
        {/* Month labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          {['Jan', 'Jun', 'Aug', 'Oct', 'Dec'].map(m => (
            <span key={m} style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {m}
            </span>
          ))}
        </div>

        {/* Track */}
        <div style={{ position: 'relative', height: 36, display: 'flex', alignItems: 'center' }}>
          {/* Background */}
          <div style={{ position: 'absolute', left: 0, right: 0, height: 6, background: 'var(--border)', borderRadius: 3 }} />
          {/* Fill */}
          <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 6, background: '#4ade80', borderRadius: 3, transition: 'width 0.8s ease' }} />
          {/* Milestone ticks */}
          {[{ pct: 20, val: 200 }, { pct: 40, val: 400 }, { pct: 65, val: 650 }, { pct: 100, val: 1000 }].map(m => (
            <div key={m.val} style={{ position: 'absolute', left: `${m.pct}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 2, height: 12, background: data.currentHours >= m.val ? '#4ade80' : 'var(--border)', borderRadius: 1 }} />
              <span style={{ color: data.currentHours >= m.val ? '#4ade80' : 'var(--text-muted)', fontSize: '9px', fontWeight: 700, marginTop: 2 }}>
                {m.val >= 1000 ? '1k' : m.val}
              </span>
            </div>
          ))}
          {/* Now pin */}
          <div style={{ position: 'absolute', left: `${timePct}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 2, height: 18, background: 'rgba(255,255,255,0.5)', borderRadius: 2 }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '8px', fontWeight: 700, marginTop: 2 }}>NOW</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>0</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>1,000 hrs</span>
        </div>
      </div>

      {/* Key metrics — 2×2 grid, no overflow */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
      }}>
        {[
          {
            label: 'Contracted', value: `${data.currentHours.toFixed(1)}`, unit: 'hrs/wk',
            sub: `£${data.weeklyEarnings.toFixed(0)}/wk`, color: statColor('good'),
          },
          {
            label: 'Gap to close', value: `${data.gap.toFixed(1)}`, unit: 'hrs/wk',
            sub: `${data.weeksRemaining} wks remaining`, color: statColor('bad'),
          },
          {
            label: 'Need per week', value: `${data.weeklyGainNeeded.toFixed(1)}`, unit: 'hrs',
            sub: `~${requiredNewContracts} Cell B contracts`, color: statColor('warn'),
          },
          {
            label: 'Pipeline', value: `${data.pipelineHours.toFixed(1)}`, unit: 'hrs/wk',
            sub: `${coveragePct}% of gap covered`, color: coveragePct >= 50 ? statColor('good') : statColor('warn'),
          },
        ].map(item => (
          <div key={item.label} className="sig-stat" style={{
            background: '#ffffff',
            boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)',
            borderRadius: 10, padding: '12px 14px',
          }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              {item.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 4 }}>
              <span style={{ color: item.color, fontSize: '22px', fontWeight: 700, lineHeight: 1 }}>{item.value}</span>
              <span style={{ color: item.color, fontSize: '12px', fontWeight: 600 }}>{item.unit}</span>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Active contracts */}
      <div style={{ background: '#ffffff', boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>
            Active — {data.activeContracts.length} contracts
          </span>
          <span style={{ color: '#4ade80', fontSize: '13px', fontWeight: 700 }}>
            {data.currentHours.toFixed(1)} hrs/wk
          </span>
        </div>
        {data.activeContracts.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>No active contracts</div>
        ) : (
          <>
            {visibleActive.map((c, i) => (
              <div
                key={c.name}
                style={{
                  display: 'flex', alignItems: 'center', padding: '10px 16px',
                  borderBottom: i < visibleActive.length - 1 ? '1px solid var(--border)' : 'none',
                  gap: 10,
                }}
              >
                <span style={{ color: i < 3 ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '12px', fontWeight: 700, width: 18, flexShrink: 0, textAlign: 'right' }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.name}
                  </div>
                  {c.cleanType && <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{c.cleanType}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>{c.weeklyHours.toFixed(1)} hrs</div>
                  {c.weeklyEarnings > 0 && <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>£{c.weeklyEarnings.toFixed(0)}/wk</div>}
                </div>
              </div>
            ))}
            {data.activeContracts.length > 6 && (
              <button
                onClick={() => setShowAllActive(v => !v)}
                style={{
                  width: '100%', padding: '9px 0', background: 'none', border: 'none',
                  cursor: 'pointer', color: 'var(--brand-blue)', fontSize: '12px', fontWeight: 600,
                  borderTop: '1px solid var(--border)',
                }}
              >
                {showAllActive ? '↑ Show less' : `↓ All ${data.activeContracts.length} contracts`}
              </button>
            )}
          </>
        )}
      </div>

      {/* Pipeline — compact summary + list */}
      <div style={{ background: '#ffffff', boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{
          padding: '12px 16px', borderBottom: data.pipelineContracts.length > 0 ? '1px solid var(--border)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>
            Pipeline — {data.pipelineContracts.length} contracts
          </span>
          <span style={{ color: '#fbbf24', fontSize: '13px', fontWeight: 700 }}>
            {data.pipelineHours.toFixed(1)} hrs potential
          </span>
        </div>
        {data.pipelineContracts.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>No pipeline contracts in sheet</div>
        ) : (
          data.pipelineContracts.map((c, i) => (
            <div
              key={c.name}
              style={{
                display: 'flex', alignItems: 'center', padding: '10px 16px',
                borderBottom: i < data.pipelineContracts.length - 1 ? '1px solid var(--border)' : 'none',
                gap: 10,
              }}
            >
              <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700, width: 18, flexShrink: 0, textAlign: 'right' }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                {c.cleanType && <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{c.cleanType}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ color: '#fbbf24', fontSize: '13px', fontWeight: 600 }}>{c.weeklyHours.toFixed(1)} hrs</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Trajectory summary — single line */}
      <div style={{
        background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)',
        borderRadius: 10, padding: '12px 16px',
        color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.6,
      }}>
        <span style={{ color: '#fbbf24', fontWeight: 700 }}>⚡ </span>
        Need <strong style={{ color: 'var(--text-primary)' }}>{data.weeklyGainNeeded.toFixed(1)} hrs/wk</strong> for {Math.floor(data.weeksRemaining)} weeks — roughly <strong style={{ color: 'var(--text-primary)' }}>{requiredNewContracts} Cell B contracts/wk</strong>. Pipeline covers <strong style={{ color: coveragePct >= 50 ? '#4ade80' : '#f87171' }}>{coveragePct}%</strong> of the gap.
      </div>

    </div>
  );
}
