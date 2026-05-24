import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrgSettings, invalidateOrgSettingsCache } from '@/lib/org-settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/settings — return org-wide settings (admin + operations can read)
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin' && session.user.role !== 'operations') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const settings = await getOrgSettings()
  return NextResponse.json({ settings })
}

// PATCH /api/settings — admin only
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const updates: Record<string, unknown> = {}

  if (body.defaultLabourRatePerHour !== undefined) {
    const rate = Number(body.defaultLabourRatePerHour)
    if (!Number.isFinite(rate) || rate < 0 || rate > 200) {
      return NextResponse.json({ error: 'defaultLabourRatePerHour must be between 0 and 200' }, { status: 400 })
    }
    updates.defaultLabourRatePerHour = rate
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  updates.updatedBy = session.user.email ?? session.user.name ?? 'unknown'

  const row = await prisma.orgSettings.upsert({
    where: { id: 'singleton' },
    update: updates,
    create: { id: 'singleton', ...updates },
  })

  invalidateOrgSettingsCache()

  return NextResponse.json({
    settings: {
      defaultLabourRatePerHour: Number(row.defaultLabourRatePerHour),
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
    },
  })
}
