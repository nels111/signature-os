'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Users, RefreshCw } from 'lucide-react'
import type { OperativesResponse, OperativeSummary } from '@/app/api/operatives/route'

const REFRESH_INTERVAL = 5 * 60 * 1000

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status: OperativeSummary['status']): string {
  switch (status) {
    case 'active':    return '#22c55e'
    case 'at_risk':   return '#ef4444'
    case 'no_shifts': return '#64748b'
  }
}

function statusBg(status: OperativeSummary['status']): string {
  switch (status) {
    case 'active':    return 'rgba(34,197,94,0.10)'
    case 'at_risk':   return 'rgba(239,68,68,0.10)'
    case 'no_shifts': return 'rgba(100,116,139,0.10)'
  }
}

function statusLabel(status: OperativeSummary['status']): string {
  switch (status) {
    case 'active':    return 'Active'
    case 'at_risk':   return 'At Risk'
    case 'no_shifts': return 'No Shifts'
  }
}

function compliancePill(rate: number | null) {
  if (rate === null) return <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data</span>
  const color = rate >= 90 ? '#22c55e' : rate >= 75 ? '#f59e0b' : '#ef4444'
  const bg = rate >= 90 ? 'rgba(34,197,94,0.12)' : rate >= 75 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)'
  return (
    <span style={{
      background: bg, color, padding: '2px 8px', borderRadius: 6,
      fontSize: 12, fontWeight: 600
    }}>
      {rate}%
    </span>
  )
}

// ── Summary strip ─────────────────────────────────────────────────────────────

function SummaryStrip({ operatives, activeFilter, onFilter }: {
  operatives: OperativeSummary[]
  activeFilter: string
  onFilter: (f: string) => void
}) {
  const total = operatives.length
  const active = operatives.filter(o => o.status === 'active').length
  const atRisk = operatives.filter(o => o.status === 'at_risk').length
  const noShifts = operatives.filter(o => o.status === 'no_shifts').length

  const pills = [
    { key: 'all',       label: 'All',       count: total,    color: 'var(--text-secondary)' },
    { key: 'active',    label: 'Active',    count: active,   color: '#22c55e' },
    { key: 'at_risk',   label: 'At Risk',   count: atRisk,   color: '#ef4444' },
    { key: 'no_shifts', label: 'No Shifts', count: noShifts, color: '#64748b' },
  ]

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
      {pills.map(p => (
        <button
          key={p.key}
          onClick={() => onFilter(p.key)}
          style={{
            padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
            background: activeFilter === p.key ? p.color : 'var(--surface-raised)',
            color: activeFilter === p.key ? '#fff' : 'var(--text-secondary)',
            boxShadow: activeFilter === p.key ? `0 0 0 2px ${p.color}40` : 'none',
          }}
        >
          {p.label} <span style={{ opacity: 0.8, marginLeft: 4 }}>{p.count}</span>
        </button>
      ))}
    </div>
  )
}

// ── Mobile card ───────────────────────────────────────────────────────────────

function OperativeCard({ op, onClick }: { op: OperativeSummary; onClick: () => void }) {
  const sc = statusColor(op.status);
  return (
    <div
      className="sig-contract-card"
      onClick={onClick}
      style={{
        background: `radial-gradient(ellipse at 85% 0%, ${sc}0D 0%, #ffffff 55%)`,
        borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: `0 1px 0 rgba(255,255,255,0.8) inset, 0 0 0 1px ${sc}1A, 0 2px 8px rgba(0,0,0,0.05), 0 10px 28px rgba(0,0,0,0.04)`,
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        background: `${statusColor(op.status)}22`,
        border: `2px solid ${statusColor(op.status)}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700, color: statusColor(op.status),
      }}>
        {op.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{op.name}</div>
            {op.entity && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{op.entity}</div>}
          </div>
          <span style={{
            background: statusBg(op.status), color: statusColor(op.status),
            padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, flexShrink: 0,
          }}>
            {statusLabel(op.status)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {compliancePill(op.complianceRate)}
          {op.thisWeekHours > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {op.thisWeekHours}h this week
            </span>
          )}
          {op.assignedJobs.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {op.assignedJobs.length} site{op.assignedJobs.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Desktop row ───────────────────────────────────────────────────────────────

function OperativeRow({ op, onClick }: { op: OperativeSummary; onClick: () => void }) {
  return (
    <tr
      onClick={onClick}
      style={{ cursor: 'pointer', transition: 'background 0.1s' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-raised)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: `${statusColor(op.status)}22`,
            border: `2px solid ${statusColor(op.status)}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: statusColor(op.status),
          }}>
            {op.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{op.name}</div>
            {op.entity && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{op.entity}</div>}
          </div>
        </div>
      </td>
      <td style={{ padding: '12px 16px' }}>
        <span style={{
          background: statusBg(op.status), color: statusColor(op.status),
          padding: '3px 9px', borderRadius: 6, fontSize: 12, fontWeight: 600,
        }}>
          {statusLabel(op.status)}
        </span>
      </td>
      <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontSize: 14 }}>
        {op.thisWeekHours > 0 ? `${op.thisWeekHours}h` : '-'}
        {op.thisWeekShifts > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
            ({op.thisWeekShifts} shifts)
          </span>
        )}
      </td>
      <td style={{ padding: '12px 16px' }}>{compliancePill(op.complianceRate)}</td>
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {op.assignedJobs.slice(0, 3).map(j => (
            <span key={j} style={{
              background: 'var(--surface-raised)', color: 'var(--text-secondary)',
              padding: '2px 7px', borderRadius: 4, fontSize: 11,
            }}>
              {j}
            </span>
          ))}
          {op.assignedJobs.length > 3 && (
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              +{op.assignedJobs.length - 3}
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function OperativesList() {
  const router = useRouter()
  const [data, setData] = useState<OperativesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/operatives')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: OperativesResponse = await res.json()
      setData(json)
      setLastUpdated(new Date())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_INTERVAL)
    return () => clearInterval(t)
  }, [load])

  const filtered = data?.operatives.filter(o =>
    filter === 'all' || o.status === filter
  ) ?? []

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 28px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'rgba(99,102,241,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Users size={20} color="#818cf8" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 700, color: 'var(--text-primary)' }}>
              Operatives
            </h1>
            {data && (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                W/E {data.weekEnd} · {data.operatives.length} total
              </p>
            )}
          </div>
        </div>
        <button
          onClick={load}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
            background: 'var(--surface-raised)', border: '1px solid var(--border)',
            borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)',
            flexShrink: 0,
          }}
        >
          <RefreshCw size={13} />
          {!isMobile && 'Refresh'}
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          Loading operatives...
        </div>
      )}

      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 8, marginBottom: 16,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#f87171', fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {data && (
        <>
          <SummaryStrip operatives={data.operatives} activeFilter={filter} onFilter={setFilter} />

          {isMobile ? (
            /* Mobile: card list */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                  No operatives found
                </div>
              ) : (
                filtered.map(op => (
                  <OperativeCard
                    key={op.userId}
                    op={op}
                    onClick={() => router.push(`/dashboard/operatives/${op.userId}`)}
                  />
                ))
              )}
            </div>
          ) : (
            /* Desktop: table */
            <div style={{
              background: '#ffffff',
              borderRadius: 12, overflow: 'hidden',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.05), 0 14px 40px rgba(0,0,0,0.05)',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Operative', 'Status', 'This Week', '4-wk Compliance', 'Assigned Sites'].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px', textAlign: 'left',
                        fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                        color: 'var(--text-muted)', textTransform: 'uppercase',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                        No operatives found
                      </td>
                    </tr>
                  ) : (
                    filtered.map(op => (
                      <OperativeRow
                        key={op.userId}
                        op={op}
                        onClick={() => router.push(`/dashboard/operatives/${op.userId}`)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {lastUpdated && (
            <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
              Updated {lastUpdated.toLocaleTimeString('en-GB')}
            </p>
          )}
        </>
      )}
    </div>
  )
}
