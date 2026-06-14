export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isAdmin } from '@/lib/authz';
import type { TaskStatus } from '@prisma/client';
import { notifyTaskAssigned } from '@/lib/notifications';
import { sendPushToUser } from '@/lib/push';

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
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const existing = await prisma.task.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return Response.json({ error: 'Task not found' }, { status: 404 });
  // Only owner can edit personal tasks
  if (existing.taskType === 'personal' && existing.ownerId !== session.user.id) {
    return Response.json({ error: 'Cannot edit another user\'s personal task' }, { status: 403 });
  }

  const adminCaller = isAdmin(session);

  const updateData: Record<string, unknown> = {};

  // Special action: toggleDone — atomic flip with previousStatus tracking
  if (body.toggleDone === true) {
    if (existing.status === 'completed') {
      // Restore previous status (default not_started)
      const restore: TaskStatus = (existing.previousStatus ?? 'not_started') as TaskStatus;
      updateData.status = restore;
      updateData.previousStatus = null;
      updateData.completedAt = null;
    } else {
      // Mark complete, remember previous status for undo
      updateData.status = 'completed';
      updateData.previousStatus = existing.status;
      updateData.completedAt = new Date();
    }
  } else {
    const fields = ['subject', 'dueDate', 'priority', 'status', 'taskType', 'description', 'location',
      'repeat', 'reminder', 'linkedLeadId', 'linkedDealId', 'linkedContactId',
      ...(adminCaller ? ['ownerId'] : [])];

    for (const f of fields) {
      if (body[f] !== undefined) {
        if (f === 'dueDate') updateData[f] = new Date(body[f] as string | number | Date);
        else updateData[f] = body[f] || null;
      }
    }

    // Keep required fields
    if (updateData.subject === null) delete updateData.subject;
    if (updateData.ownerId === null) delete updateData.ownerId;
    if (body.status !== undefined) updateData.status = body.status;

    // Track completion transitions when explicit status sent
    if (body.status === 'completed' && existing.status !== 'completed') {
      updateData.completedAt = new Date();
      updateData.previousStatus = existing.status;
    } else if (body.status && body.status !== 'completed' && existing.status === 'completed') {
      // Manually moving away from completed: clear completedAt + previousStatus
      updateData.completedAt = null;
      updateData.previousStatus = null;
    }
  }

  const task = await prisma.task.update({
    where: { id },
    data: updateData,
    include: { owner: { select: { id: true, name: true, email: true } } },
  });

  // Notify new assignee if ownerId changed to a different person
  const newOwnerId = updateData.ownerId as string | undefined;
  if (
    newOwnerId &&
    newOwnerId !== existing.ownerId &&
    newOwnerId !== session.user.id
  ) {
    const taskLabel = (updateData.subject ?? existing.subject) as string;
    Promise.allSettled([
      notifyTaskAssigned({
        assigneeUserId: newOwnerId,
        actorUserId: session.user.id,
        taskId: task.id,
        taskTitle: taskLabel,
      }),
      sendPushToUser(newOwnerId, {
        title: 'Task assigned to you',
        body: taskLabel,
        icon: '/icon-192.png',
        url: `/dashboard/tasks/${task.id}`,
        tag: `task-assigned-${task.id}`,
      }),
    ]).catch(err => console.error('[tasks] reassignment notification error', err));
  }

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
