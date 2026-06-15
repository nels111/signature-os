import { prisma } from '@/lib/db';
import { fetchEmails, getImapConfig } from '@/lib/imap';

/** Extract a bare email address from "Name <addr>" or "addr". */
export function extractEmailAddress(from: string): string | null {
  const angle = from.match(/<([^>]+)>/);
  if (angle) return angle[1].toLowerCase().trim();
  const bare = from.match(/[\w.+%-]+@[\w.-]+\.[\w]+/);
  return bare ? bare[0].toLowerCase().trim() : null;
}

// Our own addresses must never be used to match a lead/contact — they appear on
// nearly every email and would link everything to an internal record.
function isInternal(addr: string): boolean {
  return /@signature-cleans\.co\.uk$/i.test(addr);
}

/**
 * Sync one mailbox over IMAP into the Email table: upsert messages, auto-link to
 * a lead/contact by the EXTERNAL party's address (from or any recipient), and
 * store attachments once. Shared by the session route and the cron job.
 */
export async function syncMailbox(opts: {
  userId: string;
  mailbox: string;
  password: string;
  limit?: number;
}): Promise<{ synced: number; total: number }> {
  const { userId, mailbox, password, limit = 100 } = opts;
  const config = getImapConfig(mailbox, password);
  const imapEmails = await fetchEmails(config, 'INBOX', undefined, limit);

  let synced = 0;
  for (const email of imapEmails) {
    const result = await prisma.email.upsert({
      where: { messageId_mailbox: { messageId: email.messageId, mailbox } },
      create: {
        messageId: email.messageId,
        mailbox,
        from: email.from,
        to: email.to,
        cc: email.cc,
        subject: email.subject,
        bodyText: email.bodyText,
        bodyHtml: email.bodyHtml,
        date: email.date,
        folder: email.folder,
        userId,
      },
      update: { folder: email.folder },
    });

    if (!result.linkedContactId && !result.linkedLeadId) {
      const candidates = [
        extractEmailAddress(email.from),
        ...(Array.isArray(email.to) ? email.to.map((t: string) => extractEmailAddress(t)) : []),
      ].filter((a): a is string => !!a && !isInternal(a));

      if (candidates.length) {
        const [contact, lead] = await Promise.all([
          prisma.contact.findFirst({
            where: { email: { in: candidates, mode: 'insensitive' }, deletedAt: null },
            select: { id: true },
          }),
          prisma.lead.findFirst({
            where: { email: { in: candidates, mode: 'insensitive' }, deletedAt: null },
            select: { id: true },
          }),
        ]);
        if (contact || lead) {
          await prisma.email.update({
            where: { id: result.id },
            data: {
              ...(contact ? { linkedContactId: contact.id } : {}),
              ...(lead ? { linkedLeadId: lead.id } : {}),
            },
          });
        }
      }
    }

    const isNew = result.createdAt.getTime() > Date.now() - 5000;

    if (email.attachments && email.attachments.length > 0) {
      const existingCount = await prisma.emailAttachment.count({ where: { emailId: result.id } });
      if (existingCount === 0) {
        for (const attachment of email.attachments) {
          try {
            await prisma.emailAttachment.create({
              data: {
                emailId: result.id,
                filename: attachment.filename,
                contentType: attachment.contentType,
                size: attachment.size,
                content: attachment.content as unknown as Uint8Array<ArrayBuffer>,
                contentId: attachment.contentId || null,
              },
            });
          } catch {
            // Skip if attachment storage fails
          }
        }
      }
    }

    if (isNew) synced++;
  }

  return { synced, total: imapEmails.length };
}

/** Sync every user that has IONOS credentials configured. Used by the cron job. */
export async function syncAllConfiguredMailboxes(): Promise<{
  results: Array<{ mailbox: string; synced: number; total: number; error?: string }>;
}> {
  const users = await prisma.user.findMany({
    where: { ionosEmail: { not: null }, ionosPassword: { not: null } },
    select: { id: true, ionosEmail: true, ionosPassword: true },
  });

  const results = [];
  for (const u of users) {
    try {
      const r = await syncMailbox({ userId: u.id, mailbox: u.ionosEmail!, password: u.ionosPassword! });
      results.push({ mailbox: u.ionosEmail!, ...r });
    } catch (e) {
      results.push({ mailbox: u.ionosEmail!, synced: 0, total: 0, error: e instanceof Error ? e.message : 'sync failed' });
    }
  }
  return { results };
}
