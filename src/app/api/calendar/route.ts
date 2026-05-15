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

  // Require a bounded date range to prevent unbounded reads.
  // If caller omits one, default to a 90-day window (60 days back, 30 forward).
  const now = Date.now();
  const startDateBound = start ? new Date(start) : new Date(now - 60 * 24 * 60 * 60 * 1000);
  const endDateBound = end ? new Date(end) : new Date(now + 30 * 24 * 60 * 60 * 1000);

  // Cap the window at 366 days to prevent abuse.
  const MAX_WINDOW_MS = 366 * 24 * 60 * 60 * 1000;
  if (endDateBound.getTime() - startDateBound.getTime() > MAX_WINDOW_MS) {
    return Response.json({ error: 'Date range exceeds 366 days' }, { status: 400 });
  }

  const where: Record<string, unknown> = { deletedAt: null };

  // Overlap: event starts before range ends AND event ends after range starts
  where.startDate = { lte: endDateBound };
  where.endDate = { gte: startDateBound };

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
  const taskWhere: Record<string, unknown> = {
    deletedAt: null,
    status: { not: 'completed' },
    OR: [
      { taskType: { not: 'personal' } },
      { taskType: 'personal', ownerId: session.user.id },
    ],
  };
  taskWhere.dueDate = { gte: startDateBound, lte: endDateBound };

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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.title || !body.startDate || !body.endDate) {
    return Response.json({ error: 'title, startDate, and endDate are required' }, { status: 400 });
  }

  const event = await prisma.calendarEvent.create({
    data: {
      title: body.title as string,
      eventType: (body.eventType as never) || 'meeting',
      calendarType: (body.calendarType as never) || 'shared',
      allDay: (body.allDay as boolean) || false,
      startDate: new Date(body.startDate as string),
      endDate: new Date(body.endDate as string),
      notes: (body.notes as string) || null,
      repeat: (body.repeat as never) || null,
      alerts: (body.alerts as never) || null,
      ownerId: session.user.id,
    },
    include: {
      owner: { select: { id: true, name: true } },
      invites: { include: { invitee: { select: { id: true, name: true } } } },
    },
  });

  return Response.json(event, { status: 201 });
}
