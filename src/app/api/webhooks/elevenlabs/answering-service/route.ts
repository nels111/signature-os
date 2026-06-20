export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateElevenLabsRequest, shouldSkipElevenLabsValidation } from '@/lib/elevenlabs-verify';
import { parseAnsweringServicePayload, resolvedPhone, type InboundCallData } from '@/lib/inbound-call/parse';
import { decideRoute, phoneDigits, normEmail, type InboundRoute } from '@/lib/inbound-call/routing';
import { notify } from '@/lib/notifications';
import { sendSms } from '@/lib/twilio-sms';

/**
 * POST /api/webhooks/elevenlabs/answering-service
 *
 * Inbound capture for the 24/7 ElevenLabs answering agent ("Jasmine").
 *
 * Smart routing (Nelson's rule):
 *  - Caller already known (existing lead / client / contact) → FLAG only.
 *    No duplicate lead. Alert Nelson + Nick (bell + push + SMS).
 *  - New enquiry → create a Lead in the LEADS module (source `inbound_call`,
 *    stage `new_lead`, callStatus null so it NEVER enters the cold-calling
 *    queue). Alert Nelson + Nick (bell + push + SMS).
 *
 * Guardrail: capture + alert only. We never auto-email or call the caller back.
 */

const NELSON_ID = process.env.AGENT_OWNER_USER_ID || '';
const NICK_ID = process.env.AGENT_SECONDARY_USER_ID || '';
const NELSON_SMS = process.env.NELSON_WA_NUMBER || '';
const NICK_SMS = process.env.NICK_WA_NUMBER || '';

const STAFF_USER_IDS = [NELSON_ID, NICK_ID].filter(Boolean);
// SMS recipients. Defaults to both; set ANSWERING_SMS_TO_NICK=false to send SMS to Nelson only
// (e.g. while the answering line is still being tuned). Bell + push are unaffected.
const SMS_TO_NICK = process.env.ANSWERING_SMS_TO_NICK !== 'false';
const STAFF_SMS = [NELSON_SMS, ...(SMS_TO_NICK ? [NICK_SMS] : [])].filter(Boolean);

interface LeadMatch { id: string; companyName: string; ownerId: string }
interface ContactMatch { id: string; firstName: string; lastName: string }
interface ClientMatch { id: string; contactName: string }

/** Find an existing non-deleted lead by phone-digit suffix or exact email. */
async function findLead(pd: string, email: string): Promise<LeadMatch | null> {
  if (!pd && !email) return null;
  const rows = await prisma.$queryRaw<LeadMatch[]>`
    SELECT id, "companyName", "ownerId" FROM leads
    WHERE "deletedAt" IS NULL AND (
      (${pd} <> '' AND regexp_replace(coalesce(phone, ''), '\D', '', 'g') LIKE ${'%' + pd})
      OR (${email} <> '' AND lower(coalesce(email, '')) = ${email})
    )
    ORDER BY "createdAt" DESC
    LIMIT 1`;
  return rows[0] ?? null;
}

/** Find an existing non-deleted contact by phone-digit suffix or exact email. */
async function findContact(pd: string, email: string): Promise<ContactMatch | null> {
  if (!pd && !email) return null;
  const rows = await prisma.$queryRaw<ContactMatch[]>`
    SELECT id, "firstName", "lastName" FROM contacts
    WHERE "deletedAt" IS NULL AND (
      (${pd} <> '' AND regexp_replace(coalesce(phone, ''), '\D', '', 'g') LIKE ${'%' + pd})
      OR (${email} <> '' AND lower(coalesce(email, '')) = ${email})
    )
    ORDER BY "createdAt" DESC
    LIMIT 1`;
  return rows[0] ?? null;
}

/** Find an existing client account by portal email (ClientAccount has no phone). */
async function findClient(email: string): Promise<ClientMatch | null> {
  if (!email) return null;
  const c = await prisma.clientAccount.findFirst({
    where: { contactEmail: { equals: email, mode: 'insensitive' } },
    select: { id: true, contactName: true },
  });
  return c ?? null;
}

function buildLeadNotes(d: InboundCallData): string {
  const lines = ['📞 INBOUND CALL via the 24/7 answering line.'];
  if (d.serviceType) lines.push(`Service: ${d.serviceType}`);
  if (d.location) lines.push(`Location: ${d.location}`);
  if (d.messageNotes) lines.push(`Message: ${d.messageNotes}`);
  if (d.summary) lines.push(`Call summary: ${d.summary}`);
  if (d.conversationId) lines.push(`Conversation: ${d.conversationId}`);
  return lines.join('\n');
}

async function alertStaff(opts: {
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  sms: string;
}): Promise<void> {
  // Bell + push to both (notify() fires the matching push with a deep-link).
  await Promise.allSettled(
    STAFF_USER_IDS.map((uid) =>
      notify({
        userId: uid,
        type: 'lead_assigned',
        title: opts.title,
        message: opts.message,
        entityType: opts.entityType,
        entityId: opts.entityId,
        dedupWindowHours: 0, // every inbound call is worth surfacing
      }),
    ),
  );
  // SMS to both.
  await Promise.allSettled(STAFF_SMS.map((n) => sendSms(n, opts.sms)));
}

export async function POST(request: NextRequest) {
  const raw = await request.text();

  if (!shouldSkipElevenLabsValidation()) {
    if (!validateElevenLabsRequest(raw, request.headers)) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  // Only act on completed transcription events; ack anything else.
  const type = (json as { type?: unknown })?.type;
  if (typeof type === 'string' && type !== 'post_call_transcription') {
    return NextResponse.json({ ok: true, ignored: type }, { status: 200 });
  }

  if (!NELSON_ID) {
    console.error('[answering-service] AGENT_OWNER_USER_ID not set — cannot create lead');
    return NextResponse.json({ error: 'server not configured' }, { status: 500 });
  }

  const data = parseAnsweringServicePayload(json);

  // ── Junk-call guard ─────────────────────────────────────────────────────
  // A genuine enquiry leaves at least one collected detail. Hang-ups, misdials
  // and wrong numbers still fire a post_call_transcription event — short, with
  // nothing collected. Skip those entirely: no lead, no activity, no SMS.
  // Floor is overridable via ANSWERING_MIN_CALL_SECS (default 15s).
  const MIN_CALL_SECS = Number(process.env.ANSWERING_MIN_CALL_SECS ?? 15);
  const collectedDetails = [
    data.callerName,
    data.companyName,
    data.phone,
    data.email,
    data.location,
    data.serviceType,
    data.messageNotes,
  ].filter(Boolean);
  const tooShort = data.durationSecs == null || data.durationSecs < MIN_CALL_SECS;
  if (collectedDetails.length === 0 && tooShort) {
    console.info('[answering-service] skipped empty/short call', {
      conversationId: data.conversationId,
      durationSecs: data.durationSecs,
    });
    return NextResponse.json({ ok: true, skipped: 'no_content' }, { status: 200 });
  }

  const phone = resolvedPhone(data);
  const pd = phoneDigits(phone);
  const email = normEmail(data.email);

  // ── Smart-routing lookups ──────────────────────────────────────────────
  const [lead, client, contact] = await Promise.all([
    findLead(pd, email),
    findClient(email),
    findContact(pd, email),
  ]);

  const route: InboundRoute = decideRoute({
    leadId: lead?.id,
    clientAccountId: client?.id,
    contactId: contact?.id,
  });

  const who = data.callerName || 'A caller';
  const co = data.companyName ? ` (${data.companyName})` : '';
  const svc = data.serviceType ? ` Service: ${data.serviceType}.` : '';
  const loc = data.location ? ` Location: ${data.location}.` : '';
  const tel = phone ? ` Tel: ${phone}.` : '';

  // ── New enquiry → create a Lead in the LEADS module ────────────────────
  if (route === 'new_enquiry') {
    const created = await prisma.lead.create({
      data: {
        companyName: data.companyName || data.callerName || 'Inbound caller',
        contactName: data.callerName,
        email: data.email,
        phone,
        source: 'inbound_call',
        stage: 'new_lead',
        callStatus: null, // CRITICAL: keep out of the cold-calling queue
        ownerId: NELSON_ID,
        notes: buildLeadNotes(data),
      },
      select: { id: true },
    });

    await prisma.activity.create({
      data: {
        activityType: 'lead_created',
        description: `📞 Inbound enquiry captured from the 24/7 line: ${who}${co}.`,
        userId: NELSON_ID,
        entityType: 'lead',
        entityId: created.id,
        metadata: {
          source: 'elevenlabs_answering_service',
          conversationId: data.conversationId,
          serviceType: data.serviceType,
          location: data.location,
        },
      },
    });

    await alertStaff({
      title: '📞 New inbound enquiry',
      message: `${who}${co} called the 24/7 line.${svc}${loc} Call back ASAP.`,
      entityType: 'lead',
      entityId: created.id,
      sms: `Signature Cleans — NEW inbound enquiry: ${who}${co}.${tel}${svc} New lead in SigOS, call back ASAP.`,
    });

    return NextResponse.json({ ok: true, route, leadId: created.id }, { status: 200 });
  }

  // ── Known caller → FLAG only (no duplicate lead) ───────────────────────
  let entityType: string;
  let entityId: string;
  let label: string;

  if (route === 'existing_lead' && lead) {
    entityType = 'lead';
    entityId = lead.id;
    label = `existing lead ${lead.companyName}`;
  } else if (route === 'existing_client' && client) {
    entityType = 'client';
    entityId = client.id;
    label = `existing client ${client.contactName}`;
  } else {
    // existing_contact
    entityType = 'contact';
    entityId = contact!.id;
    label = `known contact ${contact!.firstName} ${contact!.lastName}`.trim();
  }

  await prisma.activity.create({
    data: {
      activityType: 'call',
      description: `📞 Inbound call from ${label} via the 24/7 line.${data.messageNotes ? ` Message: ${data.messageNotes}` : ''}`,
      userId: NELSON_ID,
      entityType,
      entityId,
      metadata: {
        source: 'elevenlabs_answering_service',
        conversationId: data.conversationId,
        serviceType: data.serviceType,
      },
    },
  });

  await alertStaff({
    title: '📞 Existing contact called the 24/7 line',
    message: `${who}${co} (${label}) called the 24/7 line.${svc}${data.messageNotes ? ` Message: ${data.messageNotes}` : ''} No new lead created.`,
    entityType,
    entityId,
    sms: `Signature Cleans — ${label} called the 24/7 line.${tel}${svc} Flagged in SigOS (no new lead).`,
  });

  return NextResponse.json({ ok: true, route, entityType, entityId }, { status: 200 });
}
