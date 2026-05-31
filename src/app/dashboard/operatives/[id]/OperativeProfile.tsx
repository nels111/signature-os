'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react'
import type { OperativeDetail, ShiftRecord, WeekSummary } from '@/app/api/operatives/[id]/route'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  })
}

function shiftStatusColor(status: ShiftRecord['status']): string {
  switch (status) {
    case 'on_time':  return '#22c55e'
    case 'late':     return '#f59e0b'
    case 'no_show':  return '#ef4444'
    case 'upcoming': return '#64748b'
  }
}

function shiftStatusLabel(status: ShiftRecord['status']): string {
  switch (status) {
    case 'on_time':  return 'On Time'
    case 'late':     return 'Late'
    case 'no_show':  return 'No Show'
    case 'upcoming': return 'Upcoming'
  }
}

function shiftStatusIcon(status: ShiftRecord['status']) {
  switch (status) {
    case 'on_time':  return <CheckCircle size={14} color="#22c55e" />
    case 'late':     return <Clock size={14} color="#f59e0b" />
    case 'no_show':  return <XCircle size={14} color="#ef4444" />
    case 'upcoming': return <Clock size={14} color="#64748b" />
  }
}

function complianceColor(rate: number | null): string {
  if (rate === null) return 'var(--text-muted)'
  return rate >= 90 ? '#22c55e' : rate >= 75 ? '#f59e0b' : '#ef4444'
}

function MetricCard({ label, value, sub }: {
  label: string; value: string; sub?: string
}) {
  return (
    <div className="sig-stat" style={{
      background: '#ffffff',
      borderRadius: 14, padding: '16px 18px',
      boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.05), 0 14px 36px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-0.03em' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ── Week summary bar ──────────────────────────────────────────────────────────

function WeekBar({ week }: { week: WeekSummary }) {
  const pct = week.complianceRate ?? 0
  const color = pct >= 90 ? '#22c55e' : pct >= 75 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{
      background: '#ffffff',
      borderRadius: 10, padding: '12px 14px',
      boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {week.weekStart} &rarr; {week.weekEnd}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>
          {week.complianceRate !== null ? `${week.complianceRate}%` : 'No shifts'}
        </span>
      </div>
      <div style={{ background: 'var(--surface-raised)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {week.clockedShifts}/{week.scheduledShifts} shifts · {week.hoursWorked}h
        </span>
      </div>
    </div>
  )
}

// ── Mobile shift card ─────────────────────────────────────────────────────────

function ShiftCard({ shift }: { shift: ShiftRecord }) {
  const color = shiftStatusColor(shift.status)
  return (
    <div style={{
      background: '#ffffff',
      borderRadius: 10, padding: '12px 14px',
      boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{shift.jobTitle}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{shift.date}</div>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: `${color}15`, color,
          padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, flexShrink: 0,
        }}>
          {shiftStatusIcon(shift.status)}
          {shiftStatusLabel(shift.status)}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {fmt(shift.scheduledStart)} &ndash; {fmt(shift.scheduledEnd)}
        </span>
        {shift.clockedInAt && (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            In: {fmt(shift.clockedInAt)}
            {shift.minutesLate !== null && shift.minutesLate > 0 && (
              <span style={{ color: '#f59e0b', marginLeft: 3 }}>+{shift.minutesLate}m</span>
            )}
          </span>
        )}
        {shift.hoursWorked !== null && (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{shift.hoursWorked}h worked</span>
        )}
      </div>
    </div>
  )
}

// ── Desktop shift row ─────────────────────────────────────────────────────────

function ShiftRow({ shift }: { shift: ShiftRecord }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
        {shift.date}
      </td>
      <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
        {shift.jobTitle}
      </td>
      <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {fmt(shift.scheduledStart)} &ndash; {fmt(shift.scheduledEnd)}
      </td>
      <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {shift.clockedInAt ? fmt(shift.clockedInAt) : '-'}
        {shift.minutesLate !== null && shift.minutesLate > 0 && (
          <span style={{ color: '#f59e0b', marginLeft: 4, fontSize: 11 }}>+{shift.minutesLate}m</span>
        )}
      </td>
      <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
        {shift.hoursWorked !== null ? `${shift.hoursWorked}h` : '-'}
      </td>
      <td style={{ padding: '10px 16px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: `${shiftStatusColor(shift.status)}15`,
          color: shiftStatusColor(shift.status),
          padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          {shiftStatusIcon(shift.status)}
          {shiftStatusLabel(shift.status)}
        </span>
      </td>
    </tr>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function OperativeProfile() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id ?? ''

  const [data, setData] = useState<OperativeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/operatives/${id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const pad = isMobile ? '16px' : '24px 28px'

  return (
    <div style={{ padding: pad, paddingBottom: 'calc(80px + env(safe-area-inset-bottom))', maxWidth: 1100, margin: '0 auto' }}>
      <button
        onClick={() => router.push('/dashboard/operatives')}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, color: 'var(--text-muted)', padding: 0,
        }}
      >
        <ArrowLeft size={14} /> Back to Operatives
      </button>

      {loading && (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>Loading...</div>
      )}

      {error && (
        <div style={{
          padding: '14px 18px', borderRadius: 8,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#f87171', fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Profile header — hero card glows with compliance color */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24,
            padding: isMobile ? '14px' : '18px 22px',
            background: `radial-gradient(ellipse at 92% 0%, ${complianceColor(data.overallComplianceRate)}14 0%, #ffffff 55%)`,
            borderRadius: 16,
            boxShadow: `0 1px 0 rgba(255,255,255,0.85) inset, 0 0 0 1px ${complianceColor(data.overallComplianceRate)}20, 0 4px 16px rgba(0,0,0,0.06), 0 20px 56px rgba(0,0,0,0.05)`,
          }}>
            <div style={{
              width: isMobile ? 44 : 52, height: isMobile ? 44 : 52, borderRadius: '50%',
              background: `${complianceColor(data.overallComplianceRate)}22`,
              border: `2px solid ${complianceColor(data.overallComplianceRate)}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: isMobile ? 16 : 18, fontWeight: 700, color: complianceColor(data.overallComplianceRate),
              flexShrink: 0,
            }}>
              {data.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: isMobile ? 18 : 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                {data.name}
              </h1>
              <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                {data.entity && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{data.entity}</span>
                )}
                {data.email && !isMobile && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{data.email}</span>
                )}
              </div>
              {data.assignedJobs.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                  {data.assignedJobs.slice(0, isMobile ? 2 : 999).map(j => (
                    <span key={j} style={{
                      background: 'var(--surface-raised)', color: 'var(--text-secondary)',
                      padding: '2px 7px', borderRadius: 4, fontSize: 11,
                    }}>
                      {j}
                    </span>
                  ))}
                  {isMobile && data.assignedJobs.length > 2 && (
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                      +{data.assignedJobs.length - 2} more
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Metric cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12, marginBottom: 24,
          }}>
            <MetricCard
              label="4-Wk Compliance"
              value={data.overallComplianceRate !== null ? `${data.overallComplianceRate}%` : 'N/A'}
              sub="Clocked / scheduled"
            />
            <MetricCard
              label="Hours (4 wks)"
              value={`${data.totalHoursLast4Weeks}h`}
              sub="Clocked time"
            />
            <MetricCard
              label="Shifts (4 wks)"
              value={`${data.weekSummaries.reduce((s, w) => s + w.clockedShifts, 0)}`}
              sub={`of ${data.weekSummaries.reduce((s, w) => s + w.scheduledShifts, 0)} scheduled`}
            />
            <MetricCard
              label="Sites"
              value={`${data.assignedJobs.length}`}
              sub="Last 4 weeks"
            />
          </div>

          {/* Weekly compliance + shift history */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr',
            gap: 20,
          }}>
            {/* Week summaries */}
            <div>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Weekly Compliance
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.weekSummaries.map(w => <WeekBar key={w.weekStart} week={w} />)}
              </div>
            </div>

            {/* Shift history */}
            <div>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Shift History (last 4 weeks)
              </h2>

              {data.shifts.length === 0 ? (
                <div style={{
                  background: '#ffffff',
                  borderRadius: 12, padding: 32, textAlign: 'center',
                  color: 'var(--text-muted)', fontSize: 14,
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
                }}>
                  No shifts found
                </div>
              ) : isMobile ? (
                /* Mobile: shift cards */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.shifts.map(s => (
                    <ShiftCard key={`${s.scheduledStart}-${s.jobTitle}`} shift={s} />
                  ))}
                </div>
              ) : (
                /* Desktop: table */
                <div style={{
                  background: '#ffffff',
                  borderRadius: 12, overflow: 'hidden',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.05), 0 14px 40px rgba(0,0,0,0.05)',
                }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Date', 'Site', 'Scheduled', 'Clocked In', 'Hours', 'Status'].map(h => (
                            <th key={h} style={{
                              padding: '9px 16px', textAlign: 'left',
                              fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                              letterSpacing: '0.06em', color: 'var(--text-muted)',
                              whiteSpace: 'nowrap',
                            }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.shifts.map(s => (
                          <ShiftRow key={`${s.scheduledStart}-${s.jobTitle}`} shift={s} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
