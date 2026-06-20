/**
 * End-to-end test for POST /api/webhooks/elevenlabs/answering-service against
 * the candidate DB. External side effects (Twilio SMS, web-push) are disabled
 * via empty env so NOTHING reaches Nelson/Nick's phones.
 *
 *   TWILIO_ACCOUNT_SID= TWILIO_AUTH_TOKEN= VAPID_SUBJECT= VAPID_PRIVATE_KEY= \
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY= ELEVENLABS_WEBHOOK_SECRET=test_secret \
 *   npx tsx scripts/sigos/test-answering-service.ts
 *
 * Creates test rows tagged __INBOUND_TEST__ and cleans them all up at the end.
 */
import 'dotenv/config';
import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { POST } from '@/app/api/webhooks/elevenlabs/answering-service/route';

const SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET || 'test_secret';
const MARK = '__INBOUND_TEST__';
const URL = 'https://os.signature-cleans.co.uk/api/webhooks/elevenlabs/answering-service';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`, extra ?? ''); }
}

function signedRequest(payload: unknown, opts: { badSig?: boolean } = {}): NextRequest {
  const raw = JSON.stringify(payload);
  const t = Math.floor(Date.now() / 1000);
  const v0 = createHmac('sha256', opts.badSig ? 'wrong' : SECRET).update(`${t}.${raw}`).digest('hex');
  return new NextRequest(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'elevenlabs-signature': `t=${t},v0=${v0}` },
    body: raw,
  });
}

function payload(fields: Record<string, string>, callerId: string) {
  const dc: Record<string, { value: string }> = {};
  for (const [k, v] of Object.entries(fields)) dc[k] = { value: v };
  return {
    type: 'post_call_transcription',
    data: {
      agent_id: 'agent_test',
      conversation_id: `${MARK}_conv_${Date.now()}`,
      metadata: { call_duration_secs: 90, phone_call: { direction: 'inbound', external_number: callerId } },
      analysis: {
        transcript_summary: 'test call',
        call_successful: 'success',
        data_collection_results: dc,
      },
    },
  };
}

async function cleanup() {
  const leads = await prisma.lead.findMany({ where: { companyName: { startsWith: MARK } }, select: { id: true } });
  const ids = leads.map((l) => l.id);
  // activities + notifications keyed by these entityIds
  await prisma.activity.deleteMany({ where: { OR: [{ entityId: { in: ids } }, { description: { contains: MARK } }] } });
  await prisma.notification.deleteMany({ where: { entityId: { in: ids } } });
  await prisma.lead.deleteMany({ where: { id: { in: ids } } });
}

async function main() {
  console.log('=== answering-service E2E (candidate DB) ===');
  console.log(`Twilio disabled: ${!process.env.TWILIO_ACCOUNT_SID} · Push disabled: ${!process.env.VAPID_PRIVATE_KEY}`);

  await cleanup(); // start clean

  // ── Scenario A: brand-new enquiry → creates a lead, NOT in cold-call queue ──
  const uniquePhone = `+44770090${String(Date.now()).slice(-4)}`;
  const resA = await POST(signedRequest(payload({
    caller_name: 'Test Caller',
    company_name: `${MARK} Acme Co`,
    phone_number: uniquePhone,
    email_address: `${MARK.toLowerCase()}_a@example.com`,
    location: 'Exeter',
    service_type: 'weekly office clean',
    message_notes: 'please call back',
  }, uniquePhone)));
  const bodyA = await resA.json();
  check('A: 200 OK', resA.status === 200, resA.status);
  check('A: route=new_enquiry', bodyA.route === 'new_enquiry', bodyA);
  const leadA = bodyA.leadId ? await prisma.lead.findUnique({ where: { id: bodyA.leadId } }) : null;
  check('A: lead created', !!leadA);
  check('A: source=inbound_call', leadA?.source === 'inbound_call', leadA?.source);
  check('A: stage=new_lead', leadA?.stage === 'new_lead', leadA?.stage);
  check('A: callStatus=null (OUT of cold-call queue)', leadA?.callStatus === null, leadA?.callStatus);
  check('A: phone stored', leadA?.phone === uniquePhone, leadA?.phone);
  check('A: contactName captured', leadA?.contactName === 'Test Caller', leadA?.contactName);
  const actA = await prisma.activity.findFirst({ where: { entityType: 'lead', entityId: bodyA.leadId, activityType: 'lead_created' } });
  check('A: lead_created activity logged', !!actA);
  const notifA = await prisma.notification.count({ where: { entityId: bodyA.leadId } });
  check('A: notifications created for staff', notifA >= 1, notifA);

  // ── Scenario B: existing lead calls back → FLAG only, NO duplicate lead ──
  const ownerId = process.env.AGENT_OWNER_USER_ID!;
  const seedPhone = `07733${String(Date.now()).slice(-6)}`;
  const seed = await prisma.lead.create({
    data: { companyName: `${MARK} Existing Ltd`, phone: seedPhone, source: 'referral', stage: 'contacted', callStatus: null, ownerId },
    select: { id: true },
  });
  const beforeCount = await prisma.lead.count({ where: { companyName: { startsWith: MARK } } });
  // caller dials in with the SAME number in a different format
  const resB = await POST(signedRequest(payload({
    caller_name: 'Returning Caller',
    phone_number: `+44 ${seedPhone.slice(1)}`,
    message_notes: 'following up',
  }, `+44${seedPhone.slice(1)}`)));
  const bodyB = await resB.json();
  check('B: 200 OK', resB.status === 200, resB.status);
  check('B: route=existing_lead', bodyB.route === 'existing_lead', bodyB);
  check('B: matched the seed lead', bodyB.entityId === seed.id, bodyB.entityId);
  const afterCount = await prisma.lead.count({ where: { companyName: { startsWith: MARK } } });
  check('B: NO duplicate lead created', afterCount === beforeCount, { beforeCount, afterCount });
  const actB = await prisma.activity.findFirst({ where: { entityType: 'lead', entityId: seed.id, activityType: 'call' } });
  check('B: inbound call activity logged on existing lead', !!actB);

  // ── Scenario C: invalid signature → 401 ──
  const resC = await POST(signedRequest(payload({ caller_name: 'Nope', phone_number: '+447000000000' }, '+447000000000'), { badSig: true }));
  check('C: bad signature rejected 401', resC.status === 401, resC.status);

  // ── Scenario D: non-transcription event → ignored 200, no lead ──
  const before = await prisma.lead.count({ where: { companyName: { startsWith: MARK } } });
  const resD = await POST(signedRequest({ type: 'call_initiation', data: {} }));
  const bodyD = await resD.json();
  const afterD = await prisma.lead.count({ where: { companyName: { startsWith: MARK } } });
  check('D: non-transcription event ignored 200', resD.status === 200 && bodyD.ignored === 'call_initiation', bodyD);
  check('D: no lead created for ignored event', afterD === before, { before, afterD });

  // ── Scenario E: junk/empty call (hang-up, no details) → skipped, NO lead ──
  const beforeE = await prisma.lead.count();
  const emptyCall = {
    type: 'post_call_transcription',
    data: {
      agent_id: 'agent_test',
      conversation_id: `${MARK}_conv_empty_${Date.now()}`,
      metadata: { call_duration_secs: 3, phone_call: { direction: 'inbound', external_number: '+447000000123' } },
      analysis: { transcript_summary: '', call_successful: 'failure', data_collection_results: {} },
    },
  };
  const resE = await POST(signedRequest(emptyCall));
  const bodyE = await resE.json();
  const afterE = await prisma.lead.count();
  check('E: short empty call skipped 200', resE.status === 200 && bodyE.skipped === 'no_content', bodyE);
  check('E: NO lead created for empty call', afterE === beforeE, { beforeE, afterE });

  // ── Scenario F: short call BUT details collected → still processed (lead) ──
  const fPhone = `+44770091${String(Date.now()).slice(-4)}`;
  const shortWithDetails = {
    type: 'post_call_transcription',
    data: {
      agent_id: 'agent_test',
      conversation_id: `${MARK}_conv_shortok_${Date.now()}`,
      metadata: { call_duration_secs: 4, phone_call: { direction: 'inbound', external_number: fPhone } },
      analysis: {
        transcript_summary: 'quick but gave details',
        call_successful: 'success',
        data_collection_results: { caller_name: { value: 'Quick Caller' }, company_name: { value: `${MARK} ShortOK Ltd` }, phone_number: { value: fPhone } },
      },
    },
  };
  const resF = await POST(signedRequest(shortWithDetails));
  const bodyF = await resF.json();
  check('F: short call WITH details still processed', resF.status === 200 && bodyF.route === 'new_enquiry' && !!bodyF.leadId, bodyF);

  await cleanup();

  console.log(`\n=== ${pass} passed · ${fail} failed ===`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await cleanup().catch(() => {}); await prisma.$disconnect(); process.exit(1); });
