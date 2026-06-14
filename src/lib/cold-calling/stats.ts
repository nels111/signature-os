/**
 * Cold Calling — stats queries
 */

import { prisma } from '@/lib/db';
import type { ColdCallingStats } from './types';

type Range = 'today' | 'week' | 'month';

function getRangeStart(range: Range): Date {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'today') return start;
  if (range === 'week') {
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday
    start.setDate(start.getDate() + diff);
    return start;
  }
  // month
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function getColdCallingStats(range: Range = 'week'): Promise<ColdCallingStats> {
  const since = getRangeStart(range);

  const [
    callsMade,
    dmConversations,
    callbacksBooked,
    siteVisitsBooked,
    renewalOpps,
    outcomesRaw,
    callbackCount,
    freshCount,
    followUpCount,
    recycleCount,
    dormantCount,
    callsToday,
    callsWeek,
  ] = await Promise.all([
    // Total calls
    prisma.coldCallAttempt.count({
      where: { createdAt: { gte: since } },
    }),

    // Decision maker conversations
    prisma.coldCallAttempt.count({
      where: { outcome: 'decision_maker_spoke', createdAt: { gte: since } },
    }),

    // Callbacks booked
    prisma.coldCallAttempt.count({
      where: { outcome: 'callback_booked', createdAt: { gte: since } },
    }),

    // Site visits booked
    prisma.coldCallAttempt.count({
      where: { outcome: 'site_visit_booked', createdAt: { gte: since } },
    }),

    // Contract renewal dates captured
    prisma.coldCallAttempt.count({
      where: { outcome: 'contract_renewal_date', createdAt: { gte: since } },
    }),

    // Outcome breakdown
    prisma.$queryRaw<Array<{ outcome: string | null; count: bigint }>>`
      SELECT outcome::text, COUNT(*)::bigint as count
      FROM cold_call_attempts
      WHERE "createdAt" >= ${since}
      GROUP BY outcome
    `,

    // Queue depth: callbacks
    prisma.task.count({
      where: {
        taskType: 'callback',
        status: { in: ['not_started', 'in_progress', 'waiting'] },
        deletedAt: null,
        linkedLead: { isCallable: true, deletedAt: null },
      },
    }),

    // Queue depth: fresh
    prisma.lead.count({
      where: {
        isCallable: true,
        stage: { in: ['new_lead', 'cold_call'] as never[] },
        firstCalledAt: null,
        phone: { not: null },
        deletedAt: null,
      },
    }),

    // Queue depth: follow-ups
    prisma.task.count({
      where: {
        taskType: { in: ['follow_up_call', 'contract_renewal_follow_up'] as never[] },
        status: { in: ['not_started', 'in_progress', 'waiting'] },
        deletedAt: null,
        linkedLead: {
          isCallable: true,
          stage: { in: ['follow_up_sequence', 'contact_when_contract_up'] as never[] },
          deletedAt: null,
        },
      },
    }),

    // Queue depth: recycle
    prisma.lead.count({
      where: {
        isCallable: true,
        stage: 'cold_call',
        firstCalledAt: { not: null },
        nextCallAt: { lte: new Date() },
        deletedAt: null,
      },
    }),

    // Dormant
    prisma.lead.count({
      where: { stage: 'dormant', deletedAt: null },
    }),

    // Calls today / this week (range-independent header stats)
    prisma.coldCallAttempt.count({ where: { createdAt: { gte: getRangeStart('today') } } }),
    prisma.coldCallAttempt.count({ where: { createdAt: { gte: getRangeStart('week') } } }),
  ]);

  const outcomes: Record<string, number> = {};
  for (const row of outcomesRaw) {
    outcomes[row.outcome || 'unknown'] = Number(row.count);
  }

  return {
    callsMade,
    decisionMakerConversations: dmConversations,
    callbacksBooked,
    siteVisitsBooked,
    contractRenewalOpportunities: renewalOpps,
    outcomes,
    callsToday,
    callsWeek,
    openCallbacks: callbackCount,
    queueDepth: {
      callbacks: callbackCount,
      fresh: freshCount,
      followUps: followUpCount,
      recycle: recycleCount,
      dormant: dormantCount,
    },
  };
}

// VA-scoped stats (only their own calls)
export async function getVaStats(userId: string, range: Range = 'week'): Promise<Omit<ColdCallingStats, 'queueDepth'>> {
  const since = getRangeStart(range);

  const [callsMade, dmConversations, callbacksBooked, siteVisitsBooked, renewalOpps, outcomesRaw, callsToday, callsWeek, openCallbacks] = await Promise.all([
    prisma.coldCallAttempt.count({ where: { userId, createdAt: { gte: since } } }),
    prisma.coldCallAttempt.count({ where: { userId, outcome: 'decision_maker_spoke', createdAt: { gte: since } } }),
    prisma.coldCallAttempt.count({ where: { userId, outcome: 'callback_booked', createdAt: { gte: since } } }),
    prisma.coldCallAttempt.count({ where: { userId, outcome: 'site_visit_booked', createdAt: { gte: since } } }),
    prisma.coldCallAttempt.count({ where: { userId, outcome: 'contract_renewal_date', createdAt: { gte: since } } }),
    prisma.$queryRaw<Array<{ outcome: string | null; count: bigint }>>`
      SELECT outcome::text, COUNT(*)::bigint as count
      FROM cold_call_attempts
      WHERE "createdAt" >= ${since} AND "userId" = ${userId}
      GROUP BY outcome
    `,
    prisma.coldCallAttempt.count({ where: { userId, createdAt: { gte: getRangeStart('today') } } }),
    prisma.coldCallAttempt.count({ where: { userId, createdAt: { gte: getRangeStart('week') } } }),
    prisma.task.count({ where: { taskType: 'callback', status: { in: ['not_started', 'in_progress', 'waiting'] }, deletedAt: null } }),
  ]);

  const outcomes: Record<string, number> = {};
  for (const row of outcomesRaw) {
    outcomes[row.outcome || 'unknown'] = Number(row.count);
  }

  return { callsMade, decisionMakerConversations: dmConversations, callbacksBooked, siteVisitsBooked, contractRenewalOpportunities: renewalOpps, outcomes, callsToday, callsWeek, openCallbacks };
}
