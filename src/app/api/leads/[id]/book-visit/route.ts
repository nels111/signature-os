export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendEmail, getSmtpConfig } from '@/lib/smtp';
import { sendPushToAdminAndSales } from '@/lib/push';
import { NextResponse } from 'next/server';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = days[d.getDay()];
  const date = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${date} ${month} ${year} at ${hours}:${mins}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: leadId } = await params;

  let body: {
    startDate: string;
    endDate: string;
    location?: string;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.startDate || !body.endDate) {
    return NextResponse.json({ error: 'startDate and endDate required' }, { status: 400 });
  }

  // Load the lead
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
    include: { owner: { select: { id: true, name: true } } },
  });
  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  // Find Nick (first sales user) — calendar event owner
  const salesUser = await prisma.user.findFirst({
    where: { role: 'sales' },
    select: { id: true, name: true },
  });

  // Booked by this session user
  const bookedByUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true },
  });

  const eventOwner = salesUser ?? bookedByUser;
  if (!eventOwner) {
    return NextResponse.json({ error: 'No event owner found' }, { status: 500 });
  }

  const eventTitle = `Site Visit: ${lead.companyName}`;
  const notesText = [
    body.location ? `Location: ${body.location}` : null,
    `Booked by: ${bookedByUser?.name ?? 'Unknown'}`,
    body.notes ? `Notes: ${body.notes}` : null,
  ].filter(Boolean).join('\n');

  // 1. Create calendar event (owned by Nick/sales user)
  const calendarEvent = await prisma.calendarEvent.create({
    data: {
      title: eventTitle,
      eventType: 'site_survey',
      calendarType: 'shared',
      allDay: false,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      notes: notesText || null,
      ownerId: eventOwner.id,
    },
  });

  // If event owner is not the session user, invite the session user too
  if (eventOwner.id !== session.user.id) {
    await prisma.calendarInvite.create({
      data: {
        eventId: calendarEvent.id,
        inviteeId: session.user.id,
        status: 'accepted', // VA who booked it — auto-accept
      },
    }).catch(() => {}); // Non-fatal if VA is already in some invite
  }

  // 2. Update lead stage to meeting_scheduled
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      stage: 'meeting_scheduled',
      stageChangedAt: new Date(),
    },
  });

  // 3. Log activity
  await prisma.activity.create({
    data: {
      activityType: 'meeting',
      description: `Site visit booked for ${lead.companyName} — ${formatDateTime(body.startDate)}${body.location ? ` at ${body.location}` : ''}`,
      metadata: {
        calendarEventId: calendarEvent.id,
        startDate: body.startDate,
        endDate: body.endDate,
        location: body.location ?? null,
        bookedBy: bookedByUser?.name ?? session.user.id,
        notes: body.notes ?? null,
      },
      userId: session.user.id,
      entityType: 'lead',
      entityId: leadId,
    },
  });

  // 4. Send email to hello@ (fire-and-forget, non-fatal)
  const notifEmail = process.env.NOTIFICATION_EMAIL ?? 'hello@signature-cleans.co.uk';
  const helloPassword = process.env.HELLO_MAILBOX_PASSWORD;
  if (helloPassword) {
    const smtpConfig = getSmtpConfig(notifEmail, helloPassword);
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0f1419; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 0;">Site Visit Booked</p>
        </div>
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 130px;">Company</td><td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #111827;">${lead.companyName}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Contact</td><td style="padding: 8px 0; font-size: 14px; color: #111827;">${lead.contactName}</td></tr>
            ${lead.phone ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Phone</td><td style="padding: 8px 0; font-size: 14px; color: #111827;">${lead.phone}</td></tr>` : ''}
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date &amp; Time</td><td style="padding: 8px 0; font-size: 14px; color: #111827;">${formatDateTime(body.startDate)}</td></tr>
            ${body.location ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Location</td><td style="padding: 8px 0; font-size: 14px; color: #111827;">${body.location}</td></tr>` : ''}
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Booked by</td><td style="padding: 8px 0; font-size: 14px; color: #111827;">${bookedByUser?.name ?? 'Unknown'}</td></tr>
            ${body.notes ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; vertical-align: top;">Notes</td><td style="padding: 8px 0; font-size: 14px; color: #111827;">${body.notes}</td></tr>` : ''}
          </table>
          <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
            <a href="${process.env.NEXTAUTH_URL}/dashboard/leads/${leadId}" style="background: #1a56db; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">View Lead</a>
          </div>
        </div>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">Signature Cleans OS</p>
      </div>
    `;
    sendEmail(smtpConfig, {
      from: process.env.NOTIFICATION_EMAIL_FROM ?? `Signature Cleans OS <${notifEmail}>`,
      to: notifEmail,
      subject: `Site Visit Booked: ${lead.companyName} — ${formatDateTime(body.startDate)}`,
      html: emailHtml,
      text: `Site visit booked for ${lead.companyName}.\n\nDate: ${formatDateTime(body.startDate)}\nContact: ${lead.contactName}${lead.phone ? `\nPhone: ${lead.phone}` : ''}${body.location ? `\nLocation: ${body.location}` : ''}\nBooked by: ${bookedByUser?.name ?? 'Unknown'}${body.notes ? `\nNotes: ${body.notes}` : ''}\n\nView: ${process.env.NEXTAUTH_URL}/dashboard/leads/${leadId}`,
    }).catch((err) => console.error('Site visit email failed:', err));
  }

  // 5. Send web push to all admin + sales users (fire-and-forget)
  sendPushToAdminAndSales({
    title: 'Site Visit Booked',
    body: `${lead.companyName} — ${formatDateTime(body.startDate)}${body.location ? ` · ${body.location}` : ''}`,
    icon: '/icon-192.png',
    url: `/dashboard/leads/${leadId}`,
    tag: `site-visit-${leadId}`,
  }).catch((err) => console.error('Push notification failed:', err));

  return NextResponse.json({ ok: true, calendarEventId: calendarEvent.id });
}
