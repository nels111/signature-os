export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(
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

  if (!body.inviteeId) {
    return Response.json({ error: 'inviteeId is required' }, { status: 400 });
  }

  const event = await prisma.calendarEvent.findFirst({ where: { id, deletedAt: null } });
  if (!event) return Response.json({ error: 'Event not found' }, { status: 404 });
  if (event.ownerId !== session.user.id) {
    return Response.json({ error: 'Only the event owner can invite' }, { status: 403 });
  }

  const invite = await prisma.calendarInvite.create({
    data: {
      eventId: id,
      inviteeId: body.inviteeId as string,
      status: 'pending',
    },
    include: { invitee: { select: { id: true, name: true } } },
  });

  return Response.json(invite, { status: 201 });
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

  if (!body.status || !['accepted', 'declined'].includes(body.status as string)) {
    return Response.json({ error: 'status must be accepted or declined' }, { status: 400 });
  }

  // Find invite for this event where the current user is the invitee
  const invite = await prisma.calendarInvite.findFirst({
    where: { eventId: id, inviteeId: session.user.id },
  });

  if (!invite) return Response.json({ error: 'Invite not found' }, { status: 404 });

  const updated = await prisma.calendarInvite.update({
    where: { id: invite.id },
    data: { status: body.status as never, respondedAt: new Date() },
    include: { invitee: { select: { id: true, name: true } } },
  });

  return Response.json(updated);
}
