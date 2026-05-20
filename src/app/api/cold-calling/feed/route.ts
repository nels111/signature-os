import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isVa = session.user.role === 'va';
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor'); // ISO timestamp for pagination
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '30'), 100);

    // ---------- Activity feed ----------
    // For VA: only their own activities on leads
    // For admin/sales/ops: all activity on leads
    type FeedRow = {
      id: string;
      activity_type: string;
      description: string;
      metadata: unknown;
      created_at: Date;
      user_id: string;
      user_name: string;
      entity_id: string | null;
      entity_type: string | null;
      lead_company: string | null;
      lead_contact: string | null;
      lead_stage: string | null;
    };

    let rows: FeedRow[];

    const cursorDate = cursor ? new Date(cursor) : new Date();

    // DB uses camelCase column names — must use quoted identifiers in raw SQL
    if (isVa) {
      rows = await prisma.$queryRaw<FeedRow[]>`
        SELECT
          a.id,
          a."activityType" as activity_type,
          a.description,
          a.metadata,
          a."createdAt" as created_at,
          a."userId" as user_id,
          u.name as user_name,
          a."entityId" as entity_id,
          a."entityType" as entity_type,
          l."companyName" as lead_company,
          l."contactName" as lead_contact,
          l.stage as lead_stage
        FROM activities a
        JOIN users u ON u.id = a."userId"
        LEFT JOIN leads l ON l.id = a."entityId" AND a."entityType" = 'lead'
        WHERE a."entityType" = 'lead'
          AND a."userId" = ${userId}
          AND a."createdAt" < ${cursorDate}
        ORDER BY a."createdAt" DESC
        LIMIT ${limit}
      `.catch(() => []);
    } else {
      rows = await prisma.$queryRaw<FeedRow[]>`
        SELECT
          a.id,
          a."activityType" as activity_type,
          a.description,
          a.metadata,
          a."createdAt" as created_at,
          a."userId" as user_id,
          u.name as user_name,
          a."entityId" as entity_id,
          a."entityType" as entity_type,
          l."companyName" as lead_company,
          l."contactName" as lead_contact,
          l.stage as lead_stage
        FROM activities a
        JOIN users u ON u.id = a."userId"
        LEFT JOIN leads l ON l.id = a."entityId" AND a."entityType" = 'lead'
        WHERE a."entityType" = 'lead'
          AND a."createdAt" < ${cursorDate}
        ORDER BY a."createdAt" DESC
        LIMIT ${limit}
      `.catch(() => []);
    }

    const items = rows.map((r) => ({
      id: r.id,
      activityType: r.activity_type,
      description: r.description,
      metadata: r.metadata,
      createdAt: r.created_at,
      userId: r.user_id,
      userName: r.user_name,
      entityId: r.entity_id,
      entityType: r.entity_type,
      leadCompany: r.lead_company,
      leadContact: r.lead_contact,
      leadStage: r.lead_stage,
    }));

    const nextCursor =
      items.length === limit ? items[items.length - 1].createdAt.toISOString() : null;

    return NextResponse.json({ items, nextCursor });
  } catch (error) {
    console.error('Cold calling feed error:', error);
    return NextResponse.json({ error: 'Failed to load feed' }, { status: 500 });
  }
}
