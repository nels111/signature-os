export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendEmail, getSmtpConfig } from '@/lib/smtp';
import { generateICalInvite } from '@/lib/ical';
import { expandRecurringEvent } from '@/lib/recurring';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  const calendarType = url.searchParams.get('calendarType') || '';

  const now = Date.now();
  const startDateBound = start ? new Date(start) : new Date(now - 60 * 24 * 60 * 60 * 1000);
  const endDateBound = end ? new Date(end) : new Date(now + 30 * 24 * 60 * 60 * 1000);

  const MAX_WINDOW_MS = 366 * 24 * 60 * 60 * 1000;
  if (endDateBound.getTime() - startDateBound.getTime() > MAX_WINDOW_MS) {
    return Response.json({ error: 'Date range exceeds 366 days' }, { status: 400 });
  }

  const where: Record<string, unknown> = { deletedAt: null };
  // Fetch events starting before end of range.
  // For recurring events we drop the endDate lower-bound (handled in memory).
  where.startDate = { lte: endDateBound };

  // Participant-only visibility: a user only sees an event if they OWN it or
  // are invited to it (a participant) — this applies even to 'shared' events.
  const visibility = [
    { ownerId: session.user.id },
    { invites: { some: { inviteeId: session.user.id } } },
  ];
  if (calendarType === 'personal') {
    where.calendarType = 'personal';
    where.ownerId = session.user.id;
  } else if (calendarType === 'shared') {
    where.calendarType = 'shared';
    where.OR = visibility;
  } else {
    where.OR = visibility;
  }

  const events = await prisma.calendarEvent.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true } },
      invites: { include: { invitee: { select: { id: true, name: true } } } },
    },
    orderBy: { startDate: 'asc' },
  });

  // Attach external invites via raw SQL (not in Prisma schema)
  const eventIds = events.map(e => e.id);
  const externalInvites = eventIds.length > 0
    ? await prisma.$queryRaw<Array<{ id: string; eventId: string; email: string; name: string | null; status: string }>>`
        SELECT id, "eventId", email, name, status FROM calendar_external_invites
        WHERE "eventId" = ANY(${eventIds}::text[])
      `
    : [];

  const extByEvent = new Map<string, typeof externalInvites>();
  for (const ei of externalInvites) {
    if (!extByEvent.has(ei.eventId)) extByEvent.set(ei.eventId, []);
    extByEvent.get(ei.eventId)!.push(ei);
  }

  const baseEventsWithExt = events.map(e => ({
    ...e,
    externalInvites: extByEvent.get(e.id) ?? [],
  }));

  // Expand recurring events and filter non-recurring to range
  const eventsWithExt: typeof baseEventsWithExt = [];
  for (const ev of baseEventsWithExt) {
    if (!ev.repeat) {
      // Non-recurring: include only if it actually overlaps with the range
      if (ev.endDate >= startDateBound) eventsWithExt.push(ev);
    } else {
      // Recurring: generate all occurrences within range
      const occurrences = expandRecurringEvent(ev, startDateBound, endDateBound);
      eventsWithExt.push(...occurrences);
    }
  }
  eventsWithExt.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

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

  return Response.json({ events: eventsWithExt, tasks });
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

  const participantIds = Array.isArray(body.participantIds)
    ? (body.participantIds as string[]).filter((id) => id !== session.user.id)
    : [];

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
      invites: participantIds.length > 0
        ? { create: participantIds.map((inviteeId) => ({ inviteeId, status: 'pending' as never })) }
        : undefined,
    },
    include: {
      owner: { select: { id: true, name: true } },
      invites: { include: { invitee: { select: { id: true, name: true } } } },
    },
  });

  // Handle external participants
  const externalParticipants = Array.isArray(body.externalParticipants)
    ? (body.externalParticipants as Array<{ email: string; name?: string }>)
        .filter(p => p.email && p.email.includes('@'))
    : [];

  if (externalParticipants.length > 0) {
    await sendExternalInvites(event, externalParticipants, session.user.name ?? 'Signature Cleans');
  }

  const externalInvites = await prisma.$queryRaw<Array<{ id: string; eventId: string; email: string; name: string | null; status: string }>>`
    SELECT id, "eventId", email, name, status FROM calendar_external_invites WHERE "eventId" = ${event.id}
  `;

  return Response.json({ ...event, externalInvites }, { status: 201 });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
// expandRecurringEvent is imported from @/lib/recurring

async function sendExternalInvites(
  event: { id: string; title: string; startDate: Date; endDate: Date; allDay: boolean; notes: string | null },
  participants: Array<{ email: string; name?: string }>,
  organiserName: string
) {
  const smtpConfig = getSmtpConfig(
    'hello@signature-cleans.co.uk',
    process.env.HELLO_MAILBOX_PASSWORD!
  );

  const icsContent = generateICalInvite({
    uid: event.id,
    title: event.title,
    startDate: event.startDate,
    endDate: event.endDate,
    allDay: event.allDay,
    notes: event.notes,
    organiserName,
    organiserEmail: 'hello@signature-cleans.co.uk',
    attendees: participants.map(p => ({ email: p.email, name: p.name, partstat: 'NEEDS-ACTION' })),
    method: 'REQUEST',
  });

  const startStr = event.startDate.toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr = event.allDay ? 'All day' : `${event.startDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} – ${event.endDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

  const rows: string[] = [];
  for (const p of participants) {
    try {
      await sendEmail(smtpConfig, {
        from: `${organiserName} via Signature Cleans <hello@signature-cleans.co.uk>`,
        to: p.email,
        replyTo: 'hello@signature-cleans.co.uk',
        subject: `Invitation: ${event.title}`,
        text: `You have been invited to: ${event.title}\n\nDate: ${startStr}\nTime: ${timeStr}${event.notes ? `\nLocation: ${event.notes}` : ''}\n\nOrganised by ${organiserName} at Signature Cleans.\n\nPlease accept or decline this invitation using your calendar application.`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f9fafb;border-radius:12px;overflow:hidden;">
            <div style="background:#1e40af;padding:24px 28px;">
              <p style="color:#93c5fd;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.05em;">Calendar Invitation</p>
              <h1 style="color:#ffffff;font-size:20px;margin:0;">${event.title}</h1>
            </div>
            <div style="padding:24px 28px;background:#ffffff;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:80px;">Date</td><td style="padding:6px 0;color:#111827;font-size:13px;font-weight:500;">${startStr}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Time</td><td style="padding:6px 0;color:#111827;font-size:13px;font-weight:500;">${timeStr}</td></tr>
                ${event.notes ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Location</td><td style="padding:6px 0;color:#111827;font-size:13px;font-weight:500;">${event.notes}</td></tr>` : ''}
                <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Organiser</td><td style="padding:6px 0;color:#111827;font-size:13px;font-weight:500;">${organiserName}</td></tr>
              </table>
              <p style="margin:20px 0 0;color:#6b7280;font-size:12px;">Open this email in your email client to accept or decline this invitation. The .ics file attached will add the event to your calendar automatically.</p>
            </div>
            <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="color:#9ca3af;font-size:11px;margin:0;">Signature Cleans · PEACE OF MIND, EVERY TIME</p>
            </div>
          </div>
        `,
        icalContent: icsContent,
        icalMethod: 'REQUEST',
      });

      rows.push(p.email);
      await prisma.$executeRaw`
        INSERT INTO calendar_external_invites ("eventId", email, name, status, "sentAt")
        VALUES (${event.id}, ${p.email.toLowerCase()}, ${p.name ?? null}, 'pending', NOW())
        ON CONFLICT ("eventId", email) DO UPDATE SET status = 'pending', "sentAt" = NOW()
      `;
    } catch (err) {
      console.error(`Failed to send invite to ${p.email}:`, err);
      // Still record the invite even if email failed
      await prisma.$executeRaw`
        INSERT INTO calendar_external_invites ("eventId", email, name, status)
        VALUES (${event.id}, ${p.email.toLowerCase()}, ${p.name ?? null}, 'pending')
        ON CONFLICT ("eventId", email) DO NOTHING
      `;
    }
  }

  return rows;
}
