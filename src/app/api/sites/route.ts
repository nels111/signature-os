import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getDefaultLabourRate } from '@/lib/org-settings'

// GET /api/sites — READ-ONLY list of sites from the DB, augmented with contracted
// hours/revenue from the linked Regular Hours Sheet row. The sheet -> DB
// reconciliation (create/update/deactivate) runs in the daily cron and the admin
// sync endpoint via syncSitesFromSheet() (src/lib/sites-sync.ts), NOT here — so
// this read has no side-effects and no write races.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin' && session.user.role !== 'operations') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const includeInactive = searchParams.get('includeInactive') === 'true'

  try {
    const sites = await prisma.site.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: [{ cellTier: 'asc' }, { name: 'asc' }],
      include: { regularHoursSheetRow: true },
    })

    let lastSyncedAt: Date | null = null
    const augmented = sites.map(({ regularHoursSheetRow, ...site }) => {
      if (
        regularHoursSheetRow?.syncedAt &&
        (!lastSyncedAt || regularHoursSheetRow.syncedAt > lastSyncedAt)
      ) {
        lastSyncedAt = regularHoursSheetRow.syncedAt
      }
      return {
        ...site,
        weeklyHours: regularHoursSheetRow ? Number(regularHoursSheetRow.avgWeeklyHours) : null,
        weeklyEarnings: regularHoursSheetRow ? Number(regularHoursSheetRow.avgWeeklyEarnings) : null,
      }
    })

    return NextResponse.json({
      sites: augmented,
      sheetFetchedAt: (lastSyncedAt as Date | null)?.toISOString() ?? null,
    })
  } catch (err) {
    console.error('[sites] read failed:', err)
    return NextResponse.json({ error: 'Failed to load sites' }, { status: 500 })
  }
}

// POST /api/sites — create a site manually (for pipeline/planned contracts not yet in the sheet)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin' && session.user.role !== 'operations') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { name, connecteamJobName, cellTier, billingType, billingRatePerHour, monthlyBillingValue, labourRatePerHour, rateConfirmed, notes } = body as Record<string, unknown>

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const defaultLabourRate = await getDefaultLabourRate()

  const site = await prisma.site.create({
    data: {
      name: String(name),
      connecteamJobName: connecteamJobName ? String(connecteamJobName) : null,
      cellTier: (cellTier as 'A' | 'B' | 'C') || 'A',
      billingType: (billingType as 'hourly' | 'monthly_fixed') || 'hourly',
      billingRatePerHour: billingRatePerHour ? Number(billingRatePerHour) : null,
      monthlyBillingValue: monthlyBillingValue ? Number(monthlyBillingValue) : null,
      labourRatePerHour: labourRatePerHour ? Number(labourRatePerHour) : defaultLabourRate,
      rateConfirmed: Boolean(rateConfirmed),
      notes: notes ? String(notes) : null,
    },
  })

  return NextResponse.json({ site }, { status: 201 })
}
