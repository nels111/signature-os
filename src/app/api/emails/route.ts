import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { fetchEmails, getImapConfig } from '@/lib/imap';
import { sendEmail, getSmtpConfig } from '@/lib/smtp';

// GET /api/emails - Fetch emails from IMAP and sync to DB
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mailbox = searchParams.get('mailbox');
    const folder = searchParams.get('folder') || 'INBOX';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const dbOnly = searchParams.get('dbOnly') === 'true';

    // If no specific mailbox requested, get user's own + shared
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, ionosEmail: true, ionosPassword: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Determine which mailbox to query
    let targetEmail: string | null = mailbox;
    const sharedEmail = 'hello@signature-cleans.co.uk';

    if (!targetEmail) {
      targetEmail = user.ionosEmail || null;
    }

    if (!targetEmail) {
      return NextResponse.json({ error: 'No mailbox configured' }, { status: 400 });
    }

    // Security: users can only access their own mailbox + shared
    if (targetEmail !== user.ionosEmail && targetEmail !== sharedEmail) {
      return NextResponse.json({ error: 'Access denied to this mailbox' }, { status: 403 });
    }

    // For shared mailbox, we need shared credentials (use env or first admin)
    let emailPassword: string;
    if (targetEmail === sharedEmail) {
      emailPassword = process.env.HELLO_MAILBOX_PASSWORD || '';
      if (!emailPassword) {
        return NextResponse.json({ error: 'Shared mailbox not configured' }, { status: 500 });
      }
    } else {
      emailPassword = user.ionosPassword || '';
      if (!emailPassword) {
        return NextResponse.json({ error: 'IONOS credentials not configured' }, { status: 400 });
      }
    }

    if (!dbOnly) {
      // Fetch from IMAP and upsert to DB
      try {
        const config = getImapConfig(targetEmail, emailPassword);
        const imapEmails = await fetchEmails(config, folder, undefined, 100);

        // Upsert each email to DB
        for (const email of imapEmails) {
          await prisma.email.upsert({
            where: { messageId: email.messageId },
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
        }
      } catch (imapError) {
        console.error('IMAP fetch error:', imapError);
        // Fall through to DB query — show cached emails even if IMAP is down
      }
    }

    // Query from DB
    const where: Record<string, unknown> = {
      mailbox: targetEmail,
    };

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { from: { contains: search, mode: 'insensitive' } },
        { bodyText: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (folder !== 'ALL') {
      where.folder = folder;
    }

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          messageId: true,
          mailbox: true,
          from: true,
          to: true,
          cc: true,
          subject: true,
          date: true,
          isRead: true,
          folder: true,
          linkedLeadId: true,
          linkedDealId: true,
          linkedContactId: true,
        },
      }),
      prisma.email.count({ where }),
    ]);

    return NextResponse.json({
      emails,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Email API error:', error);
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 });
  }
}

// POST /api/emails - Send an email via SMTP
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { to, cc, bcc, subject, text, html, replyTo, inReplyTo, references, mailbox } = body;

    if (!to || !subject) {
      return NextResponse.json({ error: 'to and subject required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, ionosEmail: true, ionosPassword: true },
    });

    if (!user?.ionosEmail || !user?.ionosPassword) {
      return NextResponse.json({ error: 'IONOS credentials not configured' }, { status: 400 });
    }

    // Determine send-as address (own or shared if authorized)
    const sharedEmail = 'hello@signature-cleans.co.uk';
    let fromEmail = user.ionosEmail;
    let fromPassword = user.ionosPassword;

    if (mailbox === sharedEmail) {
      const sharedPassword = process.env.HELLO_MAILBOX_PASSWORD;
      if (!sharedPassword) {
        return NextResponse.json({ error: 'Shared mailbox not configured' }, { status: 500 });
      }
      fromEmail = sharedEmail;
      fromPassword = sharedPassword;
    }

    const config = getSmtpConfig(fromEmail, fromPassword);
    const fromAddress = `${user.name} <${fromEmail}>`;

    const result = await sendEmail(config, {
      from: fromAddress,
      to: Array.isArray(to) ? to : [to],
      cc,
      bcc,
      subject,
      text,
      html,
      replyTo,
      inReplyTo,
      references,
    });

    // Save sent email to DB
    const saved = await prisma.email.create({
      data: {
        messageId: result.messageId,
        mailbox: fromEmail,
        from: fromAddress,
        to: Array.isArray(to) ? to : [to],
        cc: cc ? (Array.isArray(cc) ? cc : [cc]) : [],
        subject,
        bodyText: text || null,
        bodyHtml: html || null,
        date: new Date(),
        folder: 'Sent',
        isRead: true,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ email: saved, messageId: result.messageId });
  } catch (error) {
    console.error('Send email error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
