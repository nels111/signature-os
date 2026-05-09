export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

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

  const body = await request.json();

  if (!body.companyName || !body.contactName || !body.source) {
    return Response.json(
      { error: 'companyName, contactName, and source are required' },
      { status: 400 }
    );
  }

  const lead = await prisma.lead.create({
    data: {
      companyName: body.companyName,
      contactName: body.contactName,
      email: body.email || null,
      phone: body.phone || null,
      source: body.source,
      stage: body.stage || 'cold_call',
      ownerId: body.ownerId || session.user.id,
      contactId: body.contactId || null,
      accountId: body.accountId || null,
      notes: body.notes || null,
    },
    include: { owner: true, account: true },
  });

  return Response.json(lead, { status: 201 });
}
