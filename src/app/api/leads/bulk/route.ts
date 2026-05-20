import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

const VALID_STAGES = [
  'new_lead', 'cold_call', 'cold_email', 'linkedin',
  'follow_up_sequence', 'not_interested_for_now',
  'contact_when_contract_up', 'meeting_scheduled',
  'meeting_attended', 'quote_delivered', 'foad',
];

// POST /api/leads/bulk
// Body: { ids: string[], stage: string }
// Admins can update any lead. Others can only update leads they own.
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const { ids, stage } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
    }
    if (ids.length > 200) {
      return NextResponse.json({ error: 'Maximum 200 leads per bulk update' }, { status: 400 });
    }
    if (!stage || !VALID_STAGES.includes(stage)) {
      return NextResponse.json({ error: `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}` }, { status: 400 });
    }

    const isAdmin = session.user.role === 'admin';
    const where = isAdmin
      ? { id: { in: ids } }
      : { id: { in: ids }, ownerId: session.user.id };

    const result = await prisma.lead.updateMany({
      where,
      data: {
        stage: stage as never,
        stageChangedAt: new Date(),
      },
    });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Bulk update failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/leads/bulk
// Body: { ids: string[] }
// Soft-deletes leads (sets deletedAt). Admins only.
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const { ids } = body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
    }
    if (ids.length > 200) {
      return NextResponse.json({ error: 'Maximum 200 leads per bulk delete' }, { status: 400 });
    }

    const result = await prisma.lead.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Bulk delete failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
