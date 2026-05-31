import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SCHEDULER_IDS = ['6814169', '15165164', '16197755']
const TIME_CLOCK_IDS = ['6814166', '16824311']  // both Connecteam time clocks
const WEEKS_BACK = 4

// ── Types ────────────────────────────────────────────────────────────────────

export interface ShiftRecord {
  date: string          // YYYY-MM-DD
  jobTitle: string
  scheduledStart: number
  scheduledEnd: number
  clockedInAt: number | null
  clockedOutAt: number | null
  minutesLate: number | null
  status: 'on_time' | 'late' | 'no_show' | 'upcoming'
  hoursWorked: number | null
}

export interface WeekSummary {
  weekStart: string
  weekEnd: string
  scheduledShifts: number
  clockedShifts: number
  hoursWorked: number
  complianceRate: number | null
}

export interface OperativeDetail {
  userId: string
  name: string
  entity: string | null
  email: string | null
  phone: string | null
  shifts: ShiftRecord[]
  weekSummaries: WeekSummary[]
  overallComplianceRate: number | null
  totalHoursLast4Weeks: number
  assignedJobs: string[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadConnecteamKey(): string {
  const key = process.env.CONNECTEAM_API_KEY
  if (!key) throw new Error('CONNECTEAM_API_KEY not set in environment')
  return key
}

async function ctFetch(url: string, apiKey: string) {
  const res = await fetch(url, {
    headers: { 'X-API-KEY': apiKey, 'User-Agent': 'sigos/1.0' },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Connecteam ${res.status}: ${url}`)
  return res.json()
}

function getLondonOffset(): number {
  const now = new Date()
  return now.toLocaleString('en-GB', { timeZone: 'Europe/London', timeZoneName: 'short' })
    .includes('BST') ? 60 : 0
}

function getWeekRange(weeksBack = 0) {
  const now = new Date()
  const londonOffset = getLondonOffset()
  const londonNow = new Date(now.getTime() + londonOffset * 60 * 1000)
  const day = londonNow.getDay()
  const daysFromMonday = day === 0 ? 6 : day - 1
  const monday = new Date(londonNow)
  monday.setDate(londonNow.getDate() - daysFromMonday - weeksBack * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  const toUts = (d: Date) => Math.floor((d.getTime() - londonOffset * 60 * 1000) / 1000)
  return {
    start: toUts(monday),
    end: toUts(sunday),
    startStr: monday.toISOString().split('T')[0],
    endStr: sunday.toISOString().split('T')[0],
  }
}

function tsToDate(ts: number): string {
  return new Date(ts * 1000).toISOString().split('T')[0]
}

// ── Fetch detail ─────────────────────────────────────────────────────────────

async function fetchOperativeDetail(userId: string): Promise<OperativeDetail | null> {
  const apiKey = loadConnecteamKey()

  // Fetch user details — Connecteam max limit is 200 per page
  const usersData = await ctFetch('https://api.connecteam.com/users/v1/users?limit=200', apiKey)
  let name: string | null = null
  let entity: string | null = null
  let email: string | null = null
  let phone: string | null = null

  for (const u of usersData?.data?.users || []) {
    if (String(u.userId) === userId) {
      name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || null
      entity = u.company || null
      email = u.email || null
      phone = u.phone || null
      break
    }
  }

  // Unknown user — return 404
  if (name === null) return null

  // Week ranges
  const currentWeek = getWeekRange(0)
  const weeks = Array.from({ length: WEEKS_BACK }, (_, i) => getWeekRange(i))
  const rangeStart = weeks[WEEKS_BACK - 1].start
  const rangeEnd = currentWeek.end

  // Fetch shifts — all schedulers in parallel
  const allShifts: Array<{ jobTitle: string; startTime: number; endTime: number }> = []
  const schedulerResults = await Promise.allSettled(
    SCHEDULER_IDS.map(sid =>
      ctFetch(
        `https://api.connecteam.com/scheduler/v1/schedulers/${sid}/shifts?startTime=${rangeStart}&endTime=${rangeEnd}&limit=500`,
        apiKey
      )
    )
  )
  for (const result of schedulerResults) {
    if (result.status !== 'fulfilled') continue
    for (const s of result.value?.data?.shifts || []) {
      if (!s.isPublished) continue
      const assigned = (s.assignedUserIds as string[] | undefined) || []
      if (!assigned.map(String).includes(userId)) continue
      allShifts.push({
        jobTitle: (s.jobTitle as string) || (s.title as string) || 'Unknown',
        startTime: s.startTime as number,
        endTime: s.endTime as number,
      })
    }
  }

  // Fetch time activities — non-fatal, both time clocks in parallel
  const userActs: Array<{ startTs: number; endTs: number | null }> = []
  try {
    const clockResults = await Promise.allSettled(
      TIME_CLOCK_IDS.map(clockId =>
        ctFetch(
          `https://api.connecteam.com/time-clock/v1/time-clocks/${clockId}/time-activities?startDate=${weeks[WEEKS_BACK - 1].startStr}&endDate=${currentWeek.endStr}&limit=500`,
          apiKey
        )
      )
    )
    for (const result of clockResults) {
      if (result.status !== 'fulfilled') continue
      for (const ub of result.value?.data?.timeActivitiesByUsers || []) {
        if (String(ub.userId) !== userId) continue
        for (const s of ub.shifts || []) {
          if (s.start?.timestamp) userActs.push({ startTs: s.start.timestamp, endTs: s.end?.timestamp ?? null })
        }
      }
    }
  } catch { /* non-fatal — shifts show as no_show */ }

  const nowTs = Math.floor(Date.now() / 1000)

  // Build shift records
  const shifts: ShiftRecord[] = allShifts.map(s => {
    const matched = userActs.find(a => a.startTs && Math.abs(a.startTs - s.startTime) < 7200)
    let status: ShiftRecord['status']
    let clockedInAt: number | null = null
    let clockedOutAt: number | null = null
    let minutesLate: number | null = null
    let hoursWorked: number | null = null

    if (s.startTime > nowTs) {
      status = 'upcoming'
    } else if (matched) {
      clockedInAt = matched.startTs
      clockedOutAt = matched.endTs ?? null
      const end = matched.endTs ?? s.endTime
      hoursWorked = Math.round(Math.max(0, end - matched.startTs) / 3600 * 10) / 10
      if (matched.startTs > s.startTime + 300) {
        minutesLate = Math.round((matched.startTs - s.startTime) / 60)
        status = 'late'
      } else {
        status = 'on_time'
      }
    } else {
      status = 'no_show'
    }

    return {
      date: tsToDate(s.startTime),
      jobTitle: s.jobTitle,
      scheduledStart: s.startTime,
      scheduledEnd: s.endTime,
      clockedInAt,
      clockedOutAt,
      minutesLate,
      status,
      hoursWorked,
    }
  })

  shifts.sort((a, b) => b.scheduledStart - a.scheduledStart)

  // Build week summaries
  const weekSummaries: WeekSummary[] = weeks.map(w => {
    const wShifts = allShifts.filter(s => s.startTime >= w.start && s.startTime <= w.end)
    const pastWShifts = wShifts.filter(s => s.endTime < nowTs)
    let clocked = 0
    let hours = 0
    for (const s of pastWShifts) {
      const matched = userActs.find(a => a.startTs && Math.abs(a.startTs - s.startTime) < 7200)
      if (matched) {
        clocked++
        const end = matched.endTs ?? s.endTime
        hours += Math.max(0, end - matched.startTs) / 3600
      }
    }
    return {
      weekStart: w.startStr,
      weekEnd: w.endStr,
      scheduledShifts: pastWShifts.length,
      clockedShifts: clocked,
      hoursWorked: Math.round(hours * 10) / 10,
      complianceRate: pastWShifts.length > 0 ? Math.round((clocked / pastWShifts.length) * 100) : null,
    }
  })

  const totalPast = weekSummaries.reduce((s, w) => s + w.scheduledShifts, 0)
  const totalClocked = weekSummaries.reduce((s, w) => s + w.clockedShifts, 0)
  const totalHours = weekSummaries.reduce((s, w) => s + w.hoursWorked, 0)

  return {
    userId,
    name: name!,
    entity,
    email,
    phone,
    shifts: shifts.slice(0, 50),
    weekSummaries,
    overallComplianceRate: totalPast > 0 ? Math.round((totalClocked / totalPast) * 100) : null,
    totalHoursLast4Weeks: Math.round(totalHours * 10) / 10,
    assignedJobs: [...new Set(allShifts.map(s => s.jobTitle))].filter(Boolean),
  }
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin' && session.user.role !== 'operations') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  if (!id || !/^\d+$/.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    const data = await fetchOperativeDetail(id)
    if (!data) return NextResponse.json({ error: 'Operative not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/operatives/[id]]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
