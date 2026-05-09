import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/emails/:id - Get full email with body
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const email = await prisma.email.findUnique({
      where: { id },
      include: {
        linkedLead: { select: { id: true, companyName: true } },
        linkedDeal: { select: { id: true, name: true } },
        linkedContact: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    // Security: user can only see their own emails or shared mailbox
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { ionosEmail: true },
    });

    const sharedEmail = 'hello@signature-cleans.co.uk';
    if (email.mailbox !== user?.ionosEmail && email.mailbox !== sharedEmail) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Auto-mark as read
    if (!email.isRead) {
      await prisma.email.update({
        where: { id },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ email: { ...email, isRead: true } });
  } catch (error) {
    console.error('Email detail error:', error);
    return NextResponse.json({ error: 'Failed to fetch email' }, { status: 500 });
  }
}

// PATCH /api/emails/:id - Update email (mark read/unread, link to CRM)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Verify access
    const email = await prisma.email.findUnique({ where: { id } });
    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { ionosEmail: true },
    });

    const sharedEmail = 'hello@signature-cleans.co.uk';
    if (email.mailbox !== user?.ionosEmail && email.mailbox !== sharedEmail) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.isRead !== undefined) updateData.isRead = body.isRead;
    if (body.linkedLeadId !== undefined) updateData.linkedLeadId = body.linkedLeadId;
    if (body.linkedDealId !== undefined) updateData.linkedDealId = body.linkedDealId;
    if (body.linkedContactId !== undefined) updateData.linkedContactId = body.linkedContactId;

    const updated = await prisma.email.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ email: updated });
  } catch (error) {
    console.error('Email update error:', error);
    return NextResponse.json({ error: 'Failed to update email' }, { status: 500 });
  }
}
