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

  const allowedSortFields = ['name', 'industry', 'phone', 'createdAt', 'updatedAt'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

  const where = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { industry: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
            { website: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.account.findMany({
      where,
      include: {
        _count: {
          select: { contacts: { where: { deletedAt: null } } },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [safeSortBy]: sortDir },
    }),
    prisma.account.count({ where }),
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

  if (!body.name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }

  const account = await prisma.account.create({
    data: {
      name: body.name as string,
      industry: (body.industry as string) || null,
      website: (body.website as string) || null,
      phone: (body.phone as string) || null,
      address: (body.address as string) || null,
      notes: (body.notes as string) || null,
      createdBy: session.user.id,
    },
  });

  return Response.json(account, { status: 201 });
}
