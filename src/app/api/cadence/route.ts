import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCadenceOverview } from '@/lib/cadence';

export const runtime = 'nodejs';

// GET /api/cadence - List all cadences or get status overview
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view'); // 'overview' for active summary

    if (view === 'overview') {
      const overview = await getCadenceOverview();
      return NextResponse.json({ cadences: overview, count: overview.length });
    }

    const page = Math.max(parseInt(searchParams.get('page') || '1') || 1, 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20') || 20, 100);
    const status = searchParams.get('status');
    const leadId = searchParams.get('leadId');

    const validStatuses = ['active', 'paused_replied', 'paused_meeting', 'stopped_active_client', 'completed', 'long_term_nurture'];
    const where: Record<string, unknown> = { lead: { deletedAt: null } };
    if (status) {
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      where.status = status;
    }
    if (leadId) where.leadId = leadId;

    const [cadences, total] = await Promise.all([
      prisma.cadence.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          status: true,
          currentStep: true,
          nextSendAt: true,
          startedAt: true,
          pausedAt: true,
          pauseReason: true,
          createdAt: true,
          lead: { select: { id: true, companyName: true, contactName: true } },
          _count: { select: { steps: true } },
        },
      }),
      prisma.cadence.count({ where }),
    ]);

    return NextResponse.json({ cadences, total, page, limit });
  } catch (error) {
    console.error('Cadence list error:', error);
    return NextResponse.json({ error: 'Failed to fetch cadences' }, { status: 500 });
  }
}
