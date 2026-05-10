import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { syncTranscripts } from '@/lib/fireflies';

export const runtime = 'nodejs';

// GET /api/fireflies - List transcripts from DB
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1') || 1;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20') || 20, 100);
    const linkedLeadId = searchParams.get('linkedLeadId');
    const linkedDealId = searchParams.get('linkedDealId');
    const linkedContactId = searchParams.get('linkedContactId');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (linkedLeadId) where.linkedLeadId = linkedLeadId;
    if (linkedDealId) where.linkedDealId = linkedDealId;
    if (linkedContactId) where.linkedContactId = linkedContactId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [transcripts, total] = await Promise.all([
      prisma.firefliesTranscript.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          firefliesId: true,
          title: true,
          date: true,
          summary: true,
          participants: true,
          linkedLeadId: true,
          linkedDealId: true,
          linkedContactId: true,
          createdAt: true,
          linkedLead: { select: { id: true, companyName: true } },
          linkedDeal: { select: { id: true, name: true } },
          linkedContact: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.firefliesTranscript.count({ where }),
    ]);

    return NextResponse.json({ transcripts, total, page, limit });
  } catch (error) {
    console.error('Fireflies list error:', error);
    return NextResponse.json({ error: 'Failed to fetch transcripts' }, { status: 500 });
  }
}

// POST /api/fireflies - Trigger sync (admin only)
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if ((session.user as { role?: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await syncTranscripts();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Fireflies sync error:', error);
    return NextResponse.json({ error: 'Failed to sync transcripts' }, { status: 500 });
  }
}
