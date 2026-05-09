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

  const allowedSortFields = ['name', 'stage', 'value', 'createdAt', 'updatedAt'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

  const where = {
    deletedAt: null,
    ...(stage ? { stage: stage as never } : {}),
    ...(ownerId ? { ownerId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.deal.findMany({
      where,
      include: { owner: true, contact: true, account: true, convertedFrom: true },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [safeSortBy]: sortDir },
    }),
    prisma.deal.count({ where }),
  ]);

  return Response.json({ data, total, page, limit });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  if (!body.name) {
    return Response.json(
      { error: 'name is required' },
      { status: 400 }
    );
  }

  const deal = await prisma.deal.create({
    data: {
      name: body.name,
      stage: body.stage || 'quote_sent',
      value: body.value ? parseFloat(body.value) : null,
      ownerId: body.ownerId || session.user.id,
      contactId: body.contactId || null,
      accountId: body.accountId || null,
      convertedFromId: body.convertedFromId || null,
      notes: body.notes || null,
    },
    include: { owner: true, contact: true, account: true },
  });

  return Response.json(deal, { status: 201 });
}
