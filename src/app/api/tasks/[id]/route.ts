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
  const task = await prisma.task.findFirst({
    where: { id, deletedAt: null },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      linkedLead: { select: { id: true, companyName: true, contactName: true } },
      linkedDeal: { select: { id: true, name: true, stage: true } },
      linkedContact: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });
  return Response.json(task);
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

  const existing = await prisma.task.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return Response.json({ error: 'Task not found' }, { status: 404 });
  // Only owner can edit personal tasks
  if (existing.taskType === 'personal' && existing.ownerId !== session.user.id) {
    return Response.json({ error: 'Cannot edit another user\'s personal task' }, { status: 403 });
  }

  const updateData: Record<string, unknown> = {};
  const fields = ['subject', 'dueDate', 'priority', 'status', 'taskType', 'description',
    'repeat', 'reminder', 'linkedLeadId', 'linkedDealId', 'linkedContactId', 'ownerId'];

  for (const f of fields) {
    if (body[f] !== undefined) {
      if (f === 'dueDate') updateData[f] = new Date(body[f]);
      else updateData[f] = body[f] || null;
    }
  }

  // Keep required fields
  if (updateData.subject === null) delete updateData.subject;
  if (updateData.ownerId === null) delete updateData.ownerId;
  if (body.status !== undefined) updateData.status = body.status;

  // Track completion
  if (body.status === 'completed' && existing.status !== 'completed') {
    updateData.completedAt = new Date();
  }

  const task = await prisma.task.update({
    where: { id },
    data: updateData,
    include: { owner: { select: { id: true, name: true, email: true } } },
  });

  return Response.json(task);
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
  const existing = await prisma.task.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return Response.json({ error: 'Task not found' }, { status: 404 });
  if (existing.taskType === 'personal' && existing.ownerId !== session.user.id) {
    return Response.json({ error: 'Cannot delete another user\'s personal task' }, { status: 403 });
  }

  await prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
  return Response.json({ success: true });
}
