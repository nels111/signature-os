export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  const calendarType = url.searchParams.get('calendarType') || '';

  const where: Record<string, unknown> = { deletedAt: null };

  if (start && end) {
    where.startDate = { gte: new Date(start) };
    where.endDate = { lte: new Date(end) };
  }

  if (calendarType === 'personal') {
    where.calendarType = 'personal';
    where.ownerId = session.user.id;
  } else if (calendarType === 'shared') {
    where.calendarType = 'shared';
  } else {
    // Show all: shared events + user's personal events
    where.OR = [
      { calendarType: 'shared' },
      { calendarType: 'personal', ownerId: session.user.id },
    ];
    delete where.deletedAt;
    where.AND = [{ deletedAt: null }];
  }

  const events = await prisma.calendarEvent.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true } },
      invites: { include: { invitee: { select: { id: true, name: true } } } },
    },
    orderBy: { startDate: 'asc' },
  });

  // Also fetch tasks with due dates in range for calendar rendering
  const taskWhere: Record<string, unknown> = { deletedAt: null, status: { not: 'completed' } };
  if (start && end) {
    taskWhere.dueDate = { gte: new Date(start), lte: new Date(end) };
  }

  const tasks = await prisma.task.findMany({
    where: taskWhere,
    select: { id: true, subject: true, dueDate: true, priority: true, status: true, taskType: true },
    orderBy: { dueDate: 'asc' },
  });

  return Response.json({ events, tasks });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  if (!body.title || !body.startDate || !body.endDate) {
    return Response.json({ error: 'title, startDate, and endDate are required' }, { status: 400 });
  }

  const event = await prisma.calendarEvent.create({
    data: {
      title: body.title,
      eventType: body.eventType || 'meeting',
      calendarType: body.calendarType || 'shared',
      allDay: body.allDay || false,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      notes: body.notes || null,
      repeat: body.repeat || null,
      alerts: body.alerts || null,
      ownerId: session.user.id,
    },
    include: {
      owner: { select: { id: true, name: true } },
      invites: { include: { invitee: { select: { id: true, name: true } } } },
    },
  });

  return Response.json(event, { status: 201 });
}
