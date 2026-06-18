/**
 * Cold Calling — queue logic (v2).
 *
 * Single source of truth: a lead's queue is derived purely from `callStatus` +
 * `nextCallAt`. One lead has one callStatus, so it sits in exactly one queue —
 * the "lead in two queues" / "badge disagrees with list" classes are gone.
 * Counts and lists use the SAME predicate, so they can never diverge.
 *
 * The response keeps the original shape (callbacks / fresh / followUps / recycle
 * / dormant) so the existing UI keeps working:
 *   callbacks <- callStatus 'callback'
 *   fresh     <- callStatus 'new'
 *   followUps <- callStatus 'nurturing' | 'renewal'
 *   recycle   <- callStatus 'retry'
 *   dormant   <- callStatus 'dormant' (revival)
 *
 * `getNextLead` claims the top lead with `FOR UPDATE SKIP LOCKED` so two callers
 * never get the same lead.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { ColdCallingLead, QueueResponse } from './types';

const LEAD_SELECT = {
  id: true,
  companyName: true,
  contactName: true,
  email: true,
  phone: true,
  source: true,
  stage: true,
  callStatus: true,
  queueType: true,
  nextCallAt: true,
  lastCalledAt: true,
  firstCalledAt: true,
  coldCallAttempts: true,
  noAnswerAttempts: true,
  voicemailAttempts: true,
  gatekeeperAttempts: true,
  isCallable: true,
  dormantUntil: true,
  decisionMakerName: true,
  decisionMakerTitle: true,
  directNumber: true,
  bestTimeToCall: true,
  gatekeeperName: true,
  currentSupplier: true,
  contractRenewalDate: true,
  estimatedSiteSize: true,
  coldCallNotes: true,
  siteVisitAt: true,
  siteVisitAddress: true,
  siteVisitContact: true,
  notes: true,
  sector: true,
} as const;

function serializeLead(raw: Record<string, unknown>, attempts: ColdCallingLead['recentAttempts'] = []): ColdCallingLead {
  return {
    id: raw.id as string,
    companyName: raw.companyName as string,
    contactName: (raw.contactName as string | null) ?? null,
    email: (raw.email as string | null) ?? null,
    phone: (raw.phone as string | null) ?? null,
    website: null,
    stage: raw.stage as string,
    callStatus: (raw.callStatus as string | null) ?? null,
    queueType: (raw.queueType as ColdCallingLead['queueType']) ?? null,
    nextCallAt: raw.nextCallAt ? (raw.nextCallAt as Date).toISOString() : null,
    lastCalledAt: raw.lastCalledAt ? (raw.lastCalledAt as Date).toISOString() : null,
    firstCalledAt: raw.firstCalledAt ? (raw.firstCalledAt as Date).toISOString() : null,
    coldCallAttempts: (raw.coldCallAttempts as number) ?? 0,
    noAnswerAttempts: (raw.noAnswerAttempts as number) ?? 0,
    voicemailAttempts: (raw.voicemailAttempts as number) ?? 0,
    gatekeeperAttempts: (raw.gatekeeperAttempts as number) ?? 0,
    isCallable: (raw.isCallable as boolean) ?? true,
    dormantUntil: raw.dormantUntil ? (raw.dormantUntil as Date).toISOString() : null,
    decisionMakerName: (raw.decisionMakerName as string | null) ?? null,
    decisionMakerTitle: (raw.decisionMakerTitle as string | null) ?? null,
    directNumber: (raw.directNumber as string | null) ?? null,
    bestTimeToCall: (raw.bestTimeToCall as string | null) ?? null,
    gatekeeperName: (raw.gatekeeperName as string | null) ?? null,
    currentSupplier: (raw.currentSupplier as string | null) ?? null,
    contractRenewalDate: raw.contractRenewalDate ? (raw.contractRenewalDate as Date).toISOString() : null,
    estimatedSiteSize: (raw.estimatedSiteSize as string | null) ?? null,
    coldCallNotes: (raw.coldCallNotes as string | null) ?? null,
    siteVisitAt: raw.siteVisitAt ? (raw.siteVisitAt as Date).toISOString() : null,
    siteVisitAddress: (raw.siteVisitAddress as string | null) ?? null,
    siteVisitContact: (raw.siteVisitContact as string | null) ?? null,
    recentAttempts: attempts,
  };
}

async function getRecentAttempts(leadId: string, take = 5): Promise<ColdCallingLead['recentAttempts']> {
  const attempts = await prisma.coldCallAttempt.findMany({
    where: { leadId },
    orderBy: { createdAt: 'desc' },
    take,
    select: { id: true, outcome: true, durationSeconds: true, notes: true, createdAt: true, user: { select: { name: true } } },
  });
  return attempts.map((a) => ({
    id: a.id,
    outcome: a.outcome ?? null,
    durationSeconds: a.durationSeconds ?? null,
    notes: a.notes ?? null,
    createdAt: a.createdAt.toISOString(),
    userName: a.user.name,
  }));
}

/** "Due now" filter for a given set of callStatuses. */
function dueWhere(statuses: string[]): Prisma.LeadWhereInput {
  return {
    deletedAt: null,
    phone: { not: null },
    callStatus: { in: statuses as never[] },
    OR: [{ nextCallAt: null }, { nextCallAt: { lte: new Date() } }],
  };
}

async function listFor(statuses: string[], limit: number, withAttempts: boolean): Promise<ColdCallingLead[]> {
  const raw = await prisma.lead.findMany({
    where: dueWhere(statuses),
    select: LEAD_SELECT,
    orderBy: [{ nextCallAt: 'asc' }, { createdAt: 'asc' }],
    take: limit,
  });
  const leads: ColdCallingLead[] = [];
  for (const r of raw) {
    const attempts = withAttempts ? await getRecentAttempts(r.id) : [];
    leads.push(serializeLead(r as Record<string, unknown>, attempts));
  }
  return leads;
}

async function countFor(statuses: string[]): Promise<number> {
  return prisma.lead.count({ where: dueWhere(statuses) });
}

export async function getQueue(limit = 25): Promise<QueueResponse> {
  const [callbacks, fresh, followUps, recycle, cbN, frN, fuN, rcN, dormN] = await Promise.all([
    listFor(['callback'], limit, true),
    listFor(['new'], limit, false),
    listFor(['nurturing', 'renewal'], limit, true),
    listFor(['retry'], limit, true),
    countFor(['callback']),
    countFor(['new']),
    countFor(['nurturing', 'renewal']),
    countFor(['retry']),
    // Dormant badge: leads parked for revival (count those due to resurface).
    countFor(['dormant']),
  ]);

  const activeLead = callbacks[0] ?? followUps[0] ?? recycle[0] ?? fresh[0] ?? null;

  return {
    activeLead,
    queues: { callbacks, fresh, followUps, recycle },
    counts: { callbacks: cbN, fresh: frN, followUps: fuN, recycle: rcN, dormant: dormN },
  };
}

/**
 * The next lead to call, claimed with a row lock so concurrent callers never get
 * the same lead. Priority: callback -> renewal -> retry -> nurturing -> new ->
 * dormant, then soonest due.
 */
export async function getNextLead(_userId?: string): Promise<{ lead: ColdCallingLead | null; queueType: string | null }> {
  const picked = await prisma.$queryRaw<{ id: string; callStatus: string }[]>`
    SELECT id, "callStatus"
    FROM leads
    WHERE "deletedAt" IS NULL AND phone IS NOT NULL
      AND "callStatus" IN ('new','retry','callback','nurturing','renewal','dormant')
      AND ("nextCallAt" IS NULL OR "nextCallAt" <= now())
    ORDER BY
      CASE "callStatus"
        WHEN 'callback' THEN 0 WHEN 'renewal' THEN 1 WHEN 'retry' THEN 2
        WHEN 'nurturing' THEN 3 WHEN 'new' THEN 4 ELSE 5 END,
      "nextCallAt" NULLS FIRST
    FOR UPDATE SKIP LOCKED
    LIMIT 1`;

  if (picked.length === 0) return { lead: null, queueType: null };

  const row = await prisma.lead.findUnique({ where: { id: picked[0].id }, select: LEAD_SELECT });
  if (!row) return { lead: null, queueType: null };
  const attempts = await getRecentAttempts(row.id);
  const bucketMap: Record<string, string> = {
    callback: 'callback',
    new: 'fresh',
    nurturing: 'follow_up',
    renewal: 'follow_up',
    retry: 'recycle',
    dormant: 'recycle',
  };
  return { lead: serializeLead(row as Record<string, unknown>, attempts), queueType: bucketMap[picked[0].callStatus] ?? null };
}
