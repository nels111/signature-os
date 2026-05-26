'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ContractHealth, HealthResponse } from '@/app/api/health/route'

const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status: ContractHealth['healthStatus']): string {
  switch (status) {
    case 'green': return '#22c55e'
    case 'amber': return '#f59e0b'
    case 'red':   return '#ef4444'
  }
}

function statusBg(status: ContractHealth['healthStatus']): string {
  switch (status) {
    case 'green': return 'rgba(34,197,94,0.10)'
    case 'amber': return 'rgba(245,158,11,0.10)'
    case 'red':   return 'rgba(239,68,68,0.10)'
  }
}

function statusLabel(status: ContractHealth['healthStatus']): string {
  switch (status) {
    case 'green': return 'Healthy'
    case 'amber': return 'Attention'
    case 'red':   return 'At Risk'
  }
}

function tierBadge(tier: string | null) {
  if (!tier) return null
  const colors: Record<string, { bg: string; text: string }> = {
    A: { bg: 'rgba(99,102,241,0.15)', text: '#818cf8' },
    B: { bg: 'rgba(20,184,166,0.15)', text: '#2dd4bf' },
    C: { bg: 'rgba(251,146,60,0.15)', text: '#fb923c' },
  }
  const c = colors[tier] ?? { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8' }
  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        padding: '1px 7px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.04em',
      }}
    >
      Cell {tier}
    </span>
  )
}

// ── Summary strip ─────────────────────────────────────────────────────────────

function SummaryStrip({ summary, activeFilter, onFilter }: {
  summary: HealthResponse['summary']
  activeFilter: string
  onFilter: (f: string) => void
}) {
  const pills = [
    { key: 'all',   label: 'All',       count: summary.total,  color: 'var(--text-secondary)' },
    { key: 'green', label: '🟢 Healthy', count: summary.green,  color: '#22c55e' },
    { key: 'amber', label: '🟡 Attention', count: summary.amber, color: '#f59e0b' },
    { key: 'red',   label: '🔴 At Risk', count: summary.red,    color: '#ef4444' },
  ]

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
      {pills.map(p => (
        <button
          key={p.key}
          onClick={() => onFilter(p.key)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '20px',
            border: activeFilter === p.key ? `1px solid ${p.color}` : '1px solid var(--border)',
            background: activeFilter === p.key ? `${p.color}18` : 'var(--card-bg)',
            color: activeFilter === p.key ? p.color : 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: activeFilter === p.key ? 600 : 400,
            transition: 'all 0.15s',
          }}
        >
          <span style={{ color: activeFilter === p.key ? p.color : 'var(--text-primary)', fontWeight: 700, fontSize: '15px' }}>{p.count}</span>
          <span>{p.label}</span>
        </button>
      ))}
    </div>
  )
}

// ── Contract card ─────────────────────────────────────────────────────────────

function ContractCard({ contract, onClick }: { contract: ContractHealth; onClick: () => void }) {
  const color = statusColor(contract.healthStatus)
  const bg = statusBg(contract.healthStatus)

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className="sig-contract-card"
      style={{
        background: `radial-gradient(ellipse at 50% 0%, ${bg} 0%, #ffffff 55%)`,
        boxShadow: `0 1px 0 rgba(255,255,255,0.8) inset, 0 0 0 1px ${color}22, 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)`,
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 160ms cubic-bezier(0.23,1,0.32,1), box-shadow 160ms cubic-bezier(0.23,1,0.32,1)',
        animation: 'cardIn 380ms cubic-bezier(0.23,1,0.32,1) both',
      }}
    >
      {/* Body */}
      <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            {contract.name}
          </span>
          <span
            style={{
              flexShrink: 0,
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600,
              background: bg,
              color: color,
              border: `1px solid ${color}40`,
            }}
          >
            {statusLabel(contract.healthStatus)}
          </span>
        </div>

        {/* Tier + billing type */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {tierBadge(contract.cellTier)}
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
            {contract.billingType === 'monthly_fixed' ? 'Monthly fixed' : 'Hourly'}
          </span>
          {!contract.rateConfirmed && (
            <span style={{ fontSize: '11px', color: '#f59e0b' }}>⚠ Rate unconfirmed</span>
          )}
        </div>

        {/* Metrics row */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hrs/wk</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {contract.weeklyHours !== null ? contract.weeklyHours.toFixed(1) : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Weekly rev</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {contract.weeklyRevenue !== null ? `£${contract.weeklyRevenue.toFixed(0)}` : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Margin</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: contract.grossMarginPct !== null ? color : 'var(--text-muted)' }}>
              {contract.grossMarginPct !== null ? `${contract.grossMarginPct}%` : '—'}
            </div>
          </div>
        </div>

        {/* Status reason */}
        <div style={{
          fontSize: '12px',
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border)',
          paddingTop: '8px',
          marginTop: 'auto',
          lineHeight: 1.4,
        }}>
          {contract.statusReason}
        </div>
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{ background: '#ffffff', boxShadow: '0 0 0 1px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04)', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[80, 60, 100].map((w, i) => (
          <div key={i} style={{ height: '14px', width: `${w}%`, background: 'var(--border)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HealthDashboard() {
  const router = useRouter()
  const [data, setData] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [lastUpdated, setLastUpdated] = useState<string>('')

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/health')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: HealthResponse = await res.json()
      setData(json)
      setError(null)
      setLastUpdated(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load health data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchData])

  const filtered = data?.contracts.filter(c =>
    filter === 'all' || c.healthStatus === filter
  ) ?? []

  return (
    <div style={{ padding: '24px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Contract Health
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            RAG status across all active contracts — current week
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastUpdated && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Updated {lastUpdated}
            </span>
          )}
          <button
            onClick={fetchData}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--card-bg)',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && !data && (
        <div style={{ padding: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* Connecteam warning */}
      {data && !data.connecteamAvailable && (
        <div style={{ padding: '10px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', color: '#f59e0b', fontSize: '13px', marginBottom: '16px' }}>
          ⚠ Connecteam data unavailable — showing billing estimates only
        </div>
      )}

      {/* Summary strip */}
      {data && (
        <SummaryStrip summary={data.summary} activeFilter={filter} onFilter={setFilter} />
      )}

      {/* Card grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '14px',
        }}
      >
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : filtered.map(contract => (
              <ContractCard
                key={contract.id}
                contract={contract}
                onClick={() => router.push(`/dashboard/contracts/${contract.id}`)}
              />
            ))
        }
      </div>

      {/* Empty state */}
      {!loading && filtered.length === 0 && data && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          No contracts match this filter
        </div>
      )}

      {/* Footer */}
      {data && (
        <p style={{ marginTop: '24px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'right' }}>
          Auto-refreshes every 5 min · {data.contracts.length} contracts
        </p>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}
