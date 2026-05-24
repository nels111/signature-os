export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasRole } from '@/lib/authz';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Cap children to a reasonable preview size to keep responses bounded.
  // Detail pages render the first ~50, deeper drill-downs use the list APIs.
  const CHILDREN_LIMIT = 50;
  const account = await prisma.account.findFirst({
    where: { id, deletedAt: null },
    include: {
      contacts: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: CHILDREN_LIMIT,
      },
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
  // Editing CRM master data is a sales/admin function. Operatives and VAs
  // should not be reshaping account records.
  if (!hasRole(session, 'admin', 'sales', 'operations')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

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
  // Destructive: soft-delete still hides the account from everyone. Admin only.
  if (!hasRole(session, 'admin')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
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
