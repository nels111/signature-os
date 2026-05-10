import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

// GET /api/dashboard - KPI aggregation for Jaz morning briefings
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

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
    ] = await Promise.all([
      prisma.lead.count({ where: { deletedAt: null } }),
      prisma.deal.count({ where: { deletedAt: null } }),
      prisma.contact.count({ where: { deletedAt: null } }),
      prisma.account.count({ where: { deletedAt: null } }),

      // Deals grouped by stage
      prisma.deal.groupBy({
        by: ['stage'],
        where: { deletedAt: null },
        _count: { id: true },
      }),

      // Recent activities (last 10)
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

      // Overdue tasks
      prisma.task.count({
        where: {
          deletedAt: null,
          status: { not: 'completed' },
          dueDate: { lt: now },
        },
      }),

      // Upcoming events (next 7 days)
      prisma.calendarEvent.count({
        where: {
          deletedAt: null,
          startDate: { gte: now, lte: sevenDaysFromNow },
        },
      }),

      // Quotes this month
      prisma.quote.aggregate({
        where: {
          createdAt: { gte: startOfMonth },
        },
        _count: { id: true },
        _sum: { monthlyTotal: true },
      }),

      // Unread notifications for current user
      prisma.notification.count({
        where: { userId: session.user.id, read: false },
      }),

      // Pipeline value (deals with value, not closed)
      prisma.deal.groupBy({
        by: ['stage'],
        where: {
          deletedAt: null,
          stage: { notIn: ['closed_won', 'closed_lost'] },
        },
        _sum: { value: true },
        _count: { id: true },
      }),
    ]);

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('Dashboard KPI error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
