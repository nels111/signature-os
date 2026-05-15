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

  // Cap children to a reasonable preview size.
  const CHILDREN_LIMIT = 50;
  const contact = await prisma.contact.findFirst({
    where: { id, deletedAt: null },
    include: {
      account: true,
      leads: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: CHILDREN_LIMIT,
      },
      deals: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: CHILDREN_LIMIT,
      },
    },
  });

  if (!contact) {
    return Response.json({ error: 'Contact not found' }, { status: 404 });
  }

  return Response.json(contact);
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

  const existing = await prisma.contact.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existing) {
    return Response.json({ error: 'Contact not found' }, { status: 404 });
  }

  const allowedFields = ['firstName', 'lastName', 'email', 'phone', 'company', 'accountId', 'notes', 'source'];
  const updateData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field] || null;
    }
  }

  // Keep required fields non-null
  if (updateData.firstName === null) delete updateData.firstName;
  if (updateData.lastName === null) delete updateData.lastName;

  const contact = await prisma.contact.update({
    where: { id },
    data: updateData,
    include: { account: true },
  });

  return Response.json(contact);
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

  const existing = await prisma.contact.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existing) {
    return Response.json({ error: 'Contact not found' }, { status: 404 });
  }

  await prisma.contact.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return Response.json({ success: true });
}
