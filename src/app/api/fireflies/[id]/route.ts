import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

// GET /api/fireflies/[id] - Get single transcript
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

    const transcript = await prisma.firefliesTranscript.findUnique({
      where: { id },
      select: {
        id: true,
        firefliesId: true,
        title: true,
        date: true,
        summary: true,
        participants: true,
        linkedLeadId: true,
        linkedDealId: true,
        linkedContactId: true,
        createdAt: true,
        linkedLead: { select: { id: true, companyName: true, contactName: true } },
        linkedDeal: { select: { id: true, name: true, stage: true } },
        linkedContact: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!transcript) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
    }

    return NextResponse.json(transcript);
  } catch (error) {
    console.error('Fireflies get error:', error);
    return NextResponse.json({ error: 'Failed to fetch transcript' }, { status: 500 });
  }
}

// PATCH /api/fireflies/[id] - Link transcript to CRM entity
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
    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
    const { linkedLeadId, linkedDealId, linkedContactId } = body;

    // Verify transcript exists
    const existing = await prisma.firefliesTranscript.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
    }

    // Validate linked entities exist
    const data: Record<string, string | null> = {};

    if (linkedLeadId !== undefined) {
      if (linkedLeadId) {
        const lead = await prisma.lead.findFirst({ where: { id: linkedLeadId, deletedAt: null }, select: { id: true } });
        if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 400 });
      }
      data.linkedLeadId = linkedLeadId;
    }

    if (linkedDealId !== undefined) {
      if (linkedDealId) {
        const deal = await prisma.deal.findFirst({ where: { id: linkedDealId, deletedAt: null }, select: { id: true } });
        if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 400 });
      }
      data.linkedDealId = linkedDealId;
    }

    if (linkedContactId !== undefined) {
      if (linkedContactId) {
        const contact = await prisma.contact.findFirst({ where: { id: linkedContactId, deletedAt: null }, select: { id: true } });
        if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 400 });
      }
      data.linkedContactId = linkedContactId;
    }

    const updated = await prisma.firefliesTranscript.update({
      where: { id },
      data,
      select: {
        id: true,
        title: true,
        linkedLeadId: true,
        linkedDealId: true,
        linkedContactId: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Fireflies link error:', error);
    return NextResponse.json({ error: 'Failed to update transcript' }, { status: 500 });
  }
}
