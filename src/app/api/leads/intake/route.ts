export const runtime = 'nodejs';

import { prisma } from '@/lib/db';
import { notify } from '@/lib/notifications';
import { sendTwilioWhatsapp } from '@/lib/twilio-wa';
import {
  OWNER_USER_ID as INTAKE_OWNER_ID,
  SECONDARY_USER_ID as NICK_USER_ID,
  OWNER_WA_NUMBER as NELSON_WA,
  SECONDARY_WA_NUMBER as NICK_WA,
} from '@/lib/owner-config';

/**
 * Public website lead intake.
 *
 * Auth: API key ONLY. Middleware sets `x-api-auth: true` when the request
 * carries `Authorization: Bearer ${API_KEY}` (and exempts it from the CSRF/Origin
 * check), which is what a server-to-server POST from the marketing website needs.
 * This route intentionally does NOT require a next-auth session, unlike the
 * internal POST /api/leads.
 *
 * POST /api/leads/intake
 * Body: { name, company, email?, phone?, service?, message? }
 * Creates a Lead with source 'website', stage 'new_lead'.
 *
 * Added 2026-06-08 to wire the new WordPress contact form into SigOS (replaces Zoho).
 */

// Website leads are assigned to OWNER_USER_ID by default (ownerId is a required FK).
// All identities come from env via owner-config — no hardcoded UUIDs/numbers.

export async function POST(request: Request) {
  // API-key path only (mirrors /api/notifications/scheduler).
  if (request.headers.get('x-api-auth') !== 'true') {
    return Response.json({ error: 'API key required' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const name = str(body.name);
  const company = str(body.company);
  const email = str(body.email);
  const phone = str(body.phone);
  const service = str(body.service);
  const message = str(body.message);

  // Need at least something identifiable. companyName is non-null in the schema.
  if (!name && !company && !email && !phone) {
    return Response.json({ error: 'A name, company, email or phone is required' }, { status: 400 });
  }

  // No dedicated columns for service/message on Lead → fold into notes.
  const noteParts: string[] = [];
  if (service) noteParts.push(`Service: ${service}`);
  if (message) noteParts.push(`Message: ${message}`);
  noteParts.push('Submitted via website contact form.');
  const notes = noteParts.join('\n');

  try {
    const lead = await prisma.lead.create({
      data: {
        companyName: company || name || 'Website enquiry',
        contactName: name || null,
        email: email || null,
        phone: phone || null,
        source: 'website',
        stage: 'new_lead',
        ownerId: INTAKE_OWNER_ID,
        notes,
      },
    });

    // Alert Nelson + Nick: in-app notification + phone push + SMS text. Best-effort —
    // a notification failure must never fail the intake (the lead is already saved).
    const label = `${lead.companyName}${lead.contactName ? ` (${lead.contactName})` : ''}`;
    try {
      for (const uid of [INTAKE_OWNER_ID, NICK_USER_ID]) {
        // notify() sends the bell entry AND the matching deep-linked push.
        await notify({
          userId: uid,
          type: 'lead_assigned',
          title: 'New website lead',
          message: label,
          entityType: 'lead',
          entityId: lead.id,
        }).catch(() => {});
      }
      // SMS text to Nelson + Nick.
      const smsLines = [`New website lead: ${label}`];
      if (phone) smsLines.push(`Tel: ${phone}`);
      if (email) smsLines.push(email);
      if (service) smsLines.push(`Service: ${service}`);
      smsLines.push('Follow up in SigOS.');
      const smsMsg = smsLines.join('\n');
      await sendTwilioWhatsapp(NELSON_WA, smsMsg).catch(() => {});
      if (NICK_WA) await sendTwilioWhatsapp(NICK_WA, smsMsg).catch(() => {});
    } catch (notifyErr) {
      console.error('[leads/intake] notify/push/sms failed (lead still created):', notifyErr);
    }

    return Response.json({ ok: true, id: lead.id }, { status: 201 });
  } catch (err) {
    console.error('[leads/intake] create failed:', err);
    return Response.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}
