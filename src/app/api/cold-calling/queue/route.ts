import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

// GET /api/cold-calling/queue
// Returns leads at new_lead / cold_call / follow_up_sequence stages
// ordered by stageChangedAt asc (longest untouched first)
// All authenticated users see all queue leads (VA works the shared queue)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const QUEUE_STAGES = ['new_lead', 'cold_call', 'follow_up_sequence'];

    const leads = await prisma.lead.findMany({
      where: {
        stage: { in: QUEUE_STAGES as never[] },
        deletedAt: null,
      },
      orderBy: { stageChangedAt: 'asc' },
      take: 100,
      select: {
        id: true,
        companyName: true,
        contactName: true,
        email: true,
        phone: true,
        stage: true,
        stageChangedAt: true,
        notes: true,
        sector: true,
        owner: { select: { id: true, name: true } },
      },
    });

    // Get last call timestamp for all queue leads in one query
    const leadIds = leads.map(l => l.id);
    const lastCalledMap: Record<string, string> = {};
    const calledSet = new Set<string>();

    // Track callback info per lead (most recent callback outcome)
    const callbackMap: Record<string, { date: string | null; loggedAt: string }> = {};

    if (leadIds.length > 0) {
      const callActivities = await prisma.activity.findMany({
        where: { entityId: { in: leadIds }, entityType: 'lead', activityType: 'call' },
        orderBy: { createdAt: 'desc' },
        select: { entityId: true, createdAt: true, metadata: true },
      });
      for (const a of callActivities) {
        if (!a.entityId) continue;
        const meta = a.metadata as Record<string, unknown> | null;
        const outcome = meta?.callOutcome as string | undefined;

        // Track last call timestamp
        if (!lastCalledMap[a.entityId]) {
          lastCalledMap[a.entityId] = a.createdAt.toISOString();
        }

        // Once called, permanently out of queue — except callback_needed which explicitly stays in
        if (!calledSet.has(a.entityId)) {
          if (outcome === 'callback_needed') {
            callbackMap[a.entityId] = {
              date: (meta?.callbackDate as string | null) || null,
              loggedAt: a.createdAt.toISOString(),
            };
          } else {
            calledSet.add(a.entityId);
          }
        }
      }
    }

    // Permanently exclude any lead that has been called (unless callback_needed)
    const enrichedLeads = leads
      .filter(l => !calledSet.has(l.id))
      .map(l => ({
        ...l,
        lastCalledAt: lastCalledMap[l.id] || null,
        callbackDate: callbackMap[l.id]?.date || null,
        isCallback: !!callbackMap[l.id],
      }));

    return NextResponse.json({ leads: enrichedLeads, total: enrichedLeads.length });
  } catch (error) {
    console.error('Queue fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 });
  }
}
