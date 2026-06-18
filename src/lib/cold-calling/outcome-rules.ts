/**
 * Cold-calling outcome engine (v2).
 *
 * The PURE `resolveOutcome` decides the transition; this module persists it:
 *  - ATOMIC idempotency: the attempt is claimed via `updateMany ... WHERE
 *    outcome IS NULL`, so a double-submit can never double-apply.
 *  - One transaction: attempt claim + lead update + `call` activity + reminder
 *    tasks. Nothing external runs inside it.
 *  - POST-COMMIT side-effects only: client emails go through the observable
 *    outbox; Nick gets a push + internal email for site visits.
 *
 * The legacy `stage` / `isCallable` / `dormantUntil` / `queueType` fields are
 * kept coherent (not read by the queue any more, but other pipeline views use
 * `stage`), while `callStatus` + `nextCallAt` are the source of truth.
 */

import { prisma } from '@/lib/db';
import { notify } from '@/lib/notifications';
import { getNextLead } from './queue';
import { enqueueAndSend, type OutboxTemplate } from './email-outbox';
import { resolveOutcome, type LeadCallStatus, type OutcomeName, type OutcomeInput as EngineInput } from './state';
import type { OutcomePayload, ColdCallingLead } from './types';

const NICK_EMAIL = 'nick@signature-cleans.co.uk';
const NELSON_EMAIL = 'nelson@signature-cleans.co.uk';

export class OutcomeValidationError extends Error {}

interface ApplyOutcomeArgs {
  leadId: string;
  attemptId: string;
  userId: string;
  payload: OutcomePayload;
}

interface ApplyOutcomeResult {
  idempotent: boolean;
  lead: { id: string; stage: string; callStatus: LeadCallStatus; nextCallAt: string | null };
  createdTasks: { id: string; subject: string; taskType: string; dueDate: string }[];
  nextLead: ColdCallingLead | null;
}

/** Map the API payload (9 outcomes + sub-fields) to the engine's outcome name. */
function toEngineOutcome(payload: OutcomePayload): { outcome: OutcomeName; wantsInfo: boolean } {
  if (payload.outcome === 'not_interested') {
    return {
      outcome: payload.notInterestedReason === 'happy_with_supplier' ? 'not_interested_for_now' : 'not_interested',
      wantsInfo: false,
    };
  }
  if (payload.outcome === 'decision_maker_spoke') {
    return { outcome: 'decision_maker_spoke', wantsInfo: payload.decisionMakerSubOutcome === 'send_info' };
  }
  return { outcome: payload.outcome as OutcomeName, wantsInfo: false };
}

/** Keep the legacy pipeline `stage` coherent with the new callStatus. */
function stageFor(callStatus: LeadCallStatus, engineOutcome: OutcomeName): string {
  switch (callStatus) {
    case 'retry':
      return 'cold_call';
    case 'callback':
      return 'cold_call';
    case 'nurturing':
      return 'follow_up_sequence';
    case 'renewal':
      return 'contact_when_contract_up';
    case 'booked':
      return 'meeting_scheduled';
    case 'dormant':
      return engineOutcome === 'not_interested_for_now' ? 'not_interested_for_now' : 'dormant';
    case 'dead':
      return engineOutcome === 'bad_data' ? 'bad_data' : 'archived';
    default:
      return 'cold_call';
  }
}

const TERMINAL: LeadCallStatus[] = ['booked', 'dead'];

export async function applyColdCallOutcome({
  leadId,
  attemptId,
  userId,
  payload,
}: ApplyOutcomeArgs): Promise<ApplyOutcomeResult> {
  const now = new Date();

  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    select: {
      id: true,
      companyName: true,
      contactName: true,
      email: true,
      phone: true,
      callStatus: true,
      noAnswerAttempts: true,
      voicemailAttempts: true,
      gatekeeperAttempts: true,
      coldCallAttempts: true,
      firstCalledAt: true,
    },
  });

  const { outcome, wantsInfo } = toEngineOutcome(payload);

  const engineInput: EngineInput = {
    outcome,
    now,
    callbackAt: payload.callbackAt ? new Date(payload.callbackAt) : null,
    siteVisitAt: payload.siteVisitAt ? new Date(payload.siteVisitAt) : null,
    renewalDate: payload.contractRenewalDate ? new Date(payload.contractRenewalDate) : null,
    decisionMakerWantsInfo: wantsInfo,
  };

  const decision = resolveOutcome(
    {
      callStatus: lead.callStatus,
      noAnswerAttempts: lead.noAnswerAttempts,
      voicemailAttempts: lead.voicemailAttempts,
      gatekeeperAttempts: lead.gatekeeperAttempts,
      coldCallAttempts: lead.coldCallAttempts,
      hasEmail: !!lead.email,
    },
    engineInput,
  );

  if (decision.error) {
    throw new OutcomeValidationError(decision.error);
  }

  const isTerminal = TERMINAL.includes(decision.callStatus);
  const newStage = stageFor(decision.callStatus, outcome);

  // Attempt snapshot written when we claim the attempt (idempotency guard).
  const attemptSnapshot = {
    outcome: payload.outcome,
    endedAt: now,
    status: 'completed' as const,
    notes: payload.notes ?? null,
    gatekeeperName: payload.gatekeeperName ?? null,
    decisionMakerName: payload.decisionMakerName ?? null,
    decisionMakerTitle: payload.decisionMakerTitle ?? null,
    directNumber: payload.directNumber ?? null,
    email: payload.email || null,
    bestTimeToCall: payload.bestTimeToCall ?? null,
    contractRenewalDate: payload.contractRenewalDate ? new Date(payload.contractRenewalDate) : null,
    currentSupplier: payload.currentSupplier ?? null,
    estimatedSiteSize: payload.estimatedSiteSize ?? null,
    decisionMakerSubOutcome: payload.decisionMakerSubOutcome ?? null,
    notInterestedReason: payload.notInterestedReason ?? null,
  };

  const leadUpdate: Record<string, unknown> = {
    callStatus: decision.callStatus,
    nextCallAt: decision.nextCallAt,
    noAnswerAttempts: decision.counters.noAnswerAttempts,
    voicemailAttempts: decision.counters.voicemailAttempts,
    gatekeeperAttempts: decision.counters.gatekeeperAttempts,
    coldCallAttempts: decision.counters.coldCallAttempts,
    lastCalledAt: now,
    firstCalledAt: lead.firstCalledAt ?? now,
    updatedAt: now,
    // legacy coherence
    stage: newStage,
    queueType: null,
    isCallable: !isTerminal,
    dormantUntil: decision.callStatus === 'dormant' ? decision.nextCallAt : null,
    removedFromQueueAt: isTerminal ? now : null,
    // intelligence snapshot (only set when provided)
    ...(payload.gatekeeperName ? { gatekeeperName: payload.gatekeeperName } : {}),
    ...(payload.decisionMakerName ? { decisionMakerName: payload.decisionMakerName } : {}),
    ...(payload.decisionMakerTitle ? { decisionMakerTitle: payload.decisionMakerTitle } : {}),
    ...(payload.directNumber ? { directNumber: payload.directNumber } : {}),
    ...(payload.bestTimeToCall ? { bestTimeToCall: payload.bestTimeToCall } : {}),
    ...(payload.currentSupplier ? { currentSupplier: payload.currentSupplier } : {}),
    ...(payload.estimatedSiteSize ? { estimatedSiteSize: payload.estimatedSiteSize } : {}),
    ...(payload.contractRenewalDate ? { contractRenewalDate: new Date(payload.contractRenewalDate) } : {}),
    ...(payload.siteVisitAt ? { siteVisitAt: new Date(payload.siteVisitAt) } : {}),
    ...(payload.siteVisitAddress ? { siteVisitAddress: payload.siteVisitAddress } : {}),
    ...(payload.siteVisitContact ? { siteVisitContact: payload.siteVisitContact } : {}),
  };

  // Reminder tasks (calendar visibility only; they no longer drive the queue).
  const taskInputs: Parameters<typeof prisma.task.create>[0]['data'][] = [];
  if (outcome === 'callback_booked' && decision.nextCallAt) {
    taskInputs.push({
      subject: `Callback: ${lead.companyName}`,
      ownerId: userId,
      dueDate: decision.nextCallAt,
      taskType: 'callback',
      status: 'not_started',
      linkedLeadId: leadId,
      description: payload.notes ?? undefined,
    });
  }
  if (outcome === 'decision_maker_spoke' && decision.nextCallAt) {
    taskInputs.push({
      subject: `Follow up: ${lead.companyName}`,
      ownerId: userId,
      dueDate: decision.nextCallAt,
      taskType: 'follow_up_call',
      status: 'not_started',
      linkedLeadId: leadId,
      description: payload.notes ?? undefined,
    });
  }
  if (outcome === 'contract_renewal_date' && decision.nextCallAt) {
    taskInputs.push({
      subject: `Contract renewal follow-up: ${lead.companyName}`,
      ownerId: userId,
      dueDate: decision.nextCallAt,
      taskType: 'contract_renewal_follow_up',
      status: 'not_started',
      linkedLeadId: leadId,
      description:
        [payload.currentSupplier ? `Current supplier: ${payload.currentSupplier}` : null, payload.notes ?? null]
          .filter(Boolean)
          .join('\n') || undefined,
    });
  }

  // Resolve Nick for the site-visit hand-off task (read-only, before tx).
  let nickId: string | null = null;
  if (outcome === 'site_visit_booked') {
    const nick = await prisma.user.findFirst({ where: { email: NICK_EMAIL }, select: { id: true } });
    nickId = nick?.id ?? null;
    const visitDate = engineInput.siteVisitAt ?? now;
    taskInputs.push({
      subject: `Site visit: ${lead.companyName}`,
      ownerId: nickId ?? userId,
      dueDate: visitDate,
      taskType: 'site_visit_confirmation',
      status: 'not_started',
      linkedLeadId: leadId,
      description:
        [
          payload.siteVisitAddress ? `Address: ${payload.siteVisitAddress}` : null,
          payload.siteVisitContact ? `Contact: ${payload.siteVisitContact}` : null,
          payload.notes ?? null,
        ]
          .filter(Boolean)
          .join('\n') || undefined,
    });
  }

  // ── Transaction: claim attempt (idempotent), update lead, log call, tasks ──
  const txResult = await prisma.$transaction(async (tx) => {
    // ATOMIC idempotency: only the first submit (outcome still NULL) wins.
    const claim = await tx.coldCallAttempt.updateMany({
      where: { id: attemptId, outcome: null },
      data: attemptSnapshot,
    });
    if (claim.count === 0) {
      return { idempotent: true as const, createdTasks: [] as ApplyOutcomeResult['createdTasks'] };
    }

    await tx.lead.update({ where: { id: leadId }, data: leadUpdate });

    await tx.activity.create({
      data: {
        activityType: 'call',
        description: buildActivityDescription(payload),
        userId,
        entityType: 'lead',
        entityId: leadId,
        metadata: { outcome: payload.outcome, callStatus: decision.callStatus, attemptId },
      },
    });

    const createdTasks: ApplyOutcomeResult['createdTasks'] = [];
    for (const input of taskInputs) {
      const t = await tx.task.create({
        data: input,
        select: { id: true, subject: true, taskType: true, dueDate: true },
      });
      createdTasks.push({ id: t.id, subject: t.subject, taskType: t.taskType, dueDate: t.dueDate.toISOString() });
    }

    return { idempotent: false as const, createdTasks };
  });

  // Idempotent replay: do not re-run side effects.
  if (txResult.idempotent) {
    const { lead: nextLead } = await getNextLead(userId);
    return {
      idempotent: true,
      lead: { id: leadId, stage: newStage, callStatus: lead.callStatus ?? decision.callStatus, nextCallAt: null },
      createdTasks: [],
      nextLead,
    };
  }

  // ── POST-COMMIT side effects ──
  // 1. Client email through the observable outbox.
  if (decision.email && lead.email) {
    void enqueueAndSend({
      leadId,
      template: decision.email as OutboxTemplate,
      to: lead.email,
      actingUserId: userId,
    }).catch(() => {
      /* outbox records its own failure; never throw here */
    });
  }

  // 2. Site visit: notify Nick (push + bell) and email him the hand-off.
  if (outcome === 'site_visit_booked') {
    const visitDate = engineInput.siteVisitAt ?? now;
    const visitFormatted = visitDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    void notifyNick(
      'Site visit booked',
      `Site visit booked at ${lead.companyName}${payload.siteVisitAddress ? ` (${payload.siteVisitAddress})` : ''} on ${visitFormatted}`,
      leadId,
    ).catch(() => {});
    void sendNickSiteVisitEmail(lead.companyName, visitFormatted, payload.siteVisitAddress, payload.siteVisitContact).catch(
      () => {},
    );
  }

  const { lead: nextLead } = await getNextLead(userId);

  return {
    idempotent: false,
    lead: {
      id: leadId,
      stage: newStage,
      callStatus: decision.callStatus,
      nextCallAt: decision.nextCallAt?.toISOString() ?? null,
    },
    createdTasks: txResult.createdTasks,
    nextLead,
  };
}

async function notifyNick(title: string, message: string, entityId?: string) {
  const nick = await prisma.user.findFirst({ where: { email: NICK_EMAIL }, select: { id: true } });
  if (!nick) return;
  await notify({
    userId: nick.id,
    type: 'site_visit_booked',
    title,
    message,
    entityType: entityId ? 'lead' : null,
    entityId: entityId ?? null,
    dedupWindowHours: 0,
  });
}

async function sendNickSiteVisitEmail(company: string, visitFormatted: string, address?: string, contact?: string) {
  const { sendEmail, getSmtpConfig } = await import('@/lib/smtp');
  const pass = process.env.HELLO_MAILBOX_PASSWORD;
  if (!pass) return;
  const config = getSmtpConfig('hello@signature-cleans.co.uk', pass);
  await sendEmail(config, {
    from: 'Sam (Signature Cleans) <hello@signature-cleans.co.uk>',
    replyTo: NELSON_EMAIL,
    to: NICK_EMAIL,
    subject: `Site visit booked — ${company}`,
    text: `Hi Nick,\n\nA site visit has been booked.\n\nCompany: ${company}\nDate: ${visitFormatted}${address ? `\nAddress: ${address}` : ''}${contact ? `\nContact: ${contact}` : ''}\n\nA task has been created for you in SigOS.\n\nMany Thanks,\nSam`,
    html: `<p>Hi Nick,</p><p>A site visit has been booked.</p><ul><li><strong>Company:</strong> ${company}</li><li><strong>Date:</strong> ${visitFormatted}</li>${address ? `<li><strong>Address:</strong> ${address}</li>` : ''}${contact ? `<li><strong>Contact:</strong> ${contact}</li>` : ''}</ul><p>A task has been created for you in SigOS.</p><p>Many Thanks,<br>Sam</p>`,
  });
}

function buildActivityDescription(payload: OutcomePayload): string {
  const outcomeLabels: Record<string, string> = {
    no_answer: 'No answer',
    voicemail_left: 'Left voicemail',
    gatekeeper: 'Spoke to gatekeeper',
    callback_booked: 'Callback booked',
    decision_maker_spoke: 'Spoke to decision maker',
    site_visit_booked: 'Site visit booked',
    contract_renewal_date: 'Contract renewal date captured',
    not_interested: 'Not interested',
    bad_data: 'Bad data — removed from queue',
  };
  const parts = [outcomeLabels[payload.outcome] ?? payload.outcome];
  if (payload.decisionMakerSubOutcome) {
    const subLabels: Record<string, string> = {
      send_info: 'sending info',
      follow_up_1_week: 'follow up in 1 week',
      follow_up_1_month: 'follow up in 1 month',
    };
    parts.push(subLabels[payload.decisionMakerSubOutcome] ?? payload.decisionMakerSubOutcome);
  }
  if (payload.notes?.trim()) parts.push(payload.notes.trim());
  return parts.join(' — ');
}
