import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/dashboard/va
// Returns cold-calling focused stats for the VA role
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const [
      queueCount,
      callsToday,
      emailsToday,
      openTasks,
      overdueTasks,
      myLeads,
      recentCalls,
    ] = await Promise.all([
      // Call queue: all leads at callable stages NOT already called today
      // No owner filter — VA works the shared queue regardless of who imported the lead
      prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT l.id)::bigint as count
          FROM leads l
          WHERE l.stage::text = ANY(ARRAY['new_lead','cold_call','follow_up_sequence'])
            AND l."deletedAt" IS NULL
            AND l.id NOT IN (
              SELECT DISTINCT a."entityId" FROM activities a
              WHERE a."activityType" = 'call'
                AND a."entityType" = 'lead'
                AND a."createdAt" >= ${startOfDay}
                AND (a.metadata->>'callOutcome') != 'callback_needed'
            )
        `.then(r => Number(r[0]?.count ?? 0)).catch(() => 0),

      // Calls logged today by this user
      prisma.activity.count({
        where: {
          activityType: 'call',
          userId,
          createdAt: { gte: startOfDay, lt: endOfDay },
        },
      }),

      // Follow-up emails sent today by this user
      prisma.activity.count({
        where: {
          activityType: 'email',
          userId,
          createdAt: { gte: startOfDay, lt: endOfDay },
        },
      }),

      // Open tasks assigned to this user
      prisma.task.count({
        where: {
          ownerId: userId,
          status: { in: ['not_started', 'in_progress'] as never[] },
          deletedAt: null,
        },
      }),

      // Overdue tasks
      prisma.task.count({
        where: {
          ownerId: userId,
          status: { in: ['not_started', 'in_progress'] as never[] },
          dueDate: { lt: now },
          deletedAt: null,
        },
      }),

      // Total leads assigned to this user
      prisma.lead.count({
        where: {
          ownerId: userId,
          deletedAt: null,
        },
      }),

      // Last 5 calls logged by this user
      prisma.activity.findMany({
        where: {
          activityType: 'call',
          userId,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          description: true,
          createdAt: true,
          entityId: true,
          metadata: true,
        },
      }),
    ]);

    // Enrich recent calls with lead names
    const leadIds = recentCalls.map(c => c.entityId).filter((id): id is string => !!id);
    const leads = leadIds.length > 0
      ? await prisma.lead.findMany({
          where: { id: { in: leadIds } },
          select: { id: true, companyName: true },
        })
      : [];
    const leadMap = Object.fromEntries(leads.map(l => [l.id, l.companyName]));

    return NextResponse.json({
      queueCount,
      callsToday,
      emailsToday,
      openTasks,
      overdueTasks,
      myLeads,
      recentCalls: recentCalls.map(c => ({
        ...c,
        companyName: leadMap[c.entityId ?? ''] || 'Unknown',
      })),
    });
  } catch (error) {
    console.error('VA dashboard error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
