import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SCHEDULER_IDS = ['6814169', '15165164', '16197755']
const TIME_CLOCK_IDS = ['6814166', '16824311']  // both Connecteam time clocks
const GRACE_MINUTES = 5

// In-memory cache: 90 seconds (fast enough for live feel, light on API calls)
let cache: { data: TodayShiftsResponse; expires: number } | null = null

// 429 backoff: if Connecteam rate-limits us, don't retry for 60s
let rateLimitedUntil = 0

function loadConnecteamKey(): string {
  const key = process.env.CONNECTEAM_API_KEY
  if (!key) throw new Error('CONNECTEAM_API_KEY not set in environment')
  return key
}

async function ctFetch(url: string, apiKey: string) {
  const res = await fetch(url, {
    headers: { 'X-API-KEY': apiKey, 'User-Agent': 'sigos/1.0' },
    signal: AbortSignal.timeout(8000),
  })
  if (res.status === 429) {
    rateLimitedUntil = Date.now() + 60_000  // back off 60s
    throw new Error(`Connecteam 429: ${url}`)
  }
  if (!res.ok) throw new Error(`Connecteam ${res.status}: ${url}`)
  return res.json()
}

export interface ShiftEntry {
  operativeName: string
  operativeId: string
  jobTitle: string
  startTime: number  // unix seconds
  endTime: number    // unix seconds
  status: 'clocked_in' | 'overdue' | 'upcoming' | 'completed'
  clockedInAt: number | null  // unix seconds
  clockedOutAt: number | null
  minutesLate: number | null  // positive = late, null if not applicable
}

export interface TodayShiftsResponse {
  shifts: ShiftEntry[]
  counts: { clocked_in: number; overdue: number; upcoming: number; completed: number }
  fetchedAt: string
  error: string | null
}

async function fetchTodayShifts(): Promise<TodayShiftsResponse> {
  const apiKey = loadConnecteamKey()

  // London date today (UTC+0 or UTC+1 depending on DST)
  const now = new Date()
  const londonOffset = now.toLocaleString('en-GB', { timeZone: 'Europe/London', timeZoneName: 'short' }).includes('BST') ? 60 : 0
  const londonNow = new Date(now.getTime() + londonOffset * 60 * 1000)
  const todayStr = londonNow.toISOString().split('T')[0]
  const todayStart = Math.floor(new Date(todayStr + 'T00:00:00Z').getTime() / 1000) - londonOffset * 60
  const todayEnd = todayStart + 86400 - 1
  const nowTs = Math.floor(now.getTime() / 1000)
  const graceCutoff = nowTs - GRACE_MINUTES * 60

  // Fetch users (name map) — Connecteam max limit is 200 per page
  const usersData = await ctFetch('https://api.connecteam.com/users/v1/users?limit=200', apiKey)
  const userMap = new Map<string, string>()
  for (const u of usersData?.data?.users || []) {
    const name = `${u.firstName || ''} ${u.lastName || ''}`.trim()
    userMap.set(String(u.userId), name || String(u.userId))
  }

  // Fetch scheduled shifts from all schedulers
  const rawShifts: Array<Record<string, unknown>> = []
  for (const sid of SCHEDULER_IDS) {
    try {
      const data = await ctFetch(
        `https://api.connecteam.com/scheduler/v1/schedulers/${sid}/shifts?startTime=${todayStart}&endTime=${todayEnd}&limit=200`,
        apiKey
      )
      const shifts = (data?.data?.shifts || []) as Array<Record<string, unknown>>
      for (const s of shifts) {
        if (s.isPublished) rawShifts.push(s)
      }
    } catch {
      // One scheduler failing shouldn't kill the whole widget
    }
  }

  // Fetch today's time activities — both time clocks in parallel
  type ClockActivity = { startTs: number; endTs: number | null; jobId: string | null }
  const actByUser = new Map<string, ClockActivity[]>()
  const clockResults = await Promise.allSettled(
    TIME_CLOCK_IDS.map(clockId =>
      ctFetch(
        `https://api.connecteam.com/time-clock/v1/time-clocks/${clockId}/time-activities?startDate=${todayStr}&endDate=${todayStr}&limit=500`,
        apiKey
      )
    )
  )
  for (const result of clockResults) {
    if (result.status !== 'fulfilled') continue
    for (const ub of result.value?.data?.timeActivitiesByUsers || []) {
      const uid = String(ub.userId)
      const existing = actByUser.get(uid) || []
      const acts: ClockActivity[] = []
      for (const s of ub.shifts || []) {
        acts.push({
          startTs: s.start?.timestamp ?? null,
          endTs: s.end?.timestamp ?? null,
          jobId: s.jobId ? String(s.jobId) : null,
        })
      }
      actByUser.set(uid, [...existing, ...acts])
    }
  }

  // Map shifts to entries
  const EXCLUDED_NAMES = new Set(['carina', 'charlie', 'nick', 'nelson'])
  const entries: ShiftEntry[] = []

  for (const s of rawShifts) {
    const startTime = s.startTime as number
    const endTime = s.endTime as number
    const assignedUserIds = (s.assignedUserIds as string[] | undefined) || []
    const jobTitle = (s.jobTitle as string) || (s.title as string) || 'Unknown job'

    for (const uid of assignedUserIds) {
      const uidStr = String(uid)
      const name = userMap.get(uidStr) || uidStr
      const firstName = name.split(' ')[0].toLowerCase()
      if (EXCLUDED_NAMES.has(firstName)) continue

      const userActivities = actByUser.get(uidStr) || []
      // Find matching clock activity (within 2-hour window of shift start)
      const matchingAct = userActivities.find(a =>
        a.startTs && Math.abs(a.startTs - startTime) < 7200
      )

      let status: ShiftEntry['status']
      let clockedInAt: number | null = null
      let clockedOutAt: number | null = null
      let minutesLate: number | null = null

      if (matchingAct) {
        clockedInAt = matchingAct.startTs
        clockedOutAt = matchingAct.endTs ?? null
        status = matchingAct.endTs ? 'completed' : 'clocked_in'
        if (clockedInAt > startTime + 60) {
          minutesLate = Math.round((clockedInAt - startTime) / 60)
        }
      } else if (startTime > nowTs) {
        status = 'upcoming'
      } else if (startTime <= graceCutoff) {
        status = endTime < nowTs ? 'completed' : 'overdue'
      } else {
        // In grace period — treat as upcoming
        status = 'upcoming'
      }

      entries.push({
        operativeName: name,
        operativeId: uidStr,
        jobTitle,
        startTime,
        endTime,
        status,
        clockedInAt,
        clockedOutAt,
        minutesLate,
      })
    }
  }

  // Sort: overdue first, then clocked_in, then upcoming, then completed
  const statusOrder = { overdue: 0, clocked_in: 1, upcoming: 2, completed: 3 }
  entries.sort((a, b) => {
    const so = statusOrder[a.status] - statusOrder[b.status]
    return so !== 0 ? so : a.startTime - b.startTime
  })

  const counts = {
    clocked_in: entries.filter(e => e.status === 'clocked_in').length,
    overdue: entries.filter(e => e.status === 'overdue').length,
    upcoming: entries.filter(e => e.status === 'upcoming').length,
    completed: entries.filter(e => e.status === 'completed').length,
  }

  return {
    shifts: entries,
    counts,
    fetchedAt: new Date().toISOString(),
    error: null,
  }
}

// GET /api/shifts/today
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin' && session.user.role !== 'operations') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Return cached if fresh
  if (cache && Date.now() < cache.expires) {
    return NextResponse.json(cache.data)
  }

  // If rate-limited, return stale cache or empty — don't hammer Connecteam
  if (Date.now() < rateLimitedUntil) {
    if (cache?.data) {
      return NextResponse.json({ ...cache.data, error: 'Live data temporarily unavailable (rate limited)' })
    }
    return NextResponse.json({
      shifts: [],
      counts: { clocked_in: 0, overdue: 0, upcoming: 0, completed: 0 },
      fetchedAt: new Date().toISOString(),
      error: 'Live data temporarily unavailable (rate limited)',
    })
  }

  try {
    const data = await fetchTodayShifts()
    cache = { data, expires: Date.now() + 90 * 1000 }
    return NextResponse.json(data)
  } catch (err) {
    console.error('[shifts/today] fetch failed:', err instanceof Error ? err.message : err)
    // Return stale cache if available
    if (cache?.data) {
      return NextResponse.json({ ...cache.data, error: 'Live data temporarily unavailable' })
    }
    return NextResponse.json({
      shifts: [],
      counts: { clocked_in: 0, overdue: 0, upcoming: 0, completed: 0 },
      fetchedAt: new Date().toISOString(),
      error: 'Live data temporarily unavailable',
    })
  }
}
