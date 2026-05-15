export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isAdmin } from '@/lib/authz';
import { notifyDealStageChanged } from '@/lib/notifications';
import { logDealStageChange } from '@/lib/activities';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const deal = await prisma.deal.findFirst({
    where: { id, deletedAt: null },
    include: {
      owner: true,
      contact: true,
      account: true,
      convertedFrom: {
        select: {
          id: true,
          companyName: true,
          contactName: true,
          stage: true,
          source: true,
        },
      },
    },
  });

  if (!deal) {
    return Response.json({ error: 'Deal not found' }, { status: 404 });
  }

  return Response.json(deal);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const existing = await prisma.deal.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existing) {
    return Response.json({ error: 'Deal not found' }, { status: 404 });
  }

  // ownerId is admin-only; non-admin updates ignore it
  const adminCaller = isAdmin(session);
  const allowedFields = [
    'name', 'stage', 'value', 'contactId', 'accountId',
    'quoteId', 'notes', 'lossReason',
    ...(adminCaller ? ['ownerId'] : []),
  ];
  const updateData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === 'value') {
        updateData[field] = body[field] ? parseFloat(body[field] as string) : null;
      } else {
        updateData[field] = body[field] || null;
      }
    }
  }

  // Keep required fields non-null
  if (updateData.name === null) delete updateData.name;
  if (updateData.ownerId === null) delete updateData.ownerId;

  // If stage is explicitly set, keep it
  if (body.stage !== undefined) {
    updateData.stage = body.stage;
  }

  // Track stage changes
  const stageChanged = body.stage && body.stage !== existing.stage;
  if (stageChanged) {
    updateData.stageChangedAt = new Date();

    if (body.stage === 'closed_won') {
      updateData.wonAt = new Date();
    }
    if (body.stage === 'closed_lost') {
      updateData.lostAt = new Date();
      if (body.lossReason) {
        updateData.lossReason = body.lossReason;
      }
    }
  }

  const deal = await prisma.deal.update({
    where: { id },
    data: updateData,
    include: { owner: true, contact: true, account: true, convertedFrom: true },
  });

  // Notify deal owner about stage transition
  if (stageChanged) {
    await notifyDealStageChanged({
      ownerUserId: deal.ownerId,
      actorUserId: session.user.id,
      dealId: deal.id,
      dealName: deal.name,
      fromStage: existing.stage,
      toStage: deal.stage,
    });

    await logDealStageChange({
      userId: session.user.id,
      dealId: deal.id,
      dealName: deal.name,
      fromStage: existing.stage,
      toStage: deal.stage,
    });
  }

  return Response.json(deal);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.deal.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existing) {
    return Response.json({ error: 'Deal not found' }, { status: 404 });
  }

  await prisma.deal.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return Response.json({ success: true });
}
