import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { syncMailbox } from '@/lib/email-sync';

// POST /api/emails/sync - Trigger IMAP sync for the current user's mailbox
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

    if (targetEmail !== user.ionosEmail && targetEmail !== sharedEmail) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let password: string;
    if (targetEmail === sharedEmail) {
      password = process.env.HELLO_MAILBOX_PASSWORD || '';
      if (!password) return NextResponse.json({ error: 'Shared mailbox not configured' }, { status: 500 });
    } else {
      password = user.ionosPassword || '';
      if (!password) return NextResponse.json({ error: 'IONOS credentials not configured' }, { status: 400 });
    }

    const res = await syncMailbox({ userId: session.user.id, mailbox: targetEmail!, password });
    return NextResponse.json(res);
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
