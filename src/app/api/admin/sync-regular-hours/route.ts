import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { fetchHoursSheet } from '@/lib/dropbox-hours'
import { syncSitesFromSheet } from '@/lib/sites-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/sync-regular-hours
 *
 * Pulls the Regular Hours Sheet from Dropbox and upserts every row into
 * `regular_hours_sheet_rows`. Then auto-links any Site (by case-insensitive
 * name match) that doesn't already have a `regularHoursSheetRowId` set.
 *
 * This table is the canonical source of contracted hours + revenue per contract.
 * CT scheduler shifts are PERMISSION WINDOWS, not work durations — ignore for cost.
 * Clocked hours are exposed elsewhere as a QA / exception flag (over/under-delivery).
 */
export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin' && session.user.role !== 'operations') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let sheet
  try {
    sheet = await fetchHoursSheet()
  } catch (err) {
    return NextResponse.json(
      { error: 'Sheet fetch failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    )
  }

  let upserted = 0
  let linked = 0
  const errors: Array<{ row: string; error: string }> = []

  for (const row of sheet.contracts) {
    try {
      await prisma.regularHoursSheetRow.upsert({
        where: { businessName: row.name },
        create: {
          businessName: row.name,
          cleanType: row.cleanType || null,
          hoursPerVisit: row.hoursPerVisit,
          frequencyPerWeek: row.frequencyPerWeek,
          avgWeeklyHours: row.weeklyHours,
          avgWeeklyEarnings: row.weeklyEarnings,
          avgMonthlyEarnings: row.monthlyEarnings,
          signedTerms: row.signedTerms,
          annualValue: row.annualValue,
          firstAuditDate: row.firstAuditDate ? new Date(row.firstAuditDate) : null,
          status: row.status,
          syncedAt: new Date(),
        },
        update: {
          cleanType: row.cleanType || null,
          hoursPerVisit: row.hoursPerVisit,
          frequencyPerWeek: row.frequencyPerWeek,
          avgWeeklyHours: row.weeklyHours,
          avgWeeklyEarnings: row.weeklyEarnings,
          avgMonthlyEarnings: row.monthlyEarnings,
          signedTerms: row.signedTerms,
          annualValue: row.annualValue,
          firstAuditDate: row.firstAuditDate ? new Date(row.firstAuditDate) : null,
          status: row.status,
          syncedAt: new Date(),
        },
      })
      upserted++
    } catch (err) {
      errors.push({ row: row.name, error: err instanceof Error ? err.message : String(err) })
    }
  }

  // Auto-link Sites to sheet rows by case-insensitive name match.
  // Only fills in NULL FKs — never overwrites an explicit link.
  const sheetRows = await prisma.regularHoursSheetRow.findMany({
    select: { id: true, businessName: true },
  })
  const byNameKey = new Map(
    sheetRows.map(r => [r.businessName.toLowerCase().trim(), r.id])
  )

  const unlinkedSites = await prisma.site.findMany({
    where: { regularHoursSheetRowId: null },
    select: { id: true, name: true },
  })

  for (const site of unlinkedSites) {
    const sheetRowId = byNameKey.get(site.name.toLowerCase().trim())
    if (sheetRowId) {
      await prisma.site.update({
        where: { id: site.id },
        data: { regularHoursSheetRowId: sheetRowId },
      })
      linked++
    }
  }

  // Reconcile Site records from the sheet (create/update/deactivate) — moved out
  // of GET /api/sites so reads have no side-effects. Best-effort: a failure here
  // does not fail the sheet-row sync.
  let siteSync = null
  try {
    siteSync = await syncSitesFromSheet({ sheetData: sheet })
  } catch (err) {
    errors.push({ row: '__site_sync__', error: err instanceof Error ? err.message : String(err) })
  }

  return NextResponse.json({
    ok: true,
    upserted,
    linked,
    siteSync,
    totals: sheet.totals,
    fetchedAt: sheet.fetchedAt,
    errors: errors.length > 0 ? errors : undefined,
  })
}

/**
 * GET /api/admin/sync-regular-hours
 *
 * Returns current state of the persisted sheet rows + last sync time.
 * Cheap, no Dropbox fetch.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin' && session.user.role !== 'operations') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await prisma.regularHoursSheetRow.findMany({
    orderBy: [{ status: 'asc' }, { businessName: 'asc' }],
    include: { sites: { select: { id: true, name: true, connecteamJobName: true } } },
  })

  const active = rows.filter(r => r.status === 'active')
  const pipeline = rows.filter(r => r.status === 'pipeline')

  const sum = (arr: typeof rows, field: 'avgWeeklyHours' | 'avgWeeklyEarnings' | 'avgMonthlyEarnings' | 'annualValue') =>
    arr.reduce((s, r) => s + Number(r[field]), 0)

  return NextResponse.json({
    rows,
    totals: {
      activeContracts: active.length,
      pipelineContracts: pipeline.length,
      weeklyHours: sum(active, 'avgWeeklyHours'),
      weeklyEarnings: sum(active, 'avgWeeklyEarnings'),
      monthlyEarnings: sum(active, 'avgMonthlyEarnings'),
      annualValue: sum(active, 'annualValue'),
    },
    lastSyncedAt: rows[0]?.syncedAt ?? null,
  })
}
