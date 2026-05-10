import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

const VALID_ENTITY_TYPES = ['lead', 'deal', 'contact', 'account'];
const VALID_ACTIVITY_TYPES = ['note', 'call', 'email', 'meeting', 'status_change'];

// GET /api/activities - List activities (filtered by entity)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1') || 1;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20') || 20, 100);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    const where: Record<string, unknown> = {};

    if (entityType) {
      if (!VALID_ENTITY_TYPES.includes(entityType)) {
        return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 });
      }
      where.entityType = entityType;
    }
    if (entityId) where.entityId = entityId;

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          activityType: true,
          description: true,
          metadata: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
        },
      }),
      prisma.activity.count({ where }),
    ]);

    return NextResponse.json({ activities, total, page, limit });
  } catch (error) {
    console.error('Activities list error:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}

// POST /api/activities - Create activity
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
    const { activityType, description, metadata, entityType, entityId } = body;

    if (!activityType || !description) {
      return NextResponse.json({ error: 'activityType and description are required' }, { status: 400 });
    }

    if (typeof description !== 'string' || description.length > 5000) {
      return NextResponse.json({ error: 'description must be a string under 5000 chars' }, { status: 400 });
    }

    if (metadata && JSON.stringify(metadata).length > 10000) {
      return NextResponse.json({ error: 'metadata too large' }, { status: 400 });
    }

    if (!VALID_ACTIVITY_TYPES.includes(activityType)) {
      return NextResponse.json({ error: 'Invalid activityType' }, { status: 400 });
    }

    if (entityType && !VALID_ENTITY_TYPES.includes(entityType)) {
      return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 });
    }

    const activity = await prisma.activity.create({
      data: {
        activityType,
        description,
        metadata: metadata ?? undefined,
        entityType: entityType ?? undefined,
        entityId: entityId ?? undefined,
        userId: session.user.id,
      },
      select: {
        id: true,
        activityType: true,
        description: true,
        metadata: true,
        entityType: true,
        entityId: true,
        createdAt: true,
      },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error('Activity create error:', error);
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
  }
}
