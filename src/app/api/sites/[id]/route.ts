import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { fetchHoursSheet } from '@/lib/dropbox-hours'

// GET /api/sites/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.user.role !== 'admin' && session.user.role !== 'operations') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const site = await prisma.site.findUnique({ where: { id } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Augment with sheet data (weeklyHours, weeklyEarnings from Regular Hours Sheet)
  let weeklyHours: number | null = null
  let weeklyEarnings: number | null = null
  let sheetFetchedAt: string | null = null

  try {
    const sheetData = await fetchHoursSheet()
    const row = sheetData.contracts.find(
      r => r.name.toLowerCase().trim() === site.name.toLowerCase().trim()
    )
    if (row) {
      weeklyHours = row.weeklyHours ?? null
      weeklyEarnings = row.weeklyEarnings ?? null
    }
    sheetFetchedAt = sheetData.fetchedAt ?? null
  } catch {
    // Sheet unavailable — return DB data only, caller handles nulls
  }

  return NextResponse.json({ site: { ...site, weeklyHours, weeklyEarnings }, sheetFetchedAt })
}

// PATCH /api/sites/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin' && session.user.role !== 'operations') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const site = await prisma.site.findUnique({ where: { id } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const updated = await prisma.site.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: String(body.name) }),
      ...(body.connecteamJobName !== undefined && { connecteamJobName: body.connecteamJobName ? String(body.connecteamJobName) : null }),
      ...(body.cellTier !== undefined && { cellTier: body.cellTier as 'A' | 'B' | 'C' }),
      ...(body.billingType !== undefined && { billingType: body.billingType as 'hourly' | 'monthly_fixed' }),
      ...(body.billingRatePerHour !== undefined && { billingRatePerHour: body.billingRatePerHour ? Number(body.billingRatePerHour) : null }),
      ...(body.monthlyBillingValue !== undefined && { monthlyBillingValue: body.monthlyBillingValue ? Number(body.monthlyBillingValue) : null }),
      ...(body.labourRatePerHour !== undefined && { labourRatePerHour: Number(body.labourRatePerHour) }),
      ...(body.fixedMonthlyCost !== undefined && {
        fixedMonthlyCost:
          body.fixedMonthlyCost === null || body.fixedMonthlyCost === ''
            ? null
            : Number(body.fixedMonthlyCost),
      }),
      ...(body.rateConfirmed !== undefined && { rateConfirmed: Boolean(body.rateConfirmed) }),
      ...(body.active !== undefined && { active: Boolean(body.active) }),
      ...(body.notes !== undefined && { notes: body.notes ? String(body.notes) : null }),
    },
  })

  return NextResponse.json({ site: updated })
}
