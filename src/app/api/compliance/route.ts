import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { Operative, Compliance } from '@prisma/client'

type OperativeWithCompliance = Operative & { compliance: Compliance | null }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ComplianceRow {
  id: string
  connecteamId: string
  fullName: string
  entity: string
  role: string | null
  archived: boolean
  compliance: {
    dbsStatus: string
    dbsExpiry: string | null
    dbsUpdateService: boolean
    insuranceStatus: string
    insuranceExpiry: string | null
    insuranceProvider: string | null
    rtwStatus: string
    rtwType: string | null
    rtwExpiry: string | null
    overallStatus: string
    lastReviewedAt: string | null
  } | null
}

export interface ComplianceResponse {
  rows: ComplianceRow[]
  summary: {
    total: number
    valid: number
    expiring_soon: number
    expired: number
    missing: number
  }
  migrationApplied: true
  fetchedAt: string
}

export interface CompliancePendingResponse {
  migrationApplied: false
  message: string
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter') ?? 'all' // all | valid | expiring_soon | expired | missing
  const entity  = searchParams.get('entity')         // optional entity filter
  const include_archived = searchParams.get('archived') === 'true'

  try {
    const whereOperative = {
      archived: include_archived ? undefined : false,
      ...(entity ? { entity } : {}),
    }

    const whereCompliance = filter !== 'all'
      ? { compliance: { overallStatus: filter as 'valid' | 'expiring_soon' | 'expired' | 'missing' } }
      : {}

    const operatives = await prisma.operative.findMany({
      where: { ...whereOperative, ...whereCompliance },
      include: { compliance: true },
      orderBy: [{ entity: 'asc' }, { fullName: 'asc' }],
    })

    const rows: ComplianceRow[] = (operatives as OperativeWithCompliance[]).map((op: OperativeWithCompliance) => ({
      id: op.id,
      connecteamId: op.connecteamId.toString(),
      fullName: op.fullName,
      entity: op.entity,
      role: op.role,
      archived: op.archived,
      compliance: op.compliance ? {
        dbsStatus:        op.compliance.dbsStatus,
        dbsExpiry:        op.compliance.dbsExpiry?.toISOString() ?? null,
        dbsUpdateService: op.compliance.dbsUpdateService,
        insuranceStatus:  op.compliance.insuranceStatus,
        insuranceExpiry:  op.compliance.insuranceExpiry?.toISOString() ?? null,
        insuranceProvider: op.compliance.insuranceProvider,
        rtwStatus:        op.compliance.rtwStatus,
        rtwType:          op.compliance.rtwType,
        rtwExpiry:        op.compliance.rtwExpiry?.toISOString() ?? null,
        overallStatus:    op.compliance.overallStatus,
        lastReviewedAt:   op.compliance.lastReviewedAt?.toISOString() ?? null,
      } : null,
    }))

    const all = await prisma.operative.findMany({
      where: { archived: false },
      include: { compliance: { select: { overallStatus: true } } },
    })

    const allTyped = all as OperativeWithCompliance[]
    const summary = {
      total:         allTyped.length,
      valid:         allTyped.filter((o: OperativeWithCompliance) => o.compliance?.overallStatus === 'valid').length,
      expiring_soon: allTyped.filter((o: OperativeWithCompliance) => o.compliance?.overallStatus === 'expiring_soon').length,
      expired:       allTyped.filter((o: OperativeWithCompliance) => o.compliance?.overallStatus === 'expired').length,
      missing:       allTyped.filter((o: OperativeWithCompliance) => !o.compliance || o.compliance.overallStatus === 'missing').length,
    }

    const response: ComplianceResponse = {
      rows,
      summary,
      migrationApplied: true,
      fetchedAt: new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (err: unknown) {
    // If the table doesn't exist yet (migration not applied)
    const msg = String(err)
    if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('operatives')) {
      const pending: CompliancePendingResponse = {
        migrationApplied: false,
        message: 'Migration not yet applied. Run: psql $DATABASE_URL -f scripts/migrations/compliance-tracker.sql',
      }
      return NextResponse.json(pending, { status: 200 })
    }
    console.error('[compliance] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PATCH — update a compliance record ────────────────────────────────────────

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Only admin or operations can edit compliance records
  const role = (session.user as { role?: string }).role
  if (role !== 'admin' && role !== 'operations') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { operativeId, ...fields } = body

    if (!operativeId) {
      return NextResponse.json({ error: 'operativeId required' }, { status: 400 })
    }

    // Compute status helpers
    function computeStatus(expiry: string | null | undefined, updateService?: boolean): 'valid' | 'expiring_soon' | 'expired' | 'missing' {
      if (!expiry && !updateService) return 'missing'
      if (updateService) return 'valid' // DBS Update Service — treat as valid, recheck annually
      const days = Math.floor((new Date(expiry!).getTime() - Date.now()) / 86400000)
      if (days <= 0)  return 'expired'
      if (days <= 30) return 'expiring_soon'
      return 'valid'
    }

    const dbsStatus        = fields.dbsExpiry || fields.dbsUpdateService
      ? computeStatus(fields.dbsExpiry, fields.dbsUpdateService) : undefined
    const insuranceStatus  = fields.insuranceExpiry
      ? computeStatus(fields.insuranceExpiry) : undefined
    const rtwStatus        = fields.rtwExpiry !== undefined
      ? (fields.rtwExpiry === null ? 'valid' : computeStatus(fields.rtwExpiry)) // null = permanent
      : undefined

    const statuses = [dbsStatus, insuranceStatus, rtwStatus].filter(Boolean) as string[]
    const overallStatus = statuses.includes('expired') ? 'expired'
      : statuses.includes('expiring_soon') ? 'expiring_soon'
      : statuses.includes('missing') ? 'missing'
      : statuses.length > 0 ? 'valid'
      : undefined

    const updated = await prisma.compliance.upsert({
      where:  { operativeId },
      update: {
        ...fields,
        ...(dbsStatus       ? { dbsStatus }       : {}),
        ...(insuranceStatus ? { insuranceStatus }  : {}),
        ...(rtwStatus       ? { rtwStatus }        : {}),
        ...(overallStatus   ? { overallStatus: overallStatus as 'valid' | 'expiring_soon' | 'expired' | 'missing' } : {}),
        lastReviewedAt: new Date(),
        lastReviewedBy: session.user.email,
      },
      create: {
        operativeId,
        ...fields,
        ...(dbsStatus       ? { dbsStatus: dbsStatus as 'valid' | 'expiring_soon' | 'expired' | 'missing' }       : {}),
        ...(insuranceStatus ? { insuranceStatus: insuranceStatus as 'valid' | 'expiring_soon' | 'expired' | 'missing' }  : {}),
        ...(rtwStatus       ? { rtwStatus: rtwStatus as 'valid' | 'expiring_soon' | 'expired' | 'missing' }        : {}),
        ...(overallStatus   ? { overallStatus: overallStatus as 'valid' | 'expiring_soon' | 'expired' | 'missing' } : {}),
        lastReviewedAt: new Date(),
        lastReviewedBy: session.user.email,
      },
    })

    return NextResponse.json({ ok: true, record: updated })
  } catch (err) {
    console.error('[compliance] PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
