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
  const sortBy = url.searchParams.get('sortBy') || 'dueDate';
  const sortDir = url.searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc';
  const status = url.searchParams.get('status') || '';
  const priority = url.searchParams.get('priority') || '';
  const taskType = url.searchParams.get('taskType') || '';
  const ownerId = url.searchParams.get('ownerId') || '';

  const allowedSortFields = ['subject', 'dueDate', 'priority', 'status', 'taskType', 'createdAt'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'dueDate';

  const where: Record<string, unknown> = { deletedAt: null };
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (taskType) where.taskType = taskType;
  if (ownerId) where.ownerId = ownerId;
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

  const body = await request.json();

  if (!body.subject || !body.dueDate) {
    return Response.json({ error: 'subject and dueDate are required' }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      subject: body.subject,
      ownerId: body.ownerId || session.user.id,
      dueDate: new Date(body.dueDate),
      priority: body.priority || 'normal',
      status: body.status || 'not_started',
      taskType: body.taskType || 'business',
      description: body.description || null,
      repeat: body.repeat || null,
      reminder: body.reminder || null,
      linkedLeadId: body.linkedLeadId || null,
      linkedDealId: body.linkedDealId || null,
      linkedContactId: body.linkedContactId || null,
    },
    include: { owner: { select: { id: true, name: true, email: true } } },
  });

  return Response.json(task, { status: 201 });
}
