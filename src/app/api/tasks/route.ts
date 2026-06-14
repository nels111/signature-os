export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { resolveOwnerIdOnCreate } from '@/lib/authz';
import { notifyTaskAssigned } from '@/lib/notifications';
import { sendPushToUser } from '@/lib/push';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
  const search = url.searchParams.get('search') || '';
  const sortBy = url.searchParams.get('sortBy') || 'dueDate';
  const sortDir = url.searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc';
  const status = url.searchParams.get('status') || '';
  const priority = url.searchParams.get('priority') || '';
  const taskType = url.searchParams.get('taskType') || '';

  const allowedSortFields = ['subject', 'dueDate', 'priority', 'status', 'taskType', 'createdAt'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'dueDate';


  const where: Record<string, unknown> = { deletedAt: null };

  // Strict per-user visibility: you only ever see tasks assigned to you.
  // No admin cross-view — a user's tasks never appear in anyone else's list.
  where.ownerId = session.user.id;

  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (taskType) {
    if (taskType === 'NOT_personal') {
      where.taskType = { not: 'personal' };
    } else {
      where.taskType = taskType;
    }
  }
  if (search) {
    where.OR = [
      { subject: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: { owner: { select: { id: true, name: true, email: true } } },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [safeSortBy]: sortDir },
    }),
    prisma.task.count({ where }),
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

  if (!body.subject || !body.dueDate) {
    return Response.json({ error: 'subject and dueDate are required' }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      subject: body.subject as string,
      ownerId: resolveOwnerIdOnCreate(session, body.ownerId),
      dueDate: new Date(body.dueDate as string),
      priority: (body.priority as never) || 'normal',
      status: (body.status as never) || 'not_started',
      taskType: (body.taskType as never) || 'business',
      description: (body.description as string) || null,
      location: (body.location as string) || null,
      repeat: (body.repeat as never) || null,
      reminder: (body.reminder as never) || null,
      linkedLeadId: (body.linkedLeadId as string) || null,
      linkedDealId: (body.linkedDealId as string) || null,
      linkedContactId: (body.linkedContactId as string) || null,
    },
    include: { owner: { select: { id: true, name: true, email: true } } },
  });

  // If the task was assigned to someone other than the creator, notify them.
  const assigneeId = task.ownerId;
  if (assigneeId && assigneeId !== session.user.id) {
    const taskLabel = task.subject;
    Promise.allSettled([
      notifyTaskAssigned({
        assigneeUserId: assigneeId,
        actorUserId: session.user.id,
        taskId: task.id,
        taskTitle: taskLabel,
      }),
      sendPushToUser(assigneeId, {
        title: 'Task assigned to you',
        body: taskLabel,
        icon: '/icon-192.png',
        url: `/dashboard/tasks/${task.id}`,
        tag: `task-assigned-${task.id}`,
      }),
    ]).catch(err => console.error('[tasks] assignment notification error', err));
  }

  return Response.json(task, { status: 201 });
}
