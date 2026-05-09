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

  const allowedSortFields = ['firstName', 'lastName', 'email', 'phone', 'company', 'createdAt', 'updatedAt'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

  const where = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
            { company: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: { account: true },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [safeSortBy]: sortDir },
    }),
    prisma.contact.count({ where }),
  ]);

  return Response.json({ data, total, page, limit });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  if (!body.firstName || !body.lastName) {
    return Response.json(
      { error: 'firstName and lastName are required' },
      { status: 400 }
    );
  }

  const contact = await prisma.contact.create({
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || null,
      phone: body.phone || null,
      company: body.company || null,
      accountId: body.accountId || null,
      notes: body.notes || null,
      source: body.source || null,
      createdBy: session.user.id,
    },
    include: { account: true },
  });

  return Response.json(contact, { status: 201 });
}
