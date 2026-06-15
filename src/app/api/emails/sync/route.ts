import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { fetchEmails, getImapConfig } from '@/lib/imap';

/** Extract email address from "Name <addr>" or bare "addr" */
function extractEmailAddress(from: string): string | null {
  const angleMatch = from.match(/<([^>]+)>/);
  if (angleMatch) return angleMatch[1].toLowerCase().trim();
  const emailMatch = from.match(/[\w.+%-]+@[\w.-]+\.[\w]+/);
  return emailMatch ? emailMatch[0].toLowerCase().trim() : null;
}

// POST /api/emails/sync - Trigger IMAP sync for a mailbox
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { mailbox } = body as { mailbox?: string };

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { ionosEmail: true, ionosPassword: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const sharedEmail = 'hello@signature-cleans.co.uk';
    const targetEmail = mailbox || user.ionosEmail;

    // Security check
    if (targetEmail !== user.ionosEmail && targetEmail !== sharedEmail) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let password: string;
    if (targetEmail === sharedEmail) {
      password = process.env.HELLO_MAILBOX_PASSWORD || '';
      if (!password) {
        return NextResponse.json({ error: 'Shared mailbox not configured' }, { status: 500 });
      }
    } else {
      password = user.ionosPassword || '';
      if (!password) {
        return NextResponse.json({ error: 'IONOS credentials not configured' }, { status: 400 });
      }
    }

    const config = getImapConfig(targetEmail!, password);
    const imapEmails = await fetchEmails(config, 'INBOX', undefined, 100);

    let synced = 0;
    for (const email of imapEmails) {
      const result = await prisma.email.upsert({
        where: { messageId_mailbox: { messageId: email.messageId, mailbox: targetEmail! } },
        create: {
          messageId: email.messageId,
          mailbox: targetEmail!,
          from: email.from,
          to: email.to,
          cc: email.cc,
          subject: email.subject,
          bodyText: email.bodyText,
          bodyHtml: email.bodyHtml,
          date: email.date,
          folder: email.folder,
          userId: session.user.id,
        },
        update: {
          folder: email.folder,
        },
      });

      // Auto-link to CRM on creation (or if not yet linked).
      // Match on BOTH sender and recipients so inbound (from) and outbound
      // (to — emails we sent the lead) both attach to the thread.
      if (!result.linkedContactId && !result.linkedLeadId) {
        const candidates = [
          extractEmailAddress(email.from),
          ...(Array.isArray(email.to) ? email.to.map((t: string) => extractEmailAddress(t)) : []),
        ].filter((a): a is string => !!a);

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

      // Store attachments if the email has some AND none are stored yet
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

      if (isNew) {
        synced++;
      }
    }

    return NextResponse.json({ synced, total: imapEmails.length });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
