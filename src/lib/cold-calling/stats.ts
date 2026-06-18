/**
 * Cold Calling — stats (v2).
 *
 * Fixes from the redesign:
 *  - queueDepth is derived from `callStatus` using the SAME predicate as the
 *    queue, so the badges can never disagree with the lists.
 *  - VA and admin stats share ONE shape (both include queueDepth; the queue is
 *    global, so the depth is the same — only the per-call tallies are scoped).
 *  - "today / week / month" boundaries are computed in Europe/London, not the
 *    server's local timezone.
 */

import { prisma } from '@/lib/db';
import type { ColdCallingStats } from './types';

type Range = 'today' | 'week' | 'month';

/** Start of the given range in Europe/London, returned as a UTC instant. */
function ukRangeStart(range: Range, now = new Date()): Date {
  // Wall-clock UK time expressed in the server's local fields, plus the offset
  // back to a real UTC instant. Works regardless of the server timezone.
  const ukLocal = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
  const offsetMs = now.getTime() - ukLocal.getTime();
  const start = new Date(ukLocal.getFullYear(), ukLocal.getMonth(), ukLocal.getDate());
  if (range === 'week') {
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day; // back to Monday
    start.setDate(start.getDate() + diff);
  } else if (range === 'month') {
    start.setDate(1);
  }
  return new Date(start.getTime() + offsetMs);
}

const CALLABLE = ['new', 'retry', 'callback', 'nurturing', 'renewal', 'dormant'];

/** Count of due leads in the given callStatuses — identical predicate to the queue. */
async function dueCount(statuses: string[]): Promise<number> {
  return prisma.lead.count({
    where: {
      deletedAt: null,
      phone: { not: null },
      callStatus: { in: statuses as never[] },
      OR: [{ nextCallAt: null }, { nextCallAt: { lte: new Date() } }],
    },
  });
}

async function queueDepth(): Promise<ColdCallingStats['queueDepth']> {
  const [callbacks, fresh, followUps, recycle, dormant] = await Promise.all([
    dueCount(['callback']),
    dueCount(['new']),
    dueCount(['nurturing', 'renewal']),
    dueCount(['retry']),
    dueCount(['dormant']),
  ]);
  return { callbacks, fresh, followUps, recycle, dormant };
}

/** Per-call tallies, optionally scoped to one user. */
async function tallies(range: Range, userId?: string) {
  const since = ukRangeStart(range);
  const scope = userId ? { userId } : {};
  const [callsMade, dm, callbacks, siteVisits, renewals, outcomesRaw, callsToday, callsWeek, openCallbacks] =
    await Promise.all([
      prisma.coldCallAttempt.count({ where: { ...scope, createdAt: { gte: since } } }),
      prisma.coldCallAttempt.count({ where: { ...scope, outcome: 'decision_maker_spoke', createdAt: { gte: since } } }),
      prisma.coldCallAttempt.count({ where: { ...scope, outcome: 'callback_booked', createdAt: { gte: since } } }),
      prisma.coldCallAttempt.count({ where: { ...scope, outcome: 'site_visit_booked', createdAt: { gte: since } } }),
      prisma.coldCallAttempt.count({ where: { ...scope, outcome: 'contract_renewal_date', createdAt: { gte: since } } }),
      userId
        ? prisma.$queryRaw<Array<{ outcome: string | null; count: bigint }>>`
            SELECT outcome::text, COUNT(*)::bigint as count FROM cold_call_attempts
            WHERE "createdAt" >= ${since} AND "userId" = ${userId} GROUP BY outcome`
        : prisma.$queryRaw<Array<{ outcome: string | null; count: bigint }>>`
            SELECT outcome::text, COUNT(*)::bigint as count FROM cold_call_attempts
            WHERE "createdAt" >= ${since} GROUP BY outcome`,
      prisma.coldCallAttempt.count({ where: { ...scope, createdAt: { gte: ukRangeStart('today') } } }),
      prisma.coldCallAttempt.count({ where: { ...scope, createdAt: { gte: ukRangeStart('week') } } }),
      dueCount(['callback']),
    ]);

  const outcomes: Record<string, number> = {};
  for (const row of outcomesRaw) outcomes[row.outcome || 'unknown'] = Number(row.count);

  return {
    callsMade,
    decisionMakerConversations: dm,
    callbacksBooked: callbacks,
    siteVisitsBooked: siteVisits,
    contractRenewalOpportunities: renewals,
    outcomes,
    callsToday,
    callsWeek,
    openCallbacks,
  };
}

/** Admin (global) stats — uniform shape including queueDepth. */
export async function getColdCallingStats(range: Range = 'week'): Promise<ColdCallingStats> {
  const [t, depth] = await Promise.all([tallies(range), queueDepth()]);
  return { ...t, queueDepth: depth };
}

/** VA stats — SAME shape (per-call tallies scoped to the VA; global queue depth). */
export async function getVaStats(userId: string, range: Range = 'week'): Promise<ColdCallingStats> {
  const [t, depth] = await Promise.all([tallies(range, userId), queueDepth()]);
  return { ...t, queueDepth: depth };
}
