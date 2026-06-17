/**
 * Cold Calling — outcome automation rules
 * Runs inside a Prisma transaction.
 * All 9 outcomes handled with automated stage transitions, task creation, and notifications.
 */

import { prisma } from '@/lib/db';
import { notify } from '@/lib/notifications';
import { getNextLead } from './queue';
import {
  sendGatekeeperEmail,
  sendCallbackEmail,
  sendInfoEmail,
  sendSiteVisitEmail,
} from './send-emails';
import type { OutcomePayload, ColdCallingLead } from './types';

const NICK_EMAIL = 'nick@signature-cleans.co.uk';
const NELSON_EMAIL = 'nelson@signature-cleans.co.uk';

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Nick push notification helper ────────────────────────────────────────────

async function notifyNick(title: string, message: string, entityId?: string) {
  // Find Nick's user record
  const nick = await prisma.user.findFirst({
    where: { email: NICK_EMAIL },
    select: { id: true },
  });
  if (!nick) return;

  // notify() writes the in-app bell entry AND sends the matching deep-linked
  // push in one path, so the bell and the iOS/web banner always correspond.
  // Dedup disabled to preserve the prior always-fire behaviour for these
  // outcome alerts.
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

// ── Main engine ──────────────────────────────────────────────────────────────

interface ApplyOutcomeArgs {
  leadId: string;
  attemptId: string;
  userId: string;
  payload: OutcomePayload;
}

interface ApplyOutcomeResult {
  lead: {
    id: string;
    stage: string;
    queueType: string | null;
    nextCallAt: string | null;
  };
  createdTasks: { id: string; subject: string; taskType: string; dueDate: string }[];
  nextLead: ColdCallingLead | null;
}

export async function applyColdCallOutcome({
  leadId,
  attemptId,
  userId,
  payload,
}: ApplyOutcomeArgs): Promise<ApplyOutcomeResult> {
  const now = new Date();

  // Load current lead state
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    select: {
      id: true,
      companyName: true,
      contactName: true,
      email: true,
      phone: true,
      noAnswerAttempts: true,
      voicemailAttempts: true,
      gatekeeperAttempts: true,
      coldCallAttempts: true,
      firstCalledAt: true,
    },
  });

  const firstName = lead.contactName?.trim().split(' ')[0] ?? 'there';

  // ── Task inputs collected during switch (created atomically in transaction) ─
  type TaskInput = Parameters<typeof prisma.task.create>[0]['data'];
  const taskInputs: TaskInput[] = [];

  // ── Extra activity for email_sent (DM spoke + send_info) ──────────────────
  let emailActivityInput: Parameters<typeof prisma.activity.create>[0]['data'] | null = null;

  // ── Side effects (emails, notifications) fired AFTER transaction commits ───
  // Collected as closures so they only run if transaction succeeds.
  const sideEffects: Array<() => void> = [];

  // ── Shared attempt snapshot update ────────────────────────────────────────
  const attemptUpdateData: Record<string, unknown> = {
    outcome: payload.outcome,
    endedAt: now,
    notes: payload.notes ?? null,
    gatekeeperName: payload.gatekeeperName ?? null,
    decisionMakerName: payload.decisionMakerName ?? null,
    decisionMakerTitle: payload.decisionMakerTitle ?? null,
    directNumber: payload.directNumber ?? null,
    email: payload.email ?? null,
    bestTimeToCall: payload.bestTimeToCall ?? null,
    contractRenewalDate: payload.contractRenewalDate ? new Date(payload.contractRenewalDate) : null,
    currentSupplier: payload.currentSupplier ?? null,
    estimatedSiteSize: payload.estimatedSiteSize ?? null,
    decisionMakerSubOutcome: payload.decisionMakerSubOutcome ?? null,
    notInterestedReason: payload.notInterestedReason ?? null,
    status: 'completed',
  };

  // ── Lead update data (built per outcome) ──────────────────────────────────
  let leadUpdate: Record<string, unknown> = {
    lastCalledAt: now,
    firstCalledAt: lead.firstCalledAt ?? now,
    updatedAt: now,
  };

  // ── Outcome rules ─────────────────────────────────────────────────────────

  switch (payload.outcome) {
    case 'no_answer': {
      const attempts = lead.noAnswerAttempts + 1;
      leadUpdate = {
        ...leadUpdate,
        noAnswerAttempts: attempts,
        coldCallAttempts: lead.coldCallAttempts + 1,
        stage: attempts >= 5 ? 'dormant' : 'cold_call',
        queueType: attempts >= 5 ? 'dormant' : 'recycle',
        dormantUntil: attempts >= 5 ? addDays(now, 90) : null,
        nextCallAt: attempts >= 5
          ? addDays(now, 90)
          : addDays(now, [2, 5, 10, 21][Math.min(attempts - 1, 3)]),
        isCallable: true,
      };
      break;
    }

    case 'voicemail_left': {
      const attempts = lead.voicemailAttempts + 1;
      leadUpdate = {
        ...leadUpdate,
        voicemailAttempts: attempts,
        coldCallAttempts: lead.coldCallAttempts + 1,
        stage: attempts >= 3 ? 'dormant' : 'cold_call',
        queueType: attempts >= 3 ? 'dormant' : 'recycle',
        dormantUntil: attempts >= 3 ? addDays(now, 90) : null,
        nextCallAt: attempts >= 3
          ? addDays(now, 90)
          : addDays(now, randomBetween(3, 5)),
        isCallable: true,
      };
      break;
    }

    case 'gatekeeper': {
      const attempts = lead.gatekeeperAttempts + 1;
      leadUpdate = {
        ...leadUpdate,
        gatekeeperAttempts: attempts,
        coldCallAttempts: lead.coldCallAttempts + 1,
        gatekeeperName: payload.gatekeeperName ?? undefined,
        decisionMakerName: payload.decisionMakerName ?? undefined,
        directNumber: payload.directNumber ?? undefined,
        bestTimeToCall: payload.bestTimeToCall ?? undefined,
        stage: attempts >= 6 ? 'dormant' : 'cold_call',
        queueType: attempts >= 6 ? 'dormant' : 'recycle',
        dormantUntil: attempts >= 6 ? addDays(now, 90) : null,
        nextCallAt: attempts >= 6 ? addDays(now, 90) : addDays(now, 3),
        isCallable: true,
      };
      // Send gatekeeper email if lead has email
      if (lead.email) {
        sendGatekeeperEmail({
          to: lead.email,
          firstName,
          company: lead.companyName,
        }).catch(console.error);
      }
      break;
    }

    case 'callback_booked': {
      if (!payload.callbackAt) throw new Error('callbackAt is required for callback_booked');
      const callbackDate = new Date(payload.callbackAt);
      leadUpdate = {
        ...leadUpdate,
        stage: 'cold_call',
        queueType: 'callback',
        nextCallAt: callbackDate,
        isCallable: true,
      };
      taskInputs.push({
        subject: `Callback: ${lead.companyName}`,
        ownerId: userId,
        dueDate: callbackDate,
        taskType: 'callback',
        status: 'not_started',
        linkedLeadId: leadId,
        description: payload.notes ?? undefined,
      });
      if (lead.email) {
        const _email = lead.email;
        const _callbackAt = payload.callbackAt;
        sideEffects.push(() => sendCallbackEmail({ to: _email, firstName, callbackAt: _callbackAt }).catch(console.error));
      }
      break;
    }

    case 'decision_maker_spoke': {
      const subOutcome = payload.decisionMakerSubOutcome ?? 'follow_up_1_week';
      const followUpDays = subOutcome === 'follow_up_1_month' ? 30 : 7;
      const followUpDate = addDays(now, followUpDays);

      leadUpdate = {
        ...leadUpdate,
        stage: 'follow_up_sequence',
        queueType: 'follow_up',
        nextCallAt: followUpDate,
        decisionMakerName: payload.decisionMakerName ?? undefined,
        decisionMakerTitle: payload.decisionMakerTitle ?? undefined,
        directNumber: payload.directNumber ?? undefined,
        bestTimeToCall: payload.bestTimeToCall ?? undefined,
        estimatedSiteSize: payload.estimatedSiteSize ?? undefined,
        isCallable: true,
      };

      taskInputs.push({
        subject: `Follow up: ${lead.companyName}`,
        ownerId: userId,
        dueDate: followUpDate,
        taskType: 'follow_up_call',
        status: 'not_started',
        linkedLeadId: leadId,
        description: payload.notes ?? undefined,
      });

      // If send_info: fire intro email and log email activity atomically
      if (subOutcome === 'send_info' && lead.email) {
        const _email = lead.email;
        sideEffects.push(() => sendInfoEmail({ to: _email, firstName, company: lead.companyName }).catch(console.error));
        emailActivityInput = {
          activityType: 'email_sent',
          description: `Intro email sent after decision maker conversation`,
          userId,
          entityType: 'lead',
          entityId: leadId,
          metadata: {
            template: 'cold_call_intro',
            trigger: 'decision_maker_spoke_send_info',
            sentTo: lead.email,
          },
        };
      }
      break;
    }

    case 'site_visit_booked': {
      if (!payload.siteVisitAt) throw new Error('siteVisitAt is required for site_visit_booked');
      const visitDate = new Date(payload.siteVisitAt);

      leadUpdate = {
        ...leadUpdate,
        stage: 'meeting_scheduled',
        queueType: null,
        isCallable: false,
        siteVisitAt: visitDate,
        siteVisitAddress: payload.siteVisitAddress ?? undefined,
        siteVisitContact: payload.siteVisitContact ?? undefined,
      };

      // Resolve Nick's userId for task assignment (outside tx — read-only lookup)
      const nick = await prisma.user.findFirst({ where: { email: NICK_EMAIL }, select: { id: true } });

      taskInputs.push({
        subject: `Site visit: ${lead.companyName}`,
        ownerId: nick?.id ?? userId,
        dueDate: visitDate,
        taskType: 'site_visit_confirmation',
        status: 'not_started',
        linkedLeadId: leadId,
        description: [
          payload.siteVisitAddress ? `Address: ${payload.siteVisitAddress}` : null,
          payload.siteVisitContact ? `Contact: ${payload.siteVisitContact}` : null,
          payload.notes ?? null,
        ].filter(Boolean).join('\n') || undefined,
      });

      // Side effects: email lead, notify Nick, email Nick
      const visitFormatted = visitDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      if (lead.email) {
        const _email = lead.email;
        const _siteVisitAt = payload.siteVisitAt;
        sideEffects.push(() => sendSiteVisitEmail({
          to: _email, firstName, company: lead.companyName,
          siteVisitAt: _siteVisitAt, siteVisitAddress: payload.siteVisitAddress,
        }).catch(console.error));
      }
      const notifyMsg = `Site visit booked at ${lead.companyName}${payload.siteVisitAddress ? ` (${payload.siteVisitAddress})` : ''} on ${visitFormatted}`;
      sideEffects.push(() => notifyNick('Site visit booked', notifyMsg, leadId).catch(console.error));
      if (nick) {
        sideEffects.push(async () => {
          try {
            const { sendEmail, getSmtpConfig } = await import('@/lib/smtp');
            const pass = process.env.HELLO_MAILBOX_PASSWORD;
            if (!pass) return;
            const config = getSmtpConfig('hello@signature-cleans.co.uk', pass);
            sendEmail(config, {
              from: 'Sam (Signature Cleans) <hello@signature-cleans.co.uk>',
              replyTo: NELSON_EMAIL,
              to: NICK_EMAIL,
              subject: `Site visit booked — ${lead.companyName}`,
              text: `Hi Nick,\n\nA site visit has been booked.\n\nCompany: ${lead.companyName}\nDate: ${visitFormatted}${payload.siteVisitAddress ? `\nAddress: ${payload.siteVisitAddress}` : ''}${payload.siteVisitContact ? `\nContact: ${payload.siteVisitContact}` : ''}\n\nA task has been created for you in SigOS.\n\nMany Thanks,\nSam`,
              html: `<p>Hi Nick,</p><p>A site visit has been booked.</p><ul><li><strong>Company:</strong> ${lead.companyName}</li><li><strong>Date:</strong> ${visitFormatted}</li>${payload.siteVisitAddress ? `<li><strong>Address:</strong> ${payload.siteVisitAddress}</li>` : ''}${payload.siteVisitContact ? `<li><strong>Contact:</strong> ${payload.siteVisitContact}</li>` : ''}</ul><p>A task has been created for you in SigOS.</p><p>Many Thanks,<br>Sam</p>`,
            }).catch(console.error);
          } catch { /* silent */ }
        });
      }
      break;
    }

    case 'contract_renewal_date': {
      if (!payload.contractRenewalDate) throw new Error('contractRenewalDate is required');
      const renewalDate = new Date(payload.contractRenewalDate);
      const followUpDate = addDays(renewalDate, -60);
      const effectiveFollowUp = followUpDate < now ? addDays(now, 7) : followUpDate;

      leadUpdate = {
        ...leadUpdate,
        stage: 'contact_when_contract_up',
        queueType: 'follow_up',
        contractRenewalDate: renewalDate,
        currentSupplier: payload.currentSupplier ?? undefined,
        nextCallAt: effectiveFollowUp,
        isCallable: true,
      };

      taskInputs.push({
        subject: `Contract renewal follow-up: ${lead.companyName}`,
        ownerId: userId,
        dueDate: effectiveFollowUp,
        taskType: 'contract_renewal_follow_up',
        status: 'not_started',
        linkedLeadId: leadId,
        description: [
          payload.currentSupplier ? `Current supplier: ${payload.currentSupplier}` : null,
          `Renewal date: ${renewalDate.toLocaleDateString('en-GB')}`,
          payload.notes ?? null,
        ].filter(Boolean).join('\n'),
      });
      break;
    }

    case 'not_interested': {
      const happy = payload.notInterestedReason === 'happy_with_supplier';
      leadUpdate = {
        ...leadUpdate,
        stage: happy ? 'not_interested_for_now' : 'archived',
        queueType: happy ? 'follow_up' : null,
        nextCallAt: happy ? addMonths(now, 6) : null,
        isCallable: happy ? true : false,   // must stay callable to return to queue in 6 months
        removedFromQueueAt: happy ? undefined : now,
      };
      break;
    }

    case 'bad_data': {
      leadUpdate = {
        ...leadUpdate,
        stage: 'bad_data',
        queueType: null,
        isCallable: false,
        removedFromQueueAt: now,
      };
      break;
    }
  }

  // ── Run atomic transaction ────────────────────────────────────────────────
  const { updatedLead, createdTasks } = await prisma.$transaction(async (tx) => {
    const updatedLead = await tx.lead.update({
      where: { id: leadId },
      data: leadUpdate,
      select: { id: true, stage: true, queueType: true, nextCallAt: true },
    });

    await tx.coldCallAttempt.update({
      where: { id: attemptId },
      data: attemptUpdateData,
    });

    await tx.activity.create({
      data: {
        activityType: 'call',
        description: buildActivityDescription(payload),
        userId,
        entityType: 'lead',
        entityId: leadId,
        metadata: {
          outcome: payload.outcome,
          notes: payload.notes ?? undefined,
          attemptId,
        },
      },
    });

    // Create all tasks atomically
    const createdTasks: { id: string; subject: string; taskType: string; dueDate: string }[] = [];
    for (const input of taskInputs) {
      const task = await tx.task.create({ data: input, select: { id: true, subject: true, taskType: true, dueDate: true } });
      createdTasks.push({ id: task.id, subject: task.subject, taskType: task.taskType, dueDate: task.dueDate.toISOString() });
    }

    // Log email activity atomically if applicable
    if (emailActivityInput) {
      await tx.activity.create({ data: emailActivityInput });
    }

    return { updatedLead, createdTasks };
  });

  // Fire side effects AFTER transaction commits (emails, push notifications)
  for (const effect of sideEffects) {
    void Promise.resolve(effect()).catch(console.error);
  }

  // Get next lead (outside transaction — read-only)
  const { lead: nextLead } = await getNextLead();

  return {
    lead: {
      id: updatedLead.id,
      stage: updatedLead.stage,
      queueType: updatedLead.queueType ?? null,
      nextCallAt: updatedLead.nextCallAt?.toISOString() ?? null,
    },
    createdTasks,
    nextLead,
  };
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
    parts.push(subLabels[payload.decisionMakerSubOutcome]);
  }
  if (payload.notes?.trim()) parts.push(payload.notes.trim());
  return parts.join(' — ');
}
