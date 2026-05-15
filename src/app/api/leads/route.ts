export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { resolveOwnerIdOnCreate } from '@/lib/authz';
import { notifyLeadAssigned } from '@/lib/notifications';
import { logLeadCreated } from '@/lib/activities';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
  const search = url.searchParams.get('search') || '';
  const sortBy = url.searchParams.get('sortBy') || 'createdAt';
  const sortDir = url.searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';
  const stage = url.searchParams.get('stage') || '';
  const ownerId = url.searchParams.get('ownerId') || '';

  const allowedSortFields = ['companyName', 'contactName', 'email', 'stage', 'source', 'createdAt', 'updatedAt'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

  const where = {
    deletedAt: null,
    ...(stage ? { stage: stage as never } : {}),
    ...(ownerId ? { ownerId } : {}),
    ...(search
      ? {
          OR: [
            { companyName: { contains: search, mode: 'insensitive' as const } },
            { contactName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { owner: true, account: true },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [safeSortBy]: sortDir },
    }),
    prisma.lead.count({ where }),
  ]);

  return Response.json({ data, total, page, limit });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.companyName || !body.contactName || !body.source) {
    return Response.json(
      { error: 'companyName, contactName, and source are required' },
      { status: 400 }
    );
  }

  const lead = await prisma.lead.create({
    data: {
      companyName: body.companyName as string,
      contactName: body.contactName as string,
      email: (body.email as string) || null,
      phone: (body.phone as string) || null,
      source: body.source as never,
      stage: (body.stage as never) || 'cold_call',
      ownerId: resolveOwnerIdOnCreate(session, body.ownerId),
      contactId: (body.contactId as string) || null,
      accountId: (body.accountId as string) || null,
      notes: (body.notes as string) || null,
    },
    include: { owner: true, account: true },
  });

  // Notify lead owner if assigned to someone other than the creator
  await notifyLeadAssigned({
    ownerUserId: lead.ownerId,
    actorUserId: session.user.id,
    leadId: lead.id,
    leadLabel: `${lead.companyName} (${lead.contactName})`,
  });

  // Log activity
  await logLeadCreated({
    userId: session.user.id,
    leadId: lead.id,
    companyName: lead.companyName,
    contactName: lead.contactName,
    source: lead.source,
  });

  return Response.json(lead, { status: 201 });
}
