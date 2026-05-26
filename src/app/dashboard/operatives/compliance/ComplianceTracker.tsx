'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, ShieldAlert, ShieldX, ShieldOff, RefreshCw, AlertTriangle } from 'lucide-react'
import type { ComplianceResponse, CompliancePendingResponse, ComplianceRow } from '@/app/api/compliance/route'

// ── Status helpers ─────────────────────────────────────────────────────────────

type Status = 'valid' | 'expiring_soon' | 'expired' | 'missing'

function statusColor(s: Status | string): string {
  switch (s) {
    case 'valid':         return '#22c55e'
    case 'expiring_soon': return '#f59e0b'
    case 'expired':       return '#ef4444'
    default:              return '#64748b'
  }
}

function statusBg(s: Status | string): string {
  switch (s) {
    case 'valid':         return 'rgba(34,197,94,0.10)'
    case 'expiring_soon': return 'rgba(245,158,11,0.10)'
    case 'expired':       return 'rgba(239,68,68,0.10)'
    default:              return 'rgba(100,116,139,0.10)'
  }
}

function statusLabel(s: Status | string): string {
  switch (s) {
    case 'valid':         return 'Valid'
    case 'expiring_soon': return 'Expiring'
    case 'expired':       return 'Expired'
    default:              return 'Missing'
  }
}

function StatusIcon({ status, size = 14 }: { status: Status | string; size?: number }) {
  switch (status) {
    case 'valid':         return <ShieldCheck size={size} color="#22c55e" />
    case 'expiring_soon': return <ShieldAlert size={size} color="#f59e0b" />
    case 'expired':       return <ShieldX size={size} color="#ef4444" />
    default:              return <ShieldOff size={size} color="#94a3b8" />
  }
}

function StatusPill({ status }: { status: Status | string }) {
  const color = statusColor(status)
  const bg    = statusBg(status)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: bg, color, padding: '2px 8px',
      borderRadius: 6, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <StatusIcon status={status} size={11} />
      {statusLabel(status)}
    </span>
  )
}

function fmtExpiry(iso: string | null, permanent?: boolean): string {
  if (permanent || iso === null) return 'Permanent'
  const d = new Date(iso)
  const days = Math.floor((d.getTime() - Date.now()) / 86400000)
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
  if (days < 0) return `${date} (${Math.abs(days)}d ago)`
  if (days <= 30) return `${date} (${days}d)`
  return date
}

function expiryColor(iso: string | null, status: string): string {
  if (!iso) return 'var(--text-muted)'
  if (status === 'expired')       return '#ef4444'
  if (status === 'expiring_soon') return '#f59e0b'
  return 'var(--text-secondary)'
}

// ── Summary strip ──────────────────────────────────────────────────────────────

function SummaryStrip({
  summary,
  filter,
  onFilter,
}: {
  summary: ComplianceResponse['summary']
  filter: string
  onFilter: (f: string) => void
}) {
  const pills = [
    { key: 'all',          label: 'All',      count: summary.total,         color: 'var(--text-secondary)' },
    { key: 'missing',      label: 'Missing',  count: summary.missing,       color: '#64748b' },
    { key: 'expired',      label: 'Expired',  count: summary.expired,       color: '#ef4444' },
    { key: 'expiring_soon',label: 'Expiring', count: summary.expiring_soon, color: '#f59e0b' },
    { key: 'valid',        label: 'Valid',    count: summary.valid,         color: '#22c55e' },
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
            background: filter === p.key ? p.color : 'var(--surface-raised)',
            color:      filter === p.key ? '#fff'  : 'var(--text-secondary)',
            boxShadow:  filter === p.key ? `0 0 0 2px ${p.color}40` : 'none',
          }}
        >
          {p.label} <span style={{ opacity: 0.75 }}>({p.count})</span>
        </button>
      ))}
    </div>
  )
}

// ── Mobile card ────────────────────────────────────────────────────────────────

function OperativeCard({ row }: { row: ComplianceRow }) {
  const c = row.compliance
  const overall = c?.overallStatus ?? 'missing'
  const color   = statusColor(overall)

  return (
    <div style={{
      background: '#ffffff', borderRadius: 12,
      boxShadow: '0 0 0 1px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04)',
      padding: '14px 16px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>
            {row.fullName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.entity}</div>
        </div>
        <StatusPill status={overall} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: 'DBS',       status: c?.dbsStatus ?? 'missing',       expiry: c?.dbsExpiry ?? null,       perm: c?.dbsUpdateService },
          { label: 'Insurance', status: c?.insuranceStatus ?? 'missing',  expiry: c?.insuranceExpiry ?? null,  perm: false },
          { label: 'RTW',       status: c?.rtwStatus ?? 'missing',        expiry: c?.rtwExpiry ?? null,        perm: c?.rtwExpiry === null && c?.rtwStatus !== 'missing' },
        ].map(item => (
          <div key={item.label} style={{
            background: statusBg(item.status), borderRadius: 8, padding: '8px 10px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 3 }}>
              {item.label}
            </div>
            <StatusIcon status={item.status} size={14} />
            <div style={{ fontSize: 11, color: expiryColor(item.expiry, item.status), marginTop: 3 }}>
              {item.expiry || item.perm ? fmtExpiry(item.expiry, item.perm) : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Desktop table row ──────────────────────────────────────────────────────────

function OperativeRow({ row }: { row: ComplianceRow }) {
  const c = row.compliance
  const cells = [
    { status: c?.dbsStatus ?? 'missing',       expiry: c?.dbsExpiry ?? null,       perm: c?.dbsUpdateService },
    { status: c?.insuranceStatus ?? 'missing',  expiry: c?.insuranceExpiry ?? null,  perm: false },
    { status: c?.rtwStatus ?? 'missing',        expiry: c?.rtwExpiry ?? null,        perm: c?.rtwExpiry === null && c?.rtwStatus !== 'missing' },
  ]

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '11px 16px' }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{row.fullName}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{row.entity}</div>
      </td>
      <td style={{ padding: '11px 16px' }}>
        <StatusPill status={c?.overallStatus ?? 'missing'} />
      </td>
      {cells.map((cell, i) => (
        <td key={i} style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusIcon status={cell.status} size={13} />
            <div>
              <div style={{ fontSize: 12, color: statusColor(cell.status), fontWeight: 600 }}>
                {statusLabel(cell.status)}
              </div>
              {(cell.expiry || cell.perm) && (
                <div style={{ fontSize: 11, color: expiryColor(cell.expiry, cell.status), marginTop: 1 }}>
                  {fmtExpiry(cell.expiry, cell.perm)}
                </div>
              )}
            </div>
          </div>
        </td>
      ))}
    </tr>
  )
}

// ── Migration pending banner ───────────────────────────────────────────────────

function MigrationPending() {
  return (
    <div style={{
      background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
      borderRadius: 12, padding: '20px 24px', marginBottom: 24,
      display: 'flex', gap: 14, alignItems: 'flex-start',
    }}>
      <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e', marginBottom: 6 }}>
          Database migration pending
        </div>
        <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.55 }}>
          The compliance tables haven&apos;t been created yet. To activate this tracker, run:
        </div>
        <code style={{
          display: 'block', marginTop: 10, padding: '8px 12px',
          background: 'rgba(0,0,0,0.06)', borderRadius: 6,
          fontSize: 12, fontFamily: 'monospace', color: '#44403c',
        }}>
          psql $DATABASE_URL -f scripts/migrations/compliance-tracker.sql
        </code>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          Then reload this page. No existing data will be affected.
        </div>
      </div>
    </div>
  )
}

// ── Empty data state ───────────────────────────────────────────────────────────

function EmptyData({ summary }: { summary: ComplianceResponse['summary'] }) {
  return (
    <div style={{
      background: '#ffffff', borderRadius: 12,
      boxShadow: '0 0 0 1px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04)',
      padding: '40px 24px', textAlign: 'center',
    }}>
      <ShieldOff size={36} color="#94a3b8" style={{ margin: '0 auto 14px' }} />
      <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 6 }}>
        No compliance data yet
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 360, margin: '0 auto', lineHeight: 1.6 }}>
        {summary.total > 0
          ? `${summary.total} operatives are seeded. Compliance documents are pending from subcontractor leads.`
          : 'Run the seeder to import operatives, then collect compliance docs from subcontractor leads.'}
      </div>
      <code style={{
        display: 'inline-block', marginTop: 14, padding: '6px 12px',
        background: 'var(--surface-raised)', borderRadius: 6,
        fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)',
      }}>
        node scripts/seed-compliance.mjs
      </code>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function ComplianceTracker() {
  const router = useRouter()
  const [data,    setData]    = useState<ComplianceResponse | null>(null)
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')
  const [entity,  setEntity]  = useState('all')
  const [error,   setError]   = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('filter', filter)
      if (entity !== 'all') params.set('entity', entity)
      const res  = await fetch(`/api/compliance?${params}`)
      const json = await res.json() as ComplianceResponse | CompliancePendingResponse
      if (!json.migrationApplied) {
        setPending(true)
        setData(null)
      } else {
        setPending(false)
        setData(json as ComplianceResponse)
      }
    } catch (e) {
      setError('Failed to load compliance data.')
    } finally {
      setLoading(false)
    }
  }, [filter, entity])

  useEffect(() => { load() }, [load])

  // Derive entity list from data
  const entities = data
    ? ['all', ...Array.from(new Set(data.rows.map(r => r.entity))).sort()]
    : ['all']

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '16px 12px' : '24px 20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{
            fontSize: isMobile ? 22 : 28, fontWeight: 800, color: 'var(--text-primary)',
            letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1,
          }}>
            Compliance Tracker
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '6px 0 0' }}>
            DBS, insurance &amp; right-to-work across all 22 operatives
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8, border: 'none',
            background: 'var(--surface-raised)', color: 'var(--text-secondary)',
            cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13,
            opacity: loading ? 0.6 : 1,
          }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Migration pending */}
      {pending && <MigrationPending />}

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 10, padding: '14px 16px', marginBottom: 20,
          color: '#b91c1c', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Summary + filters */}
      {data && (
        <>
          {/* Summary cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: 12, marginBottom: 20,
          }}>
            {[
              { label: 'Missing',  count: data.summary.missing,       status: 'missing' as Status,       icon: <ShieldOff size={18} color="#94a3b8" /> },
              { label: 'Expired',  count: data.summary.expired,       status: 'expired' as Status,       icon: <ShieldX size={18} color="#ef4444" /> },
              { label: 'Expiring', count: data.summary.expiring_soon, status: 'expiring_soon' as Status, icon: <ShieldAlert size={18} color="#f59e0b" /> },
              { label: 'Valid',    count: data.summary.valid,         status: 'valid' as Status,         icon: <ShieldCheck size={18} color="#22c55e" /> },
            ].map(card => (
              <button
                key={card.label}
                onClick={() => setFilter(filter === card.status ? 'all' : card.status)}
                style={{
                  background: '#ffffff', borderRadius: 12, padding: '14px 16px',
                  boxShadow: filter === card.status
                    ? `0 0 0 2px ${statusColor(card.status)}, 0 2px 8px rgba(0,0,0,0.04)`
                    : '0 0 0 1px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04)',
                  border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'box-shadow 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 6 }}>
                      {card.label}
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.03em' }}>
                      {card.count}
                    </div>
                  </div>
                  {card.icon}
                </div>
              </button>
            ))}
          </div>

          {/* Entity filter + status filter pills */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            {/* Entity tabs */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {entities.map(e => (
                <button key={e} onClick={() => setEntity(e)} style={{
                  padding: '4px 12px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  background: entity === e ? 'var(--text-primary)' : 'var(--surface-raised)',
                  color:      entity === e ? '#fff' : 'var(--text-secondary)',
                }}>
                  {e === 'all' ? 'All teams' : e}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          {data.rows.length === 0 && data.summary.total === 0 && (
            <EmptyData summary={data.summary} />
          )}

          {data.rows.length === 0 && data.summary.total > 0 && (
            <div style={{
              background: '#ffffff', borderRadius: 12,
              boxShadow: '0 0 0 1px rgba(0,0,0,0.07)', padding: '32px 24px', textAlign: 'center',
            }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                No operatives match this filter.
              </div>
            </div>
          )}

          {data.rows.length > 0 && isMobile && (
            <div>
              {data.rows.map(row => <OperativeCard key={row.id} row={row} />)}
            </div>
          )}

          {data.rows.length > 0 && !isMobile && (
            <div style={{
              background: '#ffffff', borderRadius: 12,
              boxShadow: '0 0 0 1px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
                    {['Operative', 'Overall', 'DBS', 'Insurance', 'Right to Work'].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map(row => <OperativeRow key={row.id} row={row} />)}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
            {data.rows.length} operatives · refreshed {new Date(data.fetchedAt).toLocaleTimeString('en-GB')}
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
