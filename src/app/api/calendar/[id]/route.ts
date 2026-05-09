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
  const event = await prisma.calendarEvent.findFirst({
    where: { id, deletedAt: null },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      invites: { include: { invitee: { select: { id: true, name: true, email: true } } } },
    },
  });

  if (!event) return Response.json({ error: 'Event not found' }, { status: 404 });
  // Personal events only visible to owner
  if (event.calendarType === 'personal' && event.ownerId !== session.user.id) {
    return Response.json({ error: 'Event not found' }, { status: 404 });
  }
  return Response.json(event);
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

  const existing = await prisma.calendarEvent.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return Response.json({ error: 'Event not found' }, { status: 404 });
  if (existing.ownerId !== session.user.id) {
    return Response.json({ error: 'Only the event owner can edit' }, { status: 403 });
  }

  const updateData: Record<string, unknown> = {};
  const fields = ['title', 'eventType', 'calendarType', 'allDay', 'startDate', 'endDate', 'notes', 'repeat', 'alerts'];
  for (const f of fields) {
    if (body[f] !== undefined) {
      if (f === 'startDate' || f === 'endDate') updateData[f] = new Date(body[f]);
      else updateData[f] = body[f];
    }
  }

  const event = await prisma.calendarEvent.update({
    where: { id },
    data: updateData,
    include: {
      owner: { select: { id: true, name: true } },
      invites: { include: { invitee: { select: { id: true, name: true } } } },
    },
  });

  return Response.json(event);
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
  const existing = await prisma.calendarEvent.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return Response.json({ error: 'Event not found' }, { status: 404 });
  if (existing.ownerId !== session.user.id) {
    return Response.json({ error: 'Only the event owner can delete' }, { status: 403 });
  }

  await prisma.calendarEvent.update({ where: { id }, data: { deletedAt: new Date() } });
  return Response.json({ success: true });
}
