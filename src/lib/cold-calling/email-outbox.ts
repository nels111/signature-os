/**
 * Observable email outbox for cold-calling.
 *
 * Replaces the old fire-and-forget `.catch(console.error)` sends. Every outbound
 * email is recorded as a row (queued -> sent | failed). The `email_sent`
 * Activity is written ONLY when a send actually succeeds, so the activity feed
 * never shows an email that didn't go out. Failures stay visible and retryable.
 *
 * Enqueue happens AFTER the outcome transaction commits; processing re-derives
 * the email content from the lead row (no duplicated payload to drift).
 */

import { prisma } from '@/lib/db';
import {
  sendGatekeeperEmail,
  sendCallbackEmail,
  sendInfoEmail,
  sendSiteVisitEmail,
} from './send-emails';

export type OutboxTemplate = 'gatekeeper' | 'callback' | 'send_info' | 'site_visit';

const SUBJECTS: Record<OutboxTemplate, string> = {
  gatekeeper: 'Information about Signature Cleans',
  callback: 'Your callback with Signature Cleans',
  send_info: 'Information about Signature Cleans',
  site_visit: 'Your site visit with Signature Cleans',
};

/** Create a queued outbox row. Returns its id. */
export async function enqueueEmail(opts: {
  leadId: string;
  template: OutboxTemplate;
  to: string;
}): Promise<string> {
  const row = await prisma.emailOutbox.create({
    data: {
      leadId: opts.leadId,
      template: opts.template,
      toAddress: opts.to,
      subject: SUBJECTS[opts.template],
      status: 'queued',
    },
    select: { id: true },
  });
  return row.id;
}

/**
 * Attempt to send one outbox row. Records the result. NEVER throws — a failed
 * send leaves a retryable `failed` row and writes no `email_sent` activity.
 */
export async function processOutboxRow(id: string, actingUserId: string): Promise<'sent' | 'failed' | 'skipped'> {
  const row = await prisma.emailOutbox.findUnique({ where: { id } });
  if (!row || row.status === 'sent') return 'skipped';

  const lead = row.leadId
    ? await prisma.lead.findUnique({
        where: { id: row.leadId },
        select: {
          id: true,
          companyName: true,
          contactName: true,
          nextCallAt: true,
          siteVisitAt: true,
          siteVisitAddress: true,
        },
      })
    : null;

  try {
    if (!lead) throw new Error('lead not found for outbox row');
    if (!row.toAddress) throw new Error('no recipient address');
    const firstName = lead.contactName?.trim().split(' ')[0] ?? 'there';

    switch (row.template as OutboxTemplate) {
      case 'gatekeeper':
        await sendGatekeeperEmail({ to: row.toAddress, firstName, company: lead.companyName });
        break;
      case 'send_info':
        await sendInfoEmail({ to: row.toAddress, firstName, company: lead.companyName });
        break;
      case 'callback':
        await sendCallbackEmail({
          to: row.toAddress,
          firstName,
          callbackAt: (lead.nextCallAt ?? new Date()).toISOString(),
        });
        break;
      case 'site_visit':
        await sendSiteVisitEmail({
          to: row.toAddress,
          firstName,
          company: lead.companyName,
          siteVisitAt: (lead.siteVisitAt ?? new Date()).toISOString(),
          siteVisitAddress: lead.siteVisitAddress ?? undefined,
        });
        break;
      default:
        throw new Error(`unknown template: ${row.template}`);
    }

    await prisma.emailOutbox.update({
      where: { id },
      data: { status: 'sent', sentAt: new Date(), attempts: { increment: 1 } },
    });
    // Truthful record: only logged once the send actually succeeded.
    if (row.leadId) {
      await prisma.activity.create({
        data: {
          activityType: 'email_sent',
          description: `Cold-call email sent (${row.template})`,
          userId: actingUserId,
          entityType: 'lead',
          entityId: row.leadId,
          metadata: { template: row.template, outboxId: id, sentTo: row.toAddress },
        },
      });
    }
    return 'sent';
  } catch (e) {
    await prisma.emailOutbox.update({
      where: { id },
      data: {
        status: 'failed',
        attempts: { increment: 1 },
        lastError: (e instanceof Error ? e.message : String(e)).slice(0, 500),
      },
    });
    return 'failed';
  }
}

/** Count of failed emails (for the admin visibility badge). */
export async function failedEmailCount(): Promise<number> {
  return prisma.emailOutbox.count({ where: { status: 'failed' } });
}

/** Enqueue then immediately attempt one send. Used post-commit in the outcome flow. */
export async function enqueueAndSend(opts: {
  leadId: string;
  template: OutboxTemplate;
  to: string;
  actingUserId: string;
}): Promise<'sent' | 'failed' | 'skipped'> {
  const id = await enqueueEmail({ leadId: opts.leadId, template: opts.template, to: opts.to });
  return processOutboxRow(id, opts.actingUserId);
}
