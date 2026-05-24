import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import * as fs from 'fs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SCHEDULER_IDS = ['6814169', '15165164', '16197755']
const TIME_CLOCK_ID = '6814166'
const WEEKS_PER_MONTH = 4.33
const CACHE_TTL_MS = 5 * 60 * 1000 // 5-minute cache

// ── Types ────────────────────────────────────────────────────────────────────

export type HealthStatus = 'green' | 'amber' | 'red'

export interface ContractHealth {
  id: string
  name: string
  cellTier: string | null
  billingType: string
  rateConfirmed: boolean
  connecteamJobName: string | null
  // weeklyHours kept for backwards compat — now == expectedWeeklyHours from the sheet
  weeklyHours: number | null
  expectedWeeklyHours: number | null   // sheet truth (avg per visit × frequency)
  clockedHours: number | null          // actual clock-in hours (QA flag)
  scheduledHours: number | null        // CT scheduler shift hours (permission windows, info only)
  weeklyRevenue: number | null         // from sheet (canonical), or billing override fallback
  grossMarginPct: number | null
  revenueSource: 'sheet' | 'billing_override' | 'none'
  costModel: 'fixed_monthly' | 'hourly_modelled'  // fixed_monthly = subcontractor flat fee
  fixedMonthlyCost: number | null      // when set, drives weekly cost; otherwise null
  deliveryFlag: 'over' | 'under' | 'on_track' | null
  deliveryVariance: number | null      // clockedHours - expectedWeeklyHours
  sheetRowLinked: boolean
  connecteamError: string | null
  healthStatus: HealthStatus
  statusReason: string
}

export interface HealthResponse {
  contracts: ContractHealth[]
  summary: { green: number; amber: number; red: number; total: number }
  week: { start: string; end: string }
  fetchedAt: string
  connecteamAvailable: boolean
}

// ── In-memory cache ───────────────────────────────────────────────────────────

let cache: { data: HealthResponse; expires: number } | null = null

// ── API key ───────────────────────────────────────────────────────────────────

function loadConnecteamKey(): string {
  const key = process.env.CONNECTEAM_API_KEY
  if (!key) throw new Error('CONNECTEAM_API_KEY not set in environment')
  return key
}

// ── Jobs map (name → Set<jobId>) ──────────────────────────────────────────────

let jobMapCache: { map: Map<string, Set<string>>; ts: number } | null = null
const JOB_MAP_TTL_MS = 60 * 60 * 1000

function addToMap(map: Map<string, Set<string>>, title: string, jobId: string) {
  const key = title.toLowerCase().trim()
  if (!map.has(key)) map.set(key, new Set())
  map.get(key)!.add(jobId)
}

async function getJobIdMap(apiKey: string): Promise<Map<string, Set<string>>> {
  if (jobMapCache && Date.now() - jobMapCache.ts < JOB_MAP_TTL_MS) {
    return jobMapCache.map
  }

  const map = new Map<string, Set<string>>()

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

  // Fallback: fetch from Connecteam
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

// ── Week range ────────────────────────────────────────────────────────────────

function getCurrentWeekRange() {
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

// ── Connecteam shifts (single batch fetch for ALL schedulers) ─────────────────

interface ConnecteamShift {
  jobId?: string
  duration?: number
  startTime?: number
  endTime?: number
  isPublished?: boolean
  status?: string
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

async function fetchAllShifts(week: { start: Date; end: Date }, apiKey: string): Promise<{ shifts: ConnecteamShift[]; error: string | null }> {
  const startTs = Math.floor(week.start.getTime() / 1000)
  const endTs = Math.floor(week.end.getTime() / 1000)
  const all: ConnecteamShift[] = []
  let anySuccess = false

  for (const sid of SCHEDULER_IDS) {
    try {
      const res = await fetch(
        `https://api.connecteam.com/scheduler/v1/schedulers/${sid}/shifts?startTime=${startTs}&endTime=${endTs}&limit=500`,
        { headers: { 'X-API-KEY': apiKey, 'User-Agent': 'sigos/1.0' }, signal: AbortSignal.timeout(10000) }
      )
      if (!res.ok) continue
      const data = await res.json()
      const shifts = (data?.data?.shifts || []) as ConnecteamShift[]
      for (const s of shifts) {
        if (s.isPublished !== false) all.push(s)
      }
      anySuccess = true
    } catch { /* one scheduler failing doesn't kill the whole call */ }
  }

  return {
    shifts: all,
    error: anySuccess ? null : 'Connecteam unavailable',
  }
}

// ── Time activities (ACTUAL clock-ins, payroll truth) ─────────────────────────

async function fetchAllTimeActivities(week: { start: Date; end: Date }, apiKey: string): Promise<{ activities: TimeActivity[]; error: string | null }> {
  const startDate = week.start.toISOString().slice(0, 10)
  const endDate = week.end.toISOString().slice(0, 10)
  const all: TimeActivity[] = []

  try {
    const res = await fetch(
      `https://api.connecteam.com/time-clock/v1/time-clocks/${TIME_CLOCK_ID}/time-activities?startDate=${startDate}&endDate=${endDate}&limit=500`,
      { headers: { 'X-API-KEY': apiKey, 'User-Agent': 'sigos/1.0' }, signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return { activities: [], error: `Time clock returned ${res.status}` }
    const data = await res.json()
    const usersData = (data?.data?.timeActivitiesByUsers || []) as TimeActivitiesByUser[]
    for (const u of usersData) {
      for (const sh of u.shifts || []) all.push(sh)
    }
    return { activities: all, error: null }
  } catch (err) {
    return { activities: [], error: err instanceof Error ? err.message : 'Time clock unavailable' }
  }
}

// ── Hours for a specific job ──────────────────────────────────────────────────

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
  // Crave rule: max 2.5 hrs/day × 7 (paired slot counted once)
  if (jobName.toLowerCase().includes('crave')) {
    return Math.min(totalSeconds / 3600, 2.5 * 7)
  }
  return totalSeconds / 3600
}

function clockedHoursForJobIds(activities: TimeActivity[], jobIds: Set<string>, jobName: string): number {
  let totalSeconds = 0
  const nowSec = Math.floor(Date.now() / 1000)
  for (const sh of activities) {
    if (!sh.jobId) continue
    if (!jobIds.has(sh.jobId)) continue
    const start = sh.start?.timestamp
    if (!start) continue
    // Open clock-in: count up to now (matches Connecteam's live timesheet)
    const end = sh.end?.timestamp ?? nowSec
    if (end > start) totalSeconds += end - start
  }
  if (jobName.toLowerCase().includes('crave')) {
    return Math.min(totalSeconds / 3600, 2.5 * 7)
  }
  return totalSeconds / 3600
}

// ── Margin calculation (SHEET-DRIVEN) ─────────────────────────────────────────
// Revenue = sheet avgWeeklyEarnings (canonical), or billing-config fallback
// Cost = sheet avgWeeklyHours × site.labourRatePerHour
// Clocked hours = QA exception flag only (delivery), NOT a cost input

function calculateMargin(args: {
  expectedWeeklyHours: number
  expectedWeeklyEarnings: number | null
  fallbackBilling: {
    type: string
    billingRatePerHour: number | null
    monthlyBillingValue: number | null
  }
  labourRatePerHour: number
  fixedMonthlyCost: number | null  // subcontractor flat fee (e.g. Cleanz4U)
}): {
  revenue: number
  labourCost: number
  grossMarginPct: number | null
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

  if (args.expectedWeeklyEarnings !== null && args.expectedWeeklyEarnings > 0) {
    revenue = args.expectedWeeklyEarnings
    revenueSource = 'sheet'
  } else if (args.fallbackBilling.type === 'monthly_fixed' && args.fallbackBilling.monthlyBillingValue) {
    revenue = args.fallbackBilling.monthlyBillingValue / WEEKS_PER_MONTH
    revenueSource = 'billing_override'
  } else if (args.fallbackBilling.type === 'hourly' && args.fallbackBilling.billingRatePerHour) {
    revenue = args.expectedWeeklyHours * args.fallbackBilling.billingRatePerHour
    revenueSource = 'billing_override'
  } else {
    return { revenue: 0, labourCost: labour, grossMarginPct: null, revenueSource: 'none', costModel }
  }

  const grossMarginPct = revenue > 0 ? ((revenue - labour) / revenue) * 100 : null
  return { revenue, labourCost: labour, grossMarginPct, revenueSource, costModel }
}

// ── Delivery flag (clocked vs expected, ±15% tolerance) ───────────────────────

function deriveDeliveryFlag(
  clocked: number | null,
  expected: number,
): { flag: 'over' | 'under' | 'on_track' | null; variance: number | null } {
  if (clocked === null || expected <= 0) return { flag: null, variance: null }
  const variance = clocked - expected
  const tolerance = expected * 0.15
  if (variance > tolerance) return { flag: 'over', variance }
  if (variance < -tolerance) return { flag: 'under', variance }
  return { flag: 'on_track', variance }
}

// ── Health logic ──────────────────────────────────────────────────────────────

function deriveHealth(args: {
  rateConfirmed: boolean
  grossMarginPct: number | null
  revenueSource: 'sheet' | 'billing_override' | 'none'
  sheetRowLinked: boolean
  connecteamError: string | null
  clockedHours: number | null
  expectedWeeklyHours: number | null
  deliveryFlag: 'over' | 'under' | 'on_track' | null
  deliveryVariance: number | null
}): { healthStatus: HealthStatus; statusReason: string } {
  const marginStr = args.grossMarginPct !== null ? `${Math.round(args.grossMarginPct * 10) / 10}%` : null

  // No sheet row AND no fallback billing config → can't compute anything
  if (args.revenueSource === 'none') {
    return { healthStatus: 'red', statusReason: 'No revenue source — link to Regular Hours sheet or set billing config' }
  }

  // Under-delivery: clocked materially below expected (potential no-show / partial visit)
  if (args.deliveryFlag === 'under' && args.expectedWeeklyHours !== null && args.clockedHours !== null) {
    const varStr = args.deliveryVariance !== null ? `${args.deliveryVariance.toFixed(1)}h` : ''
    return {
      healthStatus: 'red',
      statusReason: `Under-delivered ${varStr} vs ${args.expectedWeeklyHours.toFixed(1)}h expected — check coverage`,
    }
  }

  // Margin below 20% — labour eating revenue
  if (args.grossMarginPct !== null && args.grossMarginPct < 20) {
    return { healthStatus: 'red', statusReason: `Margin ${marginStr} — below 20% minimum` }
  }

  // Margin missing despite revenue source = config gap (e.g. labour rate zero)
  if (args.grossMarginPct === null) {
    return { healthStatus: 'red', statusReason: 'Margin unavailable — check labour rate' }
  }

  // Amber band
  if (args.deliveryFlag === 'over' && args.expectedWeeklyHours !== null && args.clockedHours !== null) {
    const varStr = args.deliveryVariance !== null ? `+${args.deliveryVariance.toFixed(1)}h` : ''
    return {
      healthStatus: 'amber',
      statusReason: `Over-delivered ${varStr} vs ${args.expectedWeeklyHours.toFixed(1)}h expected — margin eater`,
    }
  }
  if (!args.rateConfirmed) {
    return { healthStatus: 'amber', statusReason: `Rate unconfirmed — margin estimate only (${marginStr})` }
  }
  if (!args.sheetRowLinked && args.revenueSource === 'billing_override') {
    return { healthStatus: 'amber', statusReason: `Not in Regular Hours sheet — using billing config (${marginStr})` }
  }
  if (args.connecteamError) {
    return { healthStatus: 'amber', statusReason: `Live hours unavailable — margin from sheet (${marginStr})` }
  }
  if (args.grossMarginPct < 30) {
    return { healthStatus: 'amber', statusReason: `Margin ${marginStr} — below 30% target` }
  }

  // Green
  return { healthStatus: 'green', statusReason: `Margin ${marginStr} — healthy` }
}

// ── Main fetch ────────────────────────────────────────────────────────────────

async function fetchHealthData(): Promise<HealthResponse> {
  const week = getCurrentWeekRange()
  const sites = await prisma.site.findMany({
    orderBy: { name: 'asc' },
    include: { regularHoursSheetRow: true },
  })

  // Fallback lookup by name for sites that haven't been auto-linked yet
  const sheetByName = new Map<string, typeof sites[number]['regularHoursSheetRow']>()
  const allRows = await prisma.regularHoursSheetRow.findMany({ where: { status: 'active' } })
  for (const row of allRows) {
    sheetByName.set(row.businessName.toLowerCase().trim(), row)
  }

  let allShifts: ConnecteamShift[] = []
  let allActivities: TimeActivity[] = []
  let jobMap = new Map<string, Set<string>>()
  let connecteamAvailable = false
  let globalConnecteamError: string | null = null

  try {
    const apiKey = loadConnecteamKey()
    const [shiftsResult, activitiesResult, map] = await Promise.all([
      fetchAllShifts(week, apiKey),
      fetchAllTimeActivities(week, apiKey),
      getJobIdMap(apiKey),
    ])
    allShifts = shiftsResult.shifts
    allActivities = activitiesResult.activities
    // Surface time-clock errors only if shifts also failed — partial data still useful
    globalConnecteamError = shiftsResult.error ?? activitiesResult.error
    jobMap = map
    connecteamAvailable = !shiftsResult.error && !activitiesResult.error
  } catch (err) {
    globalConnecteamError = err instanceof Error ? err.message : 'Connecteam unavailable'
    console.error('[api/health] Connecteam fetch failed:', globalConnecteamError)
  }

  const contracts: ContractHealth[] = []

  for (const site of sites) {
    let clockedHours: number | null = null
    let scheduledHours: number | null = null
    let connecteamError: string | null = globalConnecteamError

    if (!site.connecteamJobName) {
      connecteamError = 'No Connecteam job mapped'
    } else if (!globalConnecteamError) {
      const jobKey = site.connecteamJobName.toLowerCase().trim()
      const jobIds = jobMap.get(jobKey)
      if (!jobIds || jobIds.size === 0) {
        connecteamError = `Job "${site.connecteamJobName}" not found in Connecteam`
      } else {
        clockedHours = clockedHoursForJobIds(allActivities, jobIds, site.connecteamJobName)
        scheduledHours = scheduledHoursForJobIds(allShifts, jobIds, site.connecteamJobName)
        connecteamError = null
      }
    }

    // Sheet truth: prefer FK, fall back to case-insensitive name lookup
    const sheetRow = site.regularHoursSheetRow ?? sheetByName.get(site.name.toLowerCase().trim()) ?? null
    const expectedWeeklyHours = sheetRow ? Number(sheetRow.avgWeeklyHours) : 0
    const expectedWeeklyEarnings = sheetRow ? Number(sheetRow.avgWeeklyEarnings) : null
    const sheetRowLinked = sheetRow !== null

    // Margin uses SHEET hours and SHEET revenue (truth), not clocked.
    // fixedMonthlyCost overrides the hours × labour-rate cost model (subcontractor flat fee).
    const { revenue, grossMarginPct, revenueSource, costModel } = calculateMargin({
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

    // Clocked-vs-expected variance is now the QA signal, not the cost input
    const { flag: deliveryFlag, variance: deliveryVariance } = deriveDeliveryFlag(clockedHours, expectedWeeklyHours)

    const { healthStatus, statusReason } = deriveHealth({
      rateConfirmed: site.rateConfirmed,
      grossMarginPct,
      revenueSource,
      sheetRowLinked,
      connecteamError,
      clockedHours,
      expectedWeeklyHours: sheetRowLinked ? expectedWeeklyHours : null,
      deliveryFlag,
      deliveryVariance,
    })

    contracts.push({
      id: site.id,
      name: site.name,
      cellTier: site.cellTier,
      billingType: site.billingType,
      rateConfirmed: site.rateConfirmed,
      connecteamJobName: site.connecteamJobName,
      weeklyHours: sheetRowLinked ? expectedWeeklyHours : null,    // back-compat: was clocked, now expected (sheet truth)
      expectedWeeklyHours: sheetRowLinked ? expectedWeeklyHours : null,
      clockedHours,
      scheduledHours,
      weeklyRevenue: revenueSource !== 'none' ? Math.round(revenue * 100) / 100 : null,
      grossMarginPct: grossMarginPct !== null ? Math.round(grossMarginPct * 10) / 10 : null,
      revenueSource,
      costModel,
      fixedMonthlyCost: site.fixedMonthlyCost ? Number(site.fixedMonthlyCost) : null,
      deliveryFlag,
      deliveryVariance: deliveryVariance !== null ? Math.round(deliveryVariance * 10) / 10 : null,
      sheetRowLinked,
      connecteamError,
      healthStatus,
      statusReason,
    })
  }

  const summary = {
    green: contracts.filter(c => c.healthStatus === 'green').length,
    amber: contracts.filter(c => c.healthStatus === 'amber').length,
    red: contracts.filter(c => c.healthStatus === 'red').length,
    total: contracts.length,
  }

  return {
    contracts,
    summary,
    week: { start: week.start.toISOString(), end: week.end.toISOString() },
    fetchedAt: new Date().toISOString(),
    connecteamAvailable,
  }
}

// ── GET /api/health ───────────────────────────────────────────────────────────

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
    const data = await fetchHealthData()
    cache = { data, expires: Date.now() + CACHE_TTL_MS }
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/health] failed:', err instanceof Error ? err.message : err)
    if (cache?.data) {
      return NextResponse.json({ ...cache.data, error: 'Data temporarily unavailable' })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
