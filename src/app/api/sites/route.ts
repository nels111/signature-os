import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { fetchHoursSheet } from '@/lib/dropbox-hours'
import { getDefaultLabourRate } from '@/lib/org-settings'

const WEEKS_PER_MONTH = 4.33

function deriveCellTier(weeklyHours: number): 'A' | 'B' | 'C' {
  if (weeklyHours >= 31) return 'C'
  if (weeklyHours >= 16) return 'B'
  return 'A'
}

function deriveRate(weeklyEarnings: number, weeklyHours: number): number {
  if (!weeklyHours) return 27
  // Round to nearest 50p
  return Math.round((weeklyEarnings / weeklyHours) * 2) / 2
}

// GET /api/sites — list active sites from the Regular Hours Sheet, merged with DB overrides
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin' && session.user.role !== 'operations') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const includeInactive = searchParams.get('includeInactive') === 'true'

  try {
    // Fetch live data from Regular Hours Sheet (Dropbox xlsx)
    const sheetData = await fetchHoursSheet()
    const defaultLabourRate = await getDefaultLabourRate()

    // Load all existing DB records for override merging
    const dbSites = await prisma.site.findMany({})
    const dbByName = new Map(dbSites.map(s => [s.name.toLowerCase().trim(), s]))

    const seenNames = new Set<string>()
    const results = []

    for (const row of sheetData.contracts) {
      // Include active contracts; include pipeline only when includeInactive is set
      if (row.status !== 'active' && !includeInactive) continue

      const nameKey = row.name.toLowerCase().trim()
      seenNames.add(nameKey)

      const cellTier = deriveCellTier(row.weeklyHours)
      const derivedRate = deriveRate(row.weeklyEarnings, row.weeklyHours)

      const existing = dbByName.get(nameKey)

      if (existing) {
        // Site exists in DB — update cell tier from sheet if it shifted (not a user-confirmed field)
        // but don't touch billing fields if user has confirmed them
        const updates: Record<string, unknown> = {}
        if (existing.cellTier !== cellTier) updates.cellTier = cellTier
        if (!existing.active) updates.active = true

        if (Object.keys(updates).length > 0) {
          Object.assign(existing, updates)
          await prisma.site.update({ where: { id: existing.id }, data: updates })
        }

        results.push(existing)
      } else {
        // New site from sheet — create DB record with derived billing
        const newSite = await prisma.site.create({
          data: {
            name: row.name.trim(),
            cellTier,
            billingType: 'hourly',
            billingRatePerHour: derivedRate,
            labourRatePerHour: defaultLabourRate,
            rateConfirmed: false,
            active: row.status === 'active',
          },
        })
        results.push(newSite)
      }
    }

    // Mark sites no longer in the sheet as inactive
    for (const dbSite of dbSites) {
      if (dbSite.active && !seenNames.has(dbSite.name.toLowerCase().trim())) {
        await prisma.site.update({ where: { id: dbSite.id }, data: { active: false } })
      }
    }

    // Sort: Cell tier asc, then name asc
    const tierOrder = { A: 0, B: 1, C: 2 }
    results.sort((a, b) => {
      const tc = tierOrder[a.cellTier as 'A' | 'B' | 'C'] - tierOrder[b.cellTier as 'A' | 'B' | 'C']
      if (tc !== 0) return tc
      return a.name.localeCompare(b.name)
    })

    // Augment each result with contracted financial data from the sheet
    const sheetRowByName = new Map(sheetData.contracts.map(r => [r.name.toLowerCase().trim(), r]))
    const augmented = results.map(site => ({
      ...site,
      weeklyHours: sheetRowByName.get(site.name.toLowerCase().trim())?.weeklyHours ?? null,
      weeklyEarnings: sheetRowByName.get(site.name.toLowerCase().trim())?.weeklyEarnings ?? null,
    }))

    return NextResponse.json({ sites: augmented, sheetFetchedAt: sheetData.fetchedAt })
  } catch (err) {
    // Sheet unavailable — fall back to DB cache
    console.error('[sites] sheet fetch failed, falling back to DB:', err)
    const sites = await prisma.site.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: [{ cellTier: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json({ sites, fallback: true })
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
