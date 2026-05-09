import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/quotes/:id
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

    const quote = await prisma.quote.findUnique({
      where: { id },
      include: {
        deal: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        creator: { select: { id: true, name: true } },
      },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    return NextResponse.json({ quote });
  } catch (error) {
    console.error('Quote detail error:', error);
    return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 });
  }
}

// PATCH /api/quotes/:id - Update status, resend, etc.
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

    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.status) {
      updateData.status = body.status;
      if (body.status === 'sent' && !quote.sentAt) {
        updateData.sentAt = new Date();
        updateData.trackingId = crypto.randomUUID();
      }
      if (body.status === 'accepted') updateData.acceptedAt = new Date();
      if (body.status === 'rejected') updateData.rejectedAt = new Date();
    }

    if (body.weeklyHours !== undefined) updateData.weeklyHours = parseFloat(body.weeklyHours);
    if (body.sellRate !== undefined) updateData.sellRate = parseFloat(body.sellRate);
    if (body.isPilot !== undefined) updateData.isPilot = body.isPilot;

    const updated = await prisma.quote.update({
      where: { id },
      data: updateData,
      include: {
        deal: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return NextResponse.json({ quote: updated });
  } catch (error) {
    console.error('Quote update error:', error);
    return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 });
  }
}
