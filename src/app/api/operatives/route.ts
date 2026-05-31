import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SCHEDULER_IDS = ['6814169', '15165164', '16197755']
const TIME_CLOCK_IDS = ['6814166', '16824311']  // both Connecteam time clocks
const CACHE_TTL_MS = 5 * 60 * 1000
const EXCLUDED_NAMES = new Set(['carina', 'charlie', 'nick', 'nelson'])
const WEEKS_BACK = 4

// ── Types ────────────────────────────────────────────────────────────────────

export interface OperativeSummary {
  userId: string
  name: string
  entity: string | null
  thisWeekHours: number
  thisWeekShifts: number
  complianceRate: number | null  // 0-100, last 4 weeks
  totalShiftsLast4Weeks: number
  clockedShiftsLast4Weeks: number
  status: 'active' | 'no_shifts' | 'at_risk'
  assignedJobs: string[]
}

export interface OperativesResponse {
  operatives: OperativeSummary[]
  fetchedAt: string
  weekStart: string
  weekEnd: string
}

// ── Cache ────────────────────────────────────────────────────────────────────

let cache: { data: OperativesResponse; expires: number } | null = null

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

// ── Main ─────────────────────────────────────────────────────────────────────

async function fetchOperativesData(): Promise<OperativesResponse> {
  const apiKey = loadConnecteamKey()

  // Fetch users — Connecteam max limit is 200 per page
  const usersData = await ctFetch('https://api.connecteam.com/users/v1/users?limit=200', apiKey)
  const users: Array<{ userId: string; name: string; entity: string | null }> = []
  const userMap = new Map<string, { name: string; entity: string | null }>()

  for (const u of usersData?.data?.users || []) {
    const name = `${u.firstName || ''} ${u.lastName || ''}`.trim()
    const firstName = name.split(' ')[0].toLowerCase()
    if (EXCLUDED_NAMES.has(firstName)) continue
    const entity = u.company || null
    userMap.set(String(u.userId), { name: name || String(u.userId), entity })
    users.push({ userId: String(u.userId), name: name || String(u.userId), entity })
  }

  // Fetch shifts for last 4 weeks
  const currentWeek = getWeekRange(0)
  const rangeStart = getWeekRange(WEEKS_BACK - 1).start
  const rangeEnd = currentWeek.end

  const allShifts: Array<{
    userId: string; jobTitle: string; startTime: number; endTime: number
  }> = []

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
      const jobTitle = (s.jobTitle as string) || (s.title as string) || 'Unknown'
      for (const uid of (s.assignedUserIds as string[] | undefined) || []) {
        const uidStr = String(uid)
        if (!userMap.has(uidStr)) continue
        allShifts.push({
          userId: uidStr,
          jobTitle,
          startTime: s.startTime as number,
          endTime: s.endTime as number,
        })
      }
    }
  }

  // Fetch time activities for last 4 weeks — query both time clocks in parallel
  // URL: hyphenated `time-clock` + plural `time-clocks` — Connecteam is strict on this
  const actByUser = new Map<string, Array<{ startTs: number; endTs: number | null }>>()
  try {
    const clockResults = await Promise.allSettled(
      TIME_CLOCK_IDS.map(clockId =>
        ctFetch(
          `https://api.connecteam.com/time-clock/v1/time-clocks/${clockId}/time-activities?startDate=${getWeekRange(WEEKS_BACK - 1).startStr}&endDate=${currentWeek.endStr}&limit=500`,
          apiKey
        )
      )
    )
    for (const result of clockResults) {
      if (result.status !== 'fulfilled') continue
      for (const ub of result.value?.data?.timeActivitiesByUsers || []) {
        const uid = String(ub.userId)
        const existing = actByUser.get(uid) || []
        const acts: Array<{ startTs: number; endTs: number | null }> = []
        for (const s of ub.shifts || []) {
          if (s.start?.timestamp) acts.push({ startTs: s.start.timestamp, endTs: s.end?.timestamp ?? null })
        }
        actByUser.set(uid, [...existing, ...acts])
      }
    }
  } catch { /* non-fatal */ }

  // Build per-operative summaries
  const operatives: OperativeSummary[] = []

  for (const user of users) {
    const userShifts = allShifts.filter(s => s.userId === user.userId)
    if (userShifts.length === 0) {
      operatives.push({
        ...user,
        thisWeekHours: 0,
        thisWeekShifts: 0,
        complianceRate: null,
        totalShiftsLast4Weeks: 0,
        clockedShiftsLast4Weeks: 0,
        status: 'no_shifts',
        assignedJobs: [],
      })
      continue
    }

    const thisWeekShifts = userShifts.filter(
      s => s.startTime >= currentWeek.start && s.startTime <= currentWeek.end
    )
    const userActs = actByUser.get(user.userId) || []

    // This week hours: sum shift durations where clocked in
    let thisWeekHours = 0
    for (const s of thisWeekShifts) {
      const matched = userActs.find(a => a.startTs && Math.abs(a.startTs - s.startTime) < 7200)
      if (matched) {
        const end = matched.endTs ?? s.endTime
        thisWeekHours += Math.max(0, end - (matched.startTs)) / 3600
      }
    }

    // Compliance: clocked shifts / total scheduled shifts (last 4 weeks, past only)
    const nowTs = Math.floor(Date.now() / 1000)
    const pastShifts = userShifts.filter(s => s.endTime < nowTs)
    let clockedCount = 0
    for (const s of pastShifts) {
      const matched = userActs.find(a => a.startTs && Math.abs(a.startTs - s.startTime) < 7200)
      if (matched) clockedCount++
    }
    const complianceRate = pastShifts.length > 0
      ? Math.round((clockedCount / pastShifts.length) * 100)
      : null

    // Assigned jobs (unique, this week)
    const assignedJobs = [...new Set(thisWeekShifts.map(s => s.jobTitle))].filter(Boolean)

    const status: OperativeSummary['status'] =
      thisWeekShifts.length === 0 ? 'no_shifts'
      : (complianceRate !== null && complianceRate < 80) ? 'at_risk'
      : 'active'

    operatives.push({
      ...user,
      thisWeekHours: Math.round(thisWeekHours * 10) / 10,
      thisWeekShifts: thisWeekShifts.length,
      complianceRate,
      totalShiftsLast4Weeks: pastShifts.length,
      clockedShiftsLast4Weeks: clockedCount,
      status,
      assignedJobs,
    })
  }

  // Sort: at_risk first, then active by hours desc, then no_shifts
  const statusOrder = { at_risk: 0, active: 1, no_shifts: 2 }
  operatives.sort((a, b) => {
    const so = statusOrder[a.status] - statusOrder[b.status]
    if (so !== 0) return so
    return b.thisWeekHours - a.thisWeekHours
  })

  return {
    operatives,
    fetchedAt: new Date().toISOString(),
    weekStart: currentWeek.startStr,
    weekEnd: currentWeek.endStr,
  }
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin' && session.user.role !== 'operations') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (cache && Date.now() < cache.expires) {
    return NextResponse.json(cache.data)
  }

  try {
    const data = await fetchOperativesData()
    cache = { data, expires: Date.now() + CACHE_TTL_MS }
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/operatives]', err instanceof Error ? err.message : err)
    if (cache?.data) return NextResponse.json({ ...cache.data, error: 'Stale data' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
