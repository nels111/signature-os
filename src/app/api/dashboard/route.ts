import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { fetchHoursSheet } from '@/lib/dropbox-hours';
import { fetchActualHours } from '@/lib/connecteam-hours';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// In-memory cache: refresh every 15 minutes
let hoursCache: { data: Awaited<ReturnType<typeof fetchHoursSheet>> | null; expires: number } = {
  data: null,
  expires: 0,
};

let actualHoursCache: { data: Awaited<ReturnType<typeof fetchActualHours>> | null; expires: number } = {
  data: null,
  expires: 0,
};

async function getCachedHoursSheet() {
  if (hoursCache.data && Date.now() < hoursCache.expires) {
    return hoursCache.data;
  }
  try {
    const data = await fetchHoursSheet();
    hoursCache = { data, expires: Date.now() + 15 * 60 * 1000 };
    return data;
  } catch (error) {
    console.error('Hours sheet fetch error:', error);
    if (hoursCache.data) return hoursCache.data;
    return null;
  }
}

async function getCachedActualHours() {
  if (actualHoursCache.data && Date.now() < actualHoursCache.expires) {
    return actualHoursCache.data;
  }
  try {
    const data = await fetchActualHours();
    actualHoursCache = { data, expires: Date.now() + 10 * 60 * 1000 };
    return data;
  } catch (error) {
    console.error('Connecteam hours fetch error:', error);
    if (actualHoursCache.data) return actualHoursCache.data;
    return null;
  }
}

// GET /api/dashboard
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Fetch DB stats and hours sheet in parallel
    const [
      totalLeads,
      totalDeals,
      totalContacts,
      totalAccounts,
      dealsByStage,
      recentActivities,
      overdueTasks,
      upcomingEvents,
      quotesThisMonth,
      unreadNotifications,
      pipelineDeals,
      hoursSheet,
      actualHours,
    ] = await Promise.all([
      prisma.lead.count({ where: { deletedAt: null } }),
      prisma.deal.count({ where: { deletedAt: null } }),
      prisma.contact.count({ where: { deletedAt: null } }),
      prisma.account.count({ where: { deletedAt: null } }),

      prisma.deal.groupBy({
        by: ['stage'],
        where: { deletedAt: null },
        _count: { id: true },
      }),

      prisma.activity.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          activityType: true,
          description: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
        },
      }),

      prisma.task.count({
        where: {
          deletedAt: null,
          status: { not: 'completed' },
          dueDate: { lt: now },
        },
      }),

      prisma.calendarEvent.count({
        where: {
          deletedAt: null,
          startDate: { gte: now, lte: sevenDaysFromNow },
        },
      }),

      prisma.quote.aggregate({
        where: { createdAt: { gte: startOfMonth } },
        _count: { id: true },
        _sum: { monthlyTotal: true },
      }),

      prisma.notification.count({
        where: { userId: session.user.id, read: false },
      }),

      prisma.deal.groupBy({
        by: ['stage'],
        where: {
          deletedAt: null,
          stage: { notIn: ['closed_won', 'closed_lost'] },
        },
        _sum: { value: true },
        _count: { id: true },
      }),

      getCachedHoursSheet(),

      getCachedActualHours(),
    ]);

    return NextResponse.json({
      // CRM stats
      totalLeads,
      totalDeals,
      totalContacts,
      totalAccounts,
      dealsByStage: dealsByStage.map((d) => ({
        stage: d.stage,
        count: d._count.id,
      })),
      recentActivities,
      overdueTasks,
      upcomingEvents,
      quotesThisMonth: {
        count: quotesThisMonth._count.id,
        totalValue: quotesThisMonth._sum.monthlyTotal ?? 0,
      },
      unreadNotifications,
      pipelineValue: pipelineDeals.map((d) => ({
        stage: d.stage,
        count: d._count.id,
        value: d._sum.value ?? 0,
      })),

      // Hours sheet (real ops data)
      hoursSheet: hoursSheet
        ? {
            activeContracts: hoursSheet.totals.activeContracts,
            pipelineContracts: hoursSheet.totals.pipelineContracts,
            weeklyHours: hoursSheet.totals.weeklyHours,
            weeklyEarnings: hoursSheet.totals.weeklyEarnings,
            monthlyEarnings: hoursSheet.totals.monthlyEarnings,
            annualValue: hoursSheet.totals.annualValue,
            contracts: hoursSheet.contracts,
            fetchedAt: hoursSheet.fetchedAt,
          }
        : null,

      // Actual hours from Connecteam
      actualHours: actualHours
        ? {
            weeklyActualHours: actualHours.weeklyActualHours,
            clockedShifts: actualHours.clockedShifts,
            uniqueOperatives: actualHours.uniqueOperatives,
            weekStart: actualHours.weekStart,
            weekEnd: actualHours.weekEnd,
            fetchedAt: actualHours.fetchedAt,
          }
        : null,
    });
  } catch (error) {
    console.error('Dashboard KPI error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
