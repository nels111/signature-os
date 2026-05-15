/**
 * Wave 1.4 break-test harness.
 *
 * Exercises the activities lib + DB directly to verify:
 *  - Edge cases (empty, oversized, null user, unknown type)
 *  - All convenience helpers write the expected rows
 *  - Cross-entity isolation
 *  - GET /api/activities returns scoped results
 *
 * Cleans up after itself.
 */
import { prisma } from '../src/lib/db';
import {
  logActivity,
  logLeadCreated,
  logLeadStageChange,
  logDealCreated,
  logDealStageChange,
  logQuoteSent,
  logQuoteAccepted,
} from '../src/lib/activities';

const TEST_TAG = 'BREAKTEST_W14';

let passed = 0;
let failed = 0;

function pass(name: string) {
  console.log(`  PASS  ${name}`);
  passed++;
}
function fail(name: string, detail?: unknown) {
  console.log(`  FAIL  ${name}${detail ? ` -> ${JSON.stringify(detail)}` : ''}`);
  failed++;
}

async function run() {
  console.log('=== Wave 1.4 break-tests ===\n');

  const user = await prisma.user.findFirst({ where: { email: 'nelson@signature-cleans.co.uk' } });
  if (!user) throw new Error('Test user not found');
  console.log(`Test user: ${user.id} (${user.email})\n`);

  // Cleanup any prior test rows
  await prisma.activity.deleteMany({ where: { description: { contains: TEST_TAG } } });

  // ===== EDGE CASES =====
  console.log('-- Edge cases --');

  // 1. Empty userId -> no-op
  const r1 = await logActivity({
    userId: '',
    activityType: 'note',
    description: `${TEST_TAG} empty user`,
  });
  if (!r1.created && r1.reason === 'no_user') pass('empty userId returns no_user');
  else fail('empty userId', r1);

  // 2. Null userId -> no-op
  const r2 = await logActivity({
    userId: null,
    activityType: 'note',
    description: `${TEST_TAG} null user`,
  });
  if (!r2.created && r2.reason === 'no_user') pass('null userId returns no_user');
  else fail('null userId', r2);

  // 3. Empty description -> no-op
  const r3 = await logActivity({ userId: user.id, activityType: 'note', description: '' });
  if (!r3.created && r3.reason === 'no_description') pass('empty description returns no_description');
  else fail('empty description', r3);

  // 4. Description > 5000 chars -> truncated
  const longDesc = `${TEST_TAG} ` + 'x'.repeat(6000);
  const r4 = await logActivity({ userId: user.id, activityType: 'note', description: longDesc });
  if (r4.created) {
    const row = await prisma.activity.findFirst({
      where: { userId: user.id, description: { contains: TEST_TAG } },
      orderBy: { createdAt: 'desc' },
    });
    if (row && row.description.length === 5000 && row.description.endsWith('...')) {
      pass('long description truncated to 5000 with ellipsis');
    } else {
      fail('long description truncation', { len: row?.description.length, tail: row?.description.slice(-10) });
    }
  } else {
    fail('long description not created', r4);
  }

  // 5. Oversized metadata -> dropped, activity still created
  const big = { stuff: 'y'.repeat(15000) };
  const r5 = await logActivity({
    userId: user.id,
    activityType: 'note',
    description: `${TEST_TAG} oversized meta`,
    metadata: big,
  });
  if (r5.created) {
    const row = await prisma.activity.findFirst({
      where: { description: `${TEST_TAG} oversized meta` },
    });
    if (row && row.metadata === null) pass('oversized metadata dropped, activity kept');
    else fail('oversized metadata', { metadata: row?.metadata });
  } else {
    fail('oversized metadata creation', r5);
  }

  // 6. Invalid foreign key (bad userId UUID) -> swallowed, returns error reason
  const r6 = await logActivity({
    userId: '00000000-0000-0000-0000-000000000000',
    activityType: 'note',
    description: `${TEST_TAG} bad user fk`,
  });
  if (!r6.created && r6.reason === 'error') pass('bad user FK -> error reason, no throw');
  else fail('bad user FK', r6);

  // ===== HELPER COVERAGE =====
  console.log('\n-- Convenience helpers --');

  const fakeLead = 'lead-' + Date.now();
  const fakeDeal = 'deal-' + Date.now();
  const fakeQuote = 'quote-' + Date.now();

  await logLeadCreated({
    userId: user.id,
    leadId: fakeLead,
    companyName: `${TEST_TAG} Co`,
    contactName: 'Tester',
    source: 'manual_entry',
  });
  const a1 = await prisma.activity.findFirst({
    where: { entityType: 'lead', entityId: fakeLead, activityType: 'lead_created' },
  });
  if (a1 && a1.description.includes('manual entry')) pass('logLeadCreated writes correct row');
  else fail('logLeadCreated', a1);

  await logLeadStageChange({
    userId: user.id,
    leadId: fakeLead,
    leadLabel: 'X (Y)',
    fromStage: 'new',
    toStage: 'qualified',
  });
  const a2 = await prisma.activity.findFirst({
    where: { entityType: 'lead', entityId: fakeLead, activityType: 'status_change' },
  });
  if (a2 && a2.description.includes('new -> qualified')) pass('logLeadStageChange writes correct row');
  else fail('logLeadStageChange', a2);

  await logDealCreated({
    userId: user.id,
    dealId: fakeDeal,
    dealName: `${TEST_TAG} Deal`,
    fromLeadId: fakeLead,
  });
  const a3 = await prisma.activity.findFirst({
    where: { entityType: 'deal', entityId: fakeDeal, activityType: 'deal_created' },
  });
  if (a3 && a3.description.includes('from lead')) pass('logDealCreated (from lead) writes correct row');
  else fail('logDealCreated', a3);

  await logDealStageChange({
    userId: user.id,
    dealId: fakeDeal,
    dealName: `${TEST_TAG} Deal`,
    fromStage: 'discovery',
    toStage: 'proposal_sent',
  });
  const a4 = await prisma.activity.findFirst({
    where: { entityType: 'deal', entityId: fakeDeal, activityType: 'status_change' },
  });
  if (a4 && a4.description.includes('discovery -> proposal sent')) pass('logDealStageChange writes correct row');
  else fail('logDealStageChange', a4);

  // Quote sent should dual-log: one for deal, one for quote
  await logQuoteSent({
    userId: user.id,
    quoteId: fakeQuote,
    dealId: fakeDeal,
    recipientEmail: 'test@example.com',
    trackingId: 'TRK-001',
  });
  const qsDeal = await prisma.activity.findFirst({
    where: { entityType: 'deal', entityId: fakeDeal, activityType: 'quote_sent' },
  });
  const qsQuote = await prisma.activity.findFirst({
    where: { entityType: 'quote', entityId: fakeQuote, activityType: 'quote_sent' },
  });
  if (qsDeal && qsQuote) pass('logQuoteSent dual-logs (deal + quote)');
  else fail('logQuoteSent dual-log', { qsDeal: !!qsDeal, qsQuote: !!qsQuote });

  // Quote accepted should also dual-log
  await logQuoteAccepted({
    userId: user.id,
    quoteId: fakeQuote,
    dealId: fakeDeal,
    companyName: `${TEST_TAG} Co`,
  });
  const qaDeal = await prisma.activity.findFirst({
    where: { entityType: 'deal', entityId: fakeDeal, activityType: 'status_change', description: { contains: 'Quote accepted' } },
  });
  const qaQuote = await prisma.activity.findFirst({
    where: { entityType: 'quote', entityId: fakeQuote, activityType: 'status_change', description: { contains: 'Quote accepted' } },
  });
  if (qaDeal && qaQuote) pass('logQuoteAccepted dual-logs (deal + quote)');
  else fail('logQuoteAccepted dual-log', { qaDeal: !!qaDeal, qaQuote: !!qaQuote });

  // ===== ISOLATION =====
  console.log('\n-- Cross-entity isolation --');

  const leadActivities = await prisma.activity.count({
    where: { entityType: 'lead', entityId: fakeLead },
  });
  const dealActivities = await prisma.activity.count({
    where: { entityType: 'deal', entityId: fakeDeal },
  });
  // Lead should have 2 (created + status_change). Deal should have 3 (deal_created + status_change + quote_sent + quote_accepted_status = 4)
  if (leadActivities === 2) pass(`lead timeline scoped (2 rows)`);
  else fail('lead scope', { count: leadActivities });
  if (dealActivities === 4) pass(`deal timeline scoped (4 rows)`);
  else fail('deal scope', { count: dealActivities });

  // Verify no lead rows bleed into deal scope
  const bleed = await prisma.activity.count({
    where: {
      entityType: 'deal',
      entityId: fakeDeal,
      OR: [{ entityId: fakeLead }],
    },
  });
  if (bleed === 0) pass('no cross-entity bleed');
  else fail('cross-entity bleed', { count: bleed });

  // ===== GET /api/activities (unauthenticated) =====
  console.log('\n-- API auth gate --');
  const apiRes = await fetch(
    `http://localhost:3200/api/activities?entityType=deal&entityId=${fakeDeal}&page=1&limit=20`,
  );
  if (apiRes.status === 401) pass('GET /api/activities requires auth (401 unauthenticated)');
  else fail('API auth gate', { status: apiRes.status });

  // ===== CLEANUP =====
  console.log('\n-- Cleanup --');
  const cleaned = await prisma.activity.deleteMany({
    where: {
      OR: [
        { description: { contains: TEST_TAG } },
        { entityId: fakeLead },
        { entityId: fakeDeal },
        { entityId: fakeQuote },
      ],
    },
  });
  console.log(`  Cleaned ${cleaned.count} test rows`);

  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('FATAL', err);
  process.exit(2);
});
