export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendEmail, getSmtpConfig } from '@/lib/smtp';
import { generateICalInvite } from '@/lib/ical';

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
  if (event.calendarType === 'personal' && event.ownerId !== session.user.id) {
    return Response.json({ error: 'Event not found' }, { status: 404 });
  }

  const externalInvites = await prisma.$queryRaw<Array<{ id: string; eventId: string; email: string; name: string | null; status: string }>>`
    SELECT id, "eventId", email, name, status FROM calendar_external_invites WHERE "eventId" = ${id}
  `;

  return Response.json({ ...event, externalInvites });
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

  const existing = await prisma.calendarEvent.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return Response.json({ error: 'Event not found' }, { status: 404 });
  if (existing.ownerId !== session.user.id) {
    return Response.json({ error: 'Only the event owner can edit' }, { status: 403 });
  }

  const updateData: Record<string, unknown> = {};
  const fields = ['title', 'eventType', 'calendarType', 'allDay', 'startDate', 'endDate', 'notes', 'location', 'repeat', 'alerts'];
  for (const f of fields) {
    if (body[f] !== undefined) {
      if (f === 'startDate' || f === 'endDate') updateData[f] = new Date(body[f] as string | number | Date);
      else updateData[f] = body[f];
    }
  }

  // Sync internal participants
  if (Array.isArray(body.participantIds)) {
    const incoming = (body.participantIds as string[]).filter((pid) => pid !== existing.ownerId);
    const current = await prisma.calendarInvite.findMany({ where: { eventId: id }, select: { inviteeId: true } });
    const currentIds = current.map((c) => c.inviteeId);
    const toAdd = incoming.filter((pid) => !currentIds.includes(pid));
    const toRemove = currentIds.filter((pid) => !incoming.includes(pid));
    if (toRemove.length > 0) {
      await prisma.calendarInvite.deleteMany({ where: { eventId: id, inviteeId: { in: toRemove } } });
    }
    if (toAdd.length > 0) {
      await prisma.calendarInvite.createMany({
        data: toAdd.map((inviteeId) => ({ eventId: id, inviteeId, status: 'pending' as never })),
        skipDuplicates: true,
      });
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

  // Sync external participants: send invites to new ones, remove deleted ones
  if (Array.isArray(body.externalParticipants)) {
    const incoming = (body.externalParticipants as Array<{ email: string; name?: string }>)
      .filter(p => p.email && p.email.includes('@'))
      .map(p => ({ ...p, email: p.email.toLowerCase() }));

    const currentExt = await prisma.$queryRaw<Array<{ email: string }>>`
      SELECT email FROM calendar_external_invites WHERE "eventId" = ${id}
    `;
    const currentEmails = currentExt.map(e => e.email);
    const incomingEmails = incoming.map(p => p.email);

    // Remove external invites no longer in the list
    const toRemoveEmails = currentEmails.filter(e => !incomingEmails.includes(e));
    if (toRemoveEmails.length > 0) {
      await prisma.$executeRaw`
        DELETE FROM calendar_external_invites WHERE "eventId" = ${id} AND email = ANY(${toRemoveEmails}::text[])
      `;
    }

    // Send invites to new external participants
    const toAdd = incoming.filter(p => !currentEmails.includes(p.email));
    if (toAdd.length > 0) {
      const updatedEvent = {
        id: event.id,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        allDay: event.allDay,
        notes: event.notes,
      };
      await sendExternalInvites(updatedEvent, toAdd, session.user.name ?? 'Signature Cleans');
    }
  }

  const externalInvites = await prisma.$queryRaw<Array<{ id: string; eventId: string; email: string; name: string | null; status: string }>>`
    SELECT id, "eventId", email, name, status FROM calendar_external_invites WHERE "eventId" = ${id}
  `;

  return Response.json({ ...event, externalInvites });
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

// ── Helpers ──────────────────────────────────────────────────────────────────

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
              <p style="margin:20px 0 0;color:#6b7280;font-size:12px;">Open this email in your email client to accept or decline. The attached .ics file will add the event to your calendar.</p>
            </div>
            <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="color:#9ca3af;font-size:11px;margin:0;">Signature Cleans · PEACE OF MIND, EVERY TIME</p>
            </div>
          </div>
        `,
        icalContent: icsContent,
        icalMethod: 'REQUEST',
      });

      await prisma.$executeRaw`
        INSERT INTO calendar_external_invites ("eventId", email, name, status, "sentAt")
        VALUES (${event.id}, ${p.email.toLowerCase()}, ${p.name ?? null}, 'pending', NOW())
        ON CONFLICT ("eventId", email) DO UPDATE SET status = 'pending', "sentAt" = NOW()
      `;
    } catch (err) {
      console.error(`Failed to send invite to ${p.email}:`, err);
      await prisma.$executeRaw`
        INSERT INTO calendar_external_invites ("eventId", email, name, status)
        VALUES (${event.id}, ${p.email.toLowerCase()}, ${p.name ?? null}, 'pending')
        ON CONFLICT ("eventId", email) DO NOTHING
      `;
    }
  }
}
