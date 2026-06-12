/**
 * Cold Calling — queue logic
 * Strict priority order: callbacks → fresh → follow-ups → recycle
 * Uses actual DB dates/stages, not just queueType enum, to prevent stale queue bugs.
 */

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
    website: null, // not on Lead model
    stage: raw.stage as string,
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
    select: {
      id: true,
      outcome: true,
      durationSeconds: true,
      notes: true,
      createdAt: true,
      user: { select: { name: true } },
    },
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

// ── 1. Callbacks — due tasks of type callback ────────────────────────────────

async function getCallbackLeads(limit: number): Promise<ColdCallingLead[]> {
  const now = new Date();
  const tasks = await prisma.task.findMany({
    where: {
      taskType: 'callback',
      status: { in: ['not_started', 'in_progress', 'waiting'] },
      dueDate: { lte: now },
      deletedAt: null,
      linkedLead: { isCallable: true, deletedAt: null },
    },
    include: {
      linkedLead: { select: LEAD_SELECT },
    },
    orderBy: { dueDate: 'asc' },
    take: limit,
  });

  const seen = new Set<string>();
  const leads: ColdCallingLead[] = [];
  for (const t of tasks) {
    if (!t.linkedLead || seen.has(t.linkedLead.id)) continue;
    seen.add(t.linkedLead.id);
    const attempts = await getRecentAttempts(t.linkedLead.id);
    leads.push(serializeLead(t.linkedLead as Record<string, unknown>, attempts));
  }
  return leads;
}

// ── 2. Fresh leads — never called, have a phone ──────────────────────────────

async function getFreshLeads(limit: number): Promise<ColdCallingLead[]> {
  const raw = await prisma.lead.findMany({
    where: {
      isCallable: true,
      stage: { in: ['new_lead', 'cold_call'] as never[] },
      firstCalledAt: null,
      phone: { not: null },
      deletedAt: null,
    },
    select: LEAD_SELECT,
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  const leads: ColdCallingLead[] = [];
  for (const r of raw) {
    leads.push(serializeLead(r as Record<string, unknown>));
  }
  return leads;
}

// ── 3. Follow-ups — due follow-up/renewal tasks ──────────────────────────────

async function getFollowUpLeads(limit: number): Promise<ColdCallingLead[]> {
  const now = new Date();
  const tasks = await prisma.task.findMany({
    where: {
      taskType: { in: ['follow_up_call', 'contract_renewal_follow_up'] as never[] },
      status: { in: ['not_started', 'in_progress', 'waiting'] },
      dueDate: { lte: now },
      deletedAt: null,
      linkedLead: {
        isCallable: true,
        stage: { in: ['follow_up_sequence', 'contact_when_contract_up'] as never[] },
        deletedAt: null,
      },
    },
    include: {
      linkedLead: { select: LEAD_SELECT },
    },
    orderBy: { dueDate: 'asc' },
    take: limit,
  });

  const seen = new Set<string>();
  const leads: ColdCallingLead[] = [];
  for (const t of tasks) {
    if (!t.linkedLead || seen.has(t.linkedLead.id)) continue;
    seen.add(t.linkedLead.id);
    const attempts = await getRecentAttempts(t.linkedLead.id);
    leads.push(serializeLead(t.linkedLead as Record<string, unknown>, attempts));
  }
  return leads;
}

// ── 4. Recycle leads — called before, nextCallAt due ────────────────────────

async function getRecycleLeads(limit: number): Promise<ColdCallingLead[]> {
  const now = new Date();
  const raw = await prisma.lead.findMany({
    where: {
      isCallable: true,
      stage: { in: ['cold_call', 'not_interested_for_now'] as never[] },
      firstCalledAt: { not: null },
      nextCallAt: { lte: now },
      deletedAt: null,
    },
    select: LEAD_SELECT,
    orderBy: [{ nextCallAt: 'asc' }, { createdAt: 'asc' }],
    take: limit,
  });

  const leads: ColdCallingLead[] = [];
  for (const r of raw) {
    const attempts = await getRecentAttempts(r.id);
    leads.push(serializeLead(r as Record<string, unknown>, attempts));
  }
  return leads;
}

// ── Dormant count ────────────────────────────────────────────────────────────

async function getDormantCount(): Promise<number> {
  return prisma.lead.count({
    where: { stage: 'dormant', deletedAt: null },
  });
}

// ── True counts (independent of paginated lists) ──────────────────────────────

async function getTrueCounts(): Promise<{ callbacks: number; fresh: number; followUps: number; recycle: number }> {
  const now = new Date();
  const [callbacks, fresh, followUps, recycle] = await Promise.all([
    // Callback tasks due now
    prisma.task.count({
      where: {
        taskType: 'callback',
        status: { in: ['not_started', 'in_progress', 'waiting'] },
        dueDate: { lte: now },
        deletedAt: null,
        linkedLead: { isCallable: true, deletedAt: null },
      },
    }),
    // Fresh leads never called with a phone number
    prisma.lead.count({
      where: {
        isCallable: true,
        stage: { in: ['new_lead', 'cold_call'] as never[] },
        firstCalledAt: null,
        phone: { not: null },
        deletedAt: null,
      },
    }),
    // Follow-up / renewal tasks due now
    prisma.task.count({
      where: {
        taskType: { in: ['follow_up_call', 'contract_renewal_follow_up'] as never[] },
        status: { in: ['not_started', 'in_progress', 'waiting'] },
        dueDate: { lte: now },
        deletedAt: null,
        linkedLead: {
          isCallable: true,
          stage: { in: ['follow_up_sequence', 'contact_when_contract_up'] as never[] },
          deletedAt: null,
        },
      },
    }),
    // Recycle leads with nextCallAt due
    prisma.lead.count({
      where: {
        isCallable: true,
        stage: 'cold_call',
        firstCalledAt: { not: null },
        nextCallAt: { lte: now },
        deletedAt: null,
      },
    }),
  ]);
  return { callbacks, fresh, followUps, recycle };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getQueue(limit = 25): Promise<QueueResponse> {
  const [callbacks, fresh, followUps, recycle, dormantCount, trueCounts] = await Promise.all([
    getCallbackLeads(limit),
    getFreshLeads(limit),
    getFollowUpLeads(limit),
    getRecycleLeads(limit),
    getDormantCount(),
    getTrueCounts(),
  ]);

  const activeLead =
    callbacks[0] ?? fresh[0] ?? followUps[0] ?? recycle[0] ?? null;

  return {
    activeLead,
    queues: { callbacks, fresh, followUps, recycle },
    counts: {
      callbacks: trueCounts.callbacks,
      fresh: trueCounts.fresh,
      followUps: trueCounts.followUps,
      recycle: trueCounts.recycle,
      dormant: dormantCount,
    },
  };
}

export async function getNextLead(): Promise<{ lead: ColdCallingLead | null; queueType: string | null }> {
  const [callbacks, fresh, followUps, recycle] = await Promise.all([
    getCallbackLeads(1),
    getFreshLeads(1),
    getFollowUpLeads(1),
    getRecycleLeads(1),
  ]);

  if (callbacks[0]) return { lead: callbacks[0], queueType: 'callback' };
  if (fresh[0]) return { lead: fresh[0], queueType: 'fresh' };
  if (followUps[0]) return { lead: followUps[0], queueType: 'follow_up' };
  if (recycle[0]) return { lead: recycle[0], queueType: 'recycle' };
  return { lead: null, queueType: null };
}
