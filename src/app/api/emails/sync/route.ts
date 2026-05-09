import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { fetchEmails, getImapConfig } from '@/lib/imap';

// POST /api/emails/sync - Trigger IMAP sync for a mailbox
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { mailbox } = body;

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
      const existing = await prisma.email.findUnique({
        where: { messageId: email.messageId },
      });

      if (!existing) {
        await prisma.email.create({
          data: {
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
        });
        synced++;
      }
    }

    return NextResponse.json({ synced, total: imapEmails.length });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
