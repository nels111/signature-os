import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isVa = session.user.role === 'va';
    const userId = session.user.id;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1)); // Monday

    // ---------- Call counts ----------
    let callsToday = 0;
    let callsWeek = 0;

    // NOTE: This DB uses camelCase column names (Prisma default, no @map decorators)
    // All raw SQL must use quoted identifiers: "activityType", "entityType", "createdAt", etc.

    if (isVa) {
      const [todayRows, weekRows] = await Promise.all([
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::bigint as count FROM activities
          WHERE "activityType" = 'call'
            AND "entityType" = 'lead'
            AND "createdAt" >= ${todayStart}
            AND "userId" = ${userId}
        `.catch(() => [{ count: BigInt(0) }]),
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::bigint as count FROM activities
          WHERE "activityType" = 'call'
            AND "entityType" = 'lead'
            AND "createdAt" >= ${weekStart}
            AND "userId" = ${userId}
        `.catch(() => [{ count: BigInt(0) }]),
      ]);
      callsToday = Number(todayRows[0]?.count ?? 0);
      callsWeek = Number(weekRows[0]?.count ?? 0);
    } else {
      const [todayRows, weekRows] = await Promise.all([
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::bigint as count FROM activities
          WHERE "activityType" = 'call'
            AND "entityType" = 'lead'
            AND "createdAt" >= ${todayStart}
        `.catch(() => [{ count: BigInt(0) }]),
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::bigint as count FROM activities
          WHERE "activityType" = 'call'
            AND "entityType" = 'lead'
            AND "createdAt" >= ${weekStart}
        `.catch(() => [{ count: BigInt(0) }]),
      ]);
      callsToday = Number(todayRows[0]?.count ?? 0);
      callsWeek = Number(weekRows[0]?.count ?? 0);
    }

    // ---------- Outcome breakdown (this week) ----------
    let outcomesRaw: Array<{ outcome: string | null; count: bigint }> = [];
    if (isVa) {
      outcomesRaw = await prisma.$queryRaw<Array<{ outcome: string | null; count: bigint }>>`
        SELECT metadata->>'callOutcome' as outcome, COUNT(*)::bigint as count
        FROM activities
        WHERE "activityType" = 'call'
          AND "entityType" = 'lead'
          AND "createdAt" >= ${weekStart}
          AND "userId" = ${userId}
        GROUP BY metadata->>'callOutcome'
      `.catch(() => []);
    } else {
      outcomesRaw = await prisma.$queryRaw<Array<{ outcome: string | null; count: bigint }>>`
        SELECT metadata->>'callOutcome' as outcome, COUNT(*)::bigint as count
        FROM activities
        WHERE "activityType" = 'call'
          AND "entityType" = 'lead'
          AND "createdAt" >= ${weekStart}
        GROUP BY metadata->>'callOutcome'
      `.catch(() => []);
    }

    const outcomes: Record<string, number> = {};
    for (const row of outcomesRaw) {
      outcomes[row.outcome || 'unknown'] = Number(row.count);
    }

    // ---------- Meetings booked this week (non-VA only) ----------
    let meetingsBooked = 0;
    if (!isVa) {
      const mb = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count FROM leads
        WHERE stage::text = 'meeting_scheduled'
          AND "stageChangedAt" >= ${weekStart}
          AND "deletedAt" IS NULL
      `.catch(() => [{ count: BigInt(0) }]);
      meetingsBooked = Number(mb[0]?.count ?? 0);
    }

    // ---------- Open callbacks ----------
    let openCallbacks = 0;
    if (isVa) {
      const rows = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count FROM tasks
        WHERE subject LIKE 'Callback:%'
          AND status NOT IN ('completed', 'deferred')
          AND "deletedAt" IS NULL
          AND "ownerId" = ${userId}
      `.catch(() => [{ count: BigInt(0) }]);
      openCallbacks = Number(rows[0]?.count ?? 0);
    } else {
      const rows = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count FROM tasks
        WHERE subject LIKE 'Callback:%'
          AND status NOT IN ('completed', 'deferred')
          AND "deletedAt" IS NULL
      `.catch(() => [{ count: BigInt(0) }]);
      openCallbacks = Number(rows[0]?.count ?? 0);
    }

    // ---------- Queue size (leads in cold call / follow-up stages) ----------
    const QUEUE_STAGES = ['new_lead', 'cold_call', 'follow_up_sequence'];
    let queueSize = 0;
    if (isVa) {
      const rows = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count FROM leads
        WHERE stage::text = ANY(${QUEUE_STAGES}::text[])
          AND "deletedAt" IS NULL
          AND "ownerId" = ${userId}
      `.catch(() => [{ count: BigInt(0) }]);
      queueSize = Number(rows[0]?.count ?? 0);
    } else {
      const rows = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count FROM leads
        WHERE stage::text = ANY(${QUEUE_STAGES}::text[])
          AND "deletedAt" IS NULL
      `.catch(() => [{ count: BigInt(0) }]);
      queueSize = Number(rows[0]?.count ?? 0);
    }

    return NextResponse.json({
      callsToday,
      callsWeek,
      outcomes,
      meetingsBooked,
      openCallbacks,
      queueSize,
    });
  } catch (error) {
    console.error('Cold calling stats error:', error);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
