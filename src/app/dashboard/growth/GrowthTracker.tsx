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

      {/* Milestone Gates */}
      {(() => {
        const gates = [
          { hours: 200, label: '200', month: 'Jun', position: 0 },
          { hours: 400, label: '400', month: 'Aug', position: 1 },
          { hours: 650, label: '650', month: 'Oct', position: 2 },
          { hours: 1000, label: '1k',  month: 'Dec', position: 3 },
        ];
        const nextIdx = gates.findIndex(g => data.currentHours < g.hours);
        return (
          <div style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(74,222,128,0.07) 0%, #ffffff 60%)',
            boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(74,222,128,0.18), 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)',
            borderRadius: 12, padding: '16px',
          }}>
            {/* Current hours */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 18 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: '#4ade80', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {data.currentHours.toFixed(0)}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>hrs/wk</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                target 1,000 · Dec 2026
              </span>
            </div>

            {/* Gate track */}
            <div style={{ position: 'relative' }}>
              {/* Track line — sits at node centre height (16px from top of this div) */}
              <div style={{
                position: 'absolute', top: 16, left: 16, right: 16,
                height: 2, background: 'rgba(0,0,0,0.06)', borderRadius: 1,
              }} />
              {/* Progress fill — proportional to hours, scaled across gate span */}
              <div style={{
                position: 'absolute', top: 16, left: 16,
                width: `calc(${Math.min(pct, 100) / 100} * (100% - 32px))`,
                height: 2, background: '#4ade80', borderRadius: 1,
                transition: 'width 0.9s ease',
              }} />

              {/* Gates */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                {gates.map((g, i) => {
                  const passed = data.currentHours >= g.hours;
                  const isNext = i === nextIdx;
                  const nodeColor = passed ? '#4ade80' : isNext ? '#fbbf24' : 'var(--border)';
                  const textColor = passed ? '#4ade80' : isNext ? '#f59e0b' : 'var(--text-muted)';
                  return (
                    <div key={g.hours} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      {/* Node */}
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: passed ? '#4ade80' : isNext ? 'rgba(251,191,36,0.12)' : 'rgba(0,0,0,0.04)',
                        border: `2px solid ${nodeColor}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: passed ? '#fff' : textColor,
                        boxShadow: isNext ? '0 0 0 4px rgba(251,191,36,0.12)' : passed ? '0 0 0 3px rgba(74,222,128,0.15)' : 'none',
                        position: 'relative', zIndex: 1,
                        transition: 'all 0.3s ease',
                      }}>
                        {passed ? '✓' : g.position + 1}
                      </div>
                      {/* Labels */}
                      <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: textColor, letterSpacing: '-0.02em' }}>
                          {g.label}
                          <span style={{ fontSize: 9, fontWeight: 600, marginLeft: 1 }}>hrs</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginTop: 1 }}>
                          {g.month}
                        </div>
                        <div style={{
                          fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                          color: passed ? '#4ade80' : isNext ? '#f59e0b' : 'rgba(0,0,0,0.2)',
                          marginTop: 2,
                        }}>
                          {passed ? 'Done' : isNext ? 'Next' : '·'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

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
