export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isAdmin, hasRole } from '@/lib/authz';
import { notifyLeadAssigned } from '@/lib/notifications';
import { logLeadStageChange, logDealCreated } from '@/lib/activities';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const CHILDREN_LIMIT = 50;
  const lead = await prisma.lead.findFirst({
    where: { id, deletedAt: null },
    include: {
      owner: true,
      contact: true,
      account: true,
      deals: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: CHILDREN_LIMIT,
      },
      emails: {
        orderBy: { date: 'desc' },
        take: CHILDREN_LIMIT,
        select: {
          id: true, from: true, to: true, subject: true, bodyText: true,
          date: true, isRead: true, openCount: true, folder: true,
          attachments: { select: { id: true, filename: true } },
        },
      },
    },
  });

  if (!lead) {
    return Response.json({ error: 'Lead not found' }, { status: 404 });
  }

  return Response.json(lead);
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

  const existing = await prisma.lead.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existing) {
    return Response.json({ error: 'Lead not found' }, { status: 404 });
  }

  // ownerId is admin-only; strip it from non-admin requests
  const adminCaller = isAdmin(session);
  const allowedFields = [
    'companyName', 'contactName', 'email', 'phone', 'source', 'stage',
    'meetingOutcome', 'notes', 'contactId', 'accountId', 'cadenceStatus', 'sector',
    ...(adminCaller ? ['ownerId'] : []),
  ];
  const updateData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field] || null;
    }
  }

  // Keep required fields non-null
  if (updateData.companyName === null) delete updateData.companyName;
  if (updateData.contactName === null) delete updateData.contactName;
  if (updateData.source === null) delete updateData.source;
  if (updateData.ownerId === null) delete updateData.ownerId;

  // If stage is explicitly set, keep it even if falsy-looking
  if (body.stage !== undefined) {
    updateData.stage = body.stage;
  }

  // Track stage changes
  const stageChanged = body.stage && body.stage !== existing.stage;
  if (stageChanged) {
    updateData.stageChangedAt = new Date();
  }

  const lead = await prisma.lead.update({
    where: { id },
    data: updateData,
    include: { owner: true, contact: true, account: true },
  });

  // Notify new owner if reassignment happened
  const ownerChanged = body.ownerId && body.ownerId !== existing.ownerId;
  if (ownerChanged) {
    await notifyLeadAssigned({
      ownerUserId: lead.ownerId,
      actorUserId: session.user.id,
      leadId: lead.id,
      leadLabel: `${lead.companyName} (${lead.contactName})`,
    });
  }

  // Log activity on stage change
  if (stageChanged) {
    await logLeadStageChange({
      userId: session.user.id,
      leadId: lead.id,
      leadLabel: `${lead.companyName} (${lead.contactName})`,
      fromStage: existing.stage,
      toStage: lead.stage,
    });
  }

  // Auto-create deal when stage changes to quote_delivered — but only once.
  // Guard against duplicates if the lead re-enters this stage.
  if (stageChanged && body.stage === 'quote_delivered') {
    const existingDeal = await prisma.deal.findFirst({
      where: { convertedFromId: lead.id, deletedAt: null },
      select: { id: true },
    });
    if (existingDeal) {
      return Response.json({ lead, deal: existingDeal, dealAlreadyExisted: true });
    }
    const deal = await prisma.deal.create({
      data: {
        name: lead.companyName,
        stage: 'quote_sent',
        ownerId: lead.ownerId,
        contactId: lead.contactId,
        accountId: lead.accountId,
        convertedFromId: lead.id,
      },
      include: { owner: true, contact: true, account: true },
    });

    await logDealCreated({
      userId: session.user.id,
      dealId: deal.id,
      dealName: deal.name,
      fromLeadId: lead.id,
    });

    return Response.json({ lead, deal });
  }

  return Response.json(lead);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Consistent with /api/leads/bulk DELETE which is admin-only.
  if (!hasRole(session, 'admin')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const existing = await prisma.lead.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existing) {
    return Response.json({ error: 'Lead not found' }, { status: 404 });
  }

  await prisma.lead.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return Response.json({ success: true });
}
