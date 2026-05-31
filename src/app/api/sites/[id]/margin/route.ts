import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import * as fs from 'fs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SCHEDULER_IDS = ['6814169', '15165164', '16197755']
const TIME_CLOCK_IDS = ['6814166', '16824311']  // both Connecteam time clocks
const WEEKS_PER_MONTH = 4.33

interface ConnecteamShift {
  jobId?: string
  title?: string
  duration?: number    // seconds (some API versions)
  status?: string
  startTime?: number   // unix seconds
  endTime?: number
  isPublished?: boolean
}

interface TimeActivity {
  jobId?: string
  start?: { timestamp?: number }
  end?: { timestamp?: number }
}

interface TimeActivitiesByUser {
  userId: number
  shifts?: TimeActivity[]
}

interface WeekRange {
  start: Date
  end: Date
}

function loadConnecteamKey(): string {
  const key = process.env.CONNECTEAM_API_KEY
  if (!key) throw new Error('CONNECTEAM_API_KEY not set in environment')
  return key
}

// --- Jobs cache: build name → Set<jobId> map ---
// Reads from the dorabot cache first (no extra API call), falls back to Connecteam API
let jobMapCache: { map: Map<string, Set<string>>; ts: number } | null = null
const JOB_MAP_TTL_MS = 60 * 60 * 1000 // 1 hour

async function getJobIdMap(apiKey: string): Promise<Map<string, Set<string>>> {
  if (jobMapCache && Date.now() - jobMapCache.ts < JOB_MAP_TTL_MS) {
    return jobMapCache.map
  }

  const map = new Map<string, Set<string>>()

  // Try reading from the dorabot cache file (fast path)
  try {
    const cachePath = '/home/dorabot/.dorabot/cache/connecteam-jobs.json'
    if (fs.existsSync(cachePath)) {
      const raw = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
      const jobs: Array<{
        jobId: string
        title: string
        isDeleted?: boolean
        subJobs?: Array<{ jobId: string; title: string }>
      }> = raw.jobs || []

      for (const job of jobs) {
        if (job.isDeleted) continue
        addToMap(map, job.title, job.jobId)
        for (const sub of job.subJobs || []) {
          if (sub && (sub as { isDeleted?: boolean }).isDeleted) continue
          addToMap(map, sub.title, sub.jobId)
          // Parent rollup: subJob jobIds also register under parent title key
          // so connecteamJobName="Teign Brook" pulls all "Teign Brook > Plot N" shifts.
          addToMap(map, job.title, sub.jobId)
        }
      }

      if (map.size > 0) {
        jobMapCache = { map, ts: Date.now() }
        return map
      }
    }
  } catch { /* fall through to API */ }

  // Fallback: fetch from Connecteam API
  try {
    let offset = 0
    while (true) {
      const res = await fetch(
        `https://api.connecteam.com/jobs/v1/jobs?limit=100&offset=${offset}`,
        { headers: { 'X-API-KEY': apiKey, 'User-Agent': 'sigos/1.0' }, signal: AbortSignal.timeout(8000) }
      )
      if (!res.ok) break
      const data = await res.json()
      const jobs: Array<{
        jobId: string
        title: string
        isDeleted?: boolean
        subJobs?: Array<{ jobId: string; title: string }>
      }> = data?.data?.jobs || []
      if (jobs.length === 0) break

      for (const job of jobs) {
        if (job.isDeleted) continue
        addToMap(map, job.title, job.jobId)
        for (const sub of job.subJobs || []) {
          if (sub && (sub as { isDeleted?: boolean }).isDeleted) continue
          addToMap(map, sub.title, sub.jobId)
          // Parent rollup (see cache branch above for rationale).
          addToMap(map, job.title, sub.jobId)
        }
      }

      if (jobs.length < 100) break
      offset += 100
    }
  } catch { /* return partial map */ }

  jobMapCache = { map, ts: Date.now() }
  return map
}

function addToMap(map: Map<string, Set<string>>, title: string, jobId: string) {
  const key = title.toLowerCase().trim()
  if (!map.has(key)) map.set(key, new Set())
  map.get(key)!.add(jobId)
}

// --- Week range ---
function getCurrentWeekRange(): WeekRange {
  const now = new Date()
  const day = now.getDay()
  const daysFromMonday = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - daysFromMonday)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

// --- Scheduled shift fetching (planned, not actual) ---
async function fetchConnecteamShifts(week: WeekRange, apiKey: string): Promise<ConnecteamShift[]> {
  const startTs = Math.floor(week.start.getTime() / 1000)
  const endTs = Math.floor(week.end.getTime() / 1000)
  const all: ConnecteamShift[] = []

  for (const sid of SCHEDULER_IDS) {
    try {
      const res = await fetch(
        `https://api.connecteam.com/scheduler/v1/schedulers/${sid}/shifts?startTime=${startTs}&endTime=${endTs}&limit=500`,
        { headers: { 'X-API-KEY': apiKey, 'User-Agent': 'sigos/1.0' }, signal: AbortSignal.timeout(8000) }
      )
      if (!res.ok) continue
      const data = await res.json()
      const shifts = (data?.data?.shifts || []) as ConnecteamShift[]
      for (const s of shifts) {
        if (s.isPublished !== false) all.push(s) // include published + unset
      }
    } catch { /* one scheduler failing shouldn't kill the whole call */ }
  }

  return all
}

// --- Time activity fetching (ACTUAL clock-ins, payroll truth) ---
async function fetchTimeActivities(week: WeekRange, apiKey: string): Promise<TimeActivity[]> {
  // time-activities uses YYYY-MM-DD, not unix seconds
  const startDate = week.start.toISOString().slice(0, 10)
  const endDate = week.end.toISOString().slice(0, 10)
  const all: TimeActivity[] = []

  try {
    const results = await Promise.allSettled(
      TIME_CLOCK_IDS.map(clockId =>
        fetch(
          `https://api.connecteam.com/time-clock/v1/time-clocks/${clockId}/time-activities?startDate=${startDate}&endDate=${endDate}&limit=500`,
          { headers: { 'X-API-KEY': apiKey, 'User-Agent': 'sigos/1.0' }, signal: AbortSignal.timeout(8000) }
        )
      )
    )
    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value.ok) continue
      const data = await result.value.json()
      const usersData = (data?.data?.timeActivitiesByUsers || []) as TimeActivitiesByUser[]
      for (const u of usersData) {
        for (const sh of u.shifts || []) {
          all.push(sh)
        }
      }
    }
  } catch { /* swallow — caller handles empty array */ }

  return all
}

// --- Scheduled hours (planned, from scheduler) ---
function scheduledHoursForJobIds(shifts: ConnecteamShift[], jobIds: Set<string>, jobName: string): number {
  let totalSeconds = 0

  for (const shift of shifts) {
    if (!shift.jobId) continue
    if (!jobIds.has(shift.jobId)) continue
    if (shift.status === 'cancelled' || shift.status === 'deleted') continue

    if (shift.duration && shift.duration > 0) {
      totalSeconds += shift.duration
    } else if (shift.startTime && shift.endTime) {
      totalSeconds += shift.endTime - shift.startTime
    }
  }

  // Crave rule: max 2.5 hrs/day × 7 (paired slots counted once)
  if (jobName.toLowerCase().includes('crave')) {
    return Math.min(totalSeconds / 3600, 2.5 * 7)
  }

  return totalSeconds / 3600
}

// --- Actual clock-in hours (payroll truth, from time-activities) ---
function clockedHoursForJobIds(activities: TimeActivity[], jobIds: Set<string>, jobName: string): number {
  let totalSeconds = 0
  const nowSec = Math.floor(Date.now() / 1000)

  for (const sh of activities) {
    if (!sh.jobId) continue
    if (!jobIds.has(sh.jobId)) continue
    const start = sh.start?.timestamp
    if (!start) continue
    // If still clocked in (no end), count up to now — matches Connecteam's "live" timesheet
    const end = sh.end?.timestamp ?? nowSec
    if (end > start) totalSeconds += end - start
  }

  // Crave rule: max 2.5 hrs/day × 7 (paired slots counted once)
  if (jobName.toLowerCase().includes('crave')) {
    return Math.min(totalSeconds / 3600, 2.5 * 7)
  }

  return totalSeconds / 3600
}

// --- Margin calculation ---
//
// NEW MODEL (2026-05-24): margin is computed from the Regular Hours Sheet, not from
// CT clocked/scheduled hours. CT scheduler shifts are PERMISSION WINDOWS (e.g. RG Setsquare
// 09:00-23:00 is a 14h clock-in window, not 14h of work). The sheet's "hours per visit ×
// frequency" is the contracted truth.
//
// Revenue:  sheet's avgWeeklyEarnings (preferred), else Site billing override.
// Cost:     sheet's avgWeeklyHours × Site.labourRatePerHour (default £17 placeholder until
//           per-operative pay loaded; set-rate-per-shift contracts will need overrides).
// Clocked:  separate QA flag — over expected = labour eating margin; under = client risk.
function calculateMargin(args: {
  expectedWeeklyHours: number
  expectedWeeklyEarnings: number | null  // from sheet (canonical)
  fallbackBilling: {
    type: string
    billingRatePerHour: number | null
    monthlyBillingValue: number | null
  }
  labourRatePerHour: number
  fixedMonthlyCost: number | null  // subcontractor flat fee (e.g. Cleanz4U) — overrides hours × rate
}): {
  revenue: number
  labourCost: number
  grossMarginPct: number
  revenueSource: 'sheet' | 'billing_override' | 'none'
  costModel: 'fixed_monthly' | 'hourly_modelled'
} {
  // Cost: flat fee if set (subcontractor invoices monthly), otherwise modelled at hours × rate.
  const costModel: 'fixed_monthly' | 'hourly_modelled' =
    args.fixedMonthlyCost && args.fixedMonthlyCost > 0 ? 'fixed_monthly' : 'hourly_modelled'
  const labour =
    costModel === 'fixed_monthly'
      ? (args.fixedMonthlyCost as number) / WEEKS_PER_MONTH
      : args.expectedWeeklyHours * args.labourRatePerHour

  let revenue = 0
  let revenueSource: 'sheet' | 'billing_override' | 'none' = 'none'

  if (args.expectedWeeklyEarnings && args.expectedWeeklyEarnings > 0) {
    revenue = args.expectedWeeklyEarnings
    revenueSource = 'sheet'
  } else if (args.fallbackBilling.type === 'monthly_fixed' && args.fallbackBilling.monthlyBillingValue) {
    revenue = args.fallbackBilling.monthlyBillingValue / WEEKS_PER_MONTH
    revenueSource = 'billing_override'
  } else if (args.fallbackBilling.type === 'hourly' && args.fallbackBilling.billingRatePerHour) {
    revenue = args.expectedWeeklyHours * args.fallbackBilling.billingRatePerHour
    revenueSource = 'billing_override'
  } else {
    return { revenue: 0, labourCost: labour, grossMarginPct: -1, revenueSource: 'none', costModel }
  }

  const grossMarginPct = revenue > 0 ? ((revenue - labour) / revenue) * 100 : 0
  return { revenue, labourCost: labour, grossMarginPct, revenueSource, costModel }
}

// GET /api/sites/[id]/margin
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin' && session.user.role !== 'operations') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const site = await prisma.site.findUnique({
    where: { id },
    include: { regularHoursSheetRow: true },
  })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Resolve the contracted-hours / revenue source from the sheet.
  // Try linked FK first; if no link, fall back to case-insensitive name match
  // (so we still get a value before the first manual link).
  let sheetRow = site.regularHoursSheetRow
  if (!sheetRow) {
    sheetRow = await prisma.regularHoursSheetRow.findFirst({
      where: { businessName: { equals: site.name, mode: 'insensitive' } },
    })
  }

  const expectedWeeklyHours = sheetRow ? Number(sheetRow.avgWeeklyHours) : 0
  const expectedWeeklyEarnings = sheetRow ? Number(sheetRow.avgWeeklyEarnings) : null

  const week = getCurrentWeekRange()

  let clockedHours = 0
  let scheduledHours = 0
  let connecteamError: string | null = null
  let hoursAvailable = false

  if (!site.connecteamJobName) {
    connecteamError = 'No Connecteam job name set — live hours tracking unavailable'
  } else {
    try {
      const apiKey = loadConnecteamKey()
      const [shifts, activities, jobMap] = await Promise.all([
        fetchConnecteamShifts(week, apiKey),
        fetchTimeActivities(week, apiKey),
        getJobIdMap(apiKey),
      ])

      const jobKey = site.connecteamJobName.toLowerCase().trim()
      const jobIds = jobMap.get(jobKey)

      if (!jobIds || jobIds.size === 0) {
        connecteamError = `Job "${site.connecteamJobName}" not found in Connecteam`
      } else {
        clockedHours = clockedHoursForJobIds(activities, jobIds, site.connecteamJobName)
        scheduledHours = scheduledHoursForJobIds(shifts, jobIds, site.connecteamJobName)
        hoursAvailable = true
      }
    } catch (err) {
      connecteamError = err instanceof Error ? err.message : 'Connecteam unavailable'
    }
  }

  // Margin = sheet expected hours × labour rate (NOT clocked hours), or fixed monthly cost
  // for subcontractor flat-fee contracts (Cleanz4U). Clocked is exposed below as a QA flag.
  const { revenue, labourCost, grossMarginPct, revenueSource, costModel } = calculateMargin({
    expectedWeeklyHours,
    expectedWeeklyEarnings,
    fallbackBilling: {
      type: site.billingType,
      billingRatePerHour: site.billingRatePerHour ? Number(site.billingRatePerHour) : null,
      monthlyBillingValue: site.monthlyBillingValue ? Number(site.monthlyBillingValue) : null,
    },
    labourRatePerHour: Number(site.labourRatePerHour),
    fixedMonthlyCost: site.fixedMonthlyCost ? Number(site.fixedMonthlyCost) : null,
  })

  // QA flag on clocked vs expected (only meaningful when both are available).
  let deliveryFlag: 'over' | 'under' | 'on_track' | null = null
  let deliveryVariance: number | null = null
  if (hoursAvailable && expectedWeeklyHours > 0) {
    deliveryVariance = clockedHours - expectedWeeklyHours
    // ±15% tolerance band
    const tol = expectedWeeklyHours * 0.15
    if (deliveryVariance > tol) deliveryFlag = 'over'
    else if (deliveryVariance < -tol) deliveryFlag = 'under'
    else deliveryFlag = 'on_track'
  }

  return NextResponse.json({
    site: {
      id: site.id,
      name: site.name,
      connecteamJobName: site.connecteamJobName,
      cellTier: site.cellTier,
      billingType: site.billingType,
      rateConfirmed: site.rateConfirmed,
    },
    week: {
      start: week.start.toISOString(),
      end: week.end.toISOString(),
    },
    // Canonical contracted figures from the sheet
    expectedWeeklyHours: sheetRow ? expectedWeeklyHours : null,
    expectedWeeklyEarnings: sheetRow ? expectedWeeklyEarnings : null,
    sheetRowLinked: !!sheetRow,
    sheetRowMatchedById: !!site.regularHoursSheetRowId,

    // Live ops figures (QA / exception flag)
    clockedHours: hoursAvailable ? clockedHours : null,
    scheduledHours: hoursAvailable ? scheduledHours : null,
    // `hours` kept for backwards compat with any caller reading it — now == expected.
    hours: sheetRow ? expectedWeeklyHours : (hoursAvailable ? clockedHours : null),

    // Delivery QA flag (over/under/on_track ±15%)
    deliveryFlag,
    deliveryVariance: deliveryVariance != null ? Math.round(deliveryVariance * 10) / 10 : null,

    // Margin (computed from sheet expected hours, NOT clocked)
    revenue: Math.round(revenue * 100) / 100,
    revenueSource,
    labourCost: Math.round(labourCost * 100) / 100,
    costModel,
    fixedMonthlyCost: site.fixedMonthlyCost ? Number(site.fixedMonthlyCost) : null,
    grossMarginPct: grossMarginPct >= 0 ? Math.round(grossMarginPct * 10) / 10 : null,
    connecteamError,
  })
}
