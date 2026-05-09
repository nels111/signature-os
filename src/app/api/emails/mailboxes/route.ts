import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/emails/mailboxes - List available mailboxes for current user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { ionosEmail: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const mailboxes = [];

    // User's own mailbox
    if (user.ionosEmail) {
      mailboxes.push({
        email: user.ionosEmail,
        name: user.name || user.ionosEmail,
        type: 'personal',
      });
    }

    // Shared mailbox (available to all)
    const sharedEmail = 'hello@signature-cleans.co.uk';
    const sharedConfigured = !!process.env.HELLO_MAILBOX_PASSWORD;
    mailboxes.push({
      email: sharedEmail,
      name: 'Shared Inbox',
      type: 'shared',
      configured: sharedConfigured,
    });

    return NextResponse.json({ mailboxes });
  } catch (error) {
    console.error('Mailboxes error:', error);
    return NextResponse.json({ error: 'Failed to fetch mailboxes' }, { status: 500 });
  }
}
