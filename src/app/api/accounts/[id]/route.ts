export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const account = await prisma.account.findFirst({
    where: { id, deletedAt: null },
    include: {
      contacts: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      },
      leads: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      },
      deals: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!account) {
    return Response.json({ error: 'Account not found' }, { status: 404 });
  }

  return Response.json(account);
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
  const body = await request.json();

  const existing = await prisma.account.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existing) {
    return Response.json({ error: 'Account not found' }, { status: 404 });
  }

  const allowedFields = ['name', 'industry', 'website', 'phone', 'address', 'notes'];
  const updateData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field] || null;
    }
  }

  // Keep required field non-null
  if (updateData.name === null) delete updateData.name;

  const account = await prisma.account.update({
    where: { id },
    data: updateData,
  });

  return Response.json(account);
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

  const existing = await prisma.account.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existing) {
    return Response.json({ error: 'Account not found' }, { status: 404 });
  }

  await prisma.account.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return Response.json({ success: true });
}
