/**
 * Integration check for the cold-calling outcome flow against a REAL database
 * (point .env at the candidate DB). Proves: transition persisted, idempotent
 * replay, observable outbox with no false `email_sent` on send failure.
 *
 *   npx tsx tests/integration/cc-outcome-flow.ts
 */
import 'dotenv/config';
import { prisma } from '@/lib/db';
import { applyColdCallOutcome } from '@/lib/cold-calling/outcome-rules';

let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? '✅' : '❌'} ${name}`);
  if (!cond) failures += 1;
}

async function makeLead(suffix: string, email: string | null) {
  const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
  const lead = await prisma.lead.create({
    data: {
      companyName: `__CCTEST__ ${suffix}`,
      contactName: 'Test Person',
      email,
      phone: '07000000000',
      source: 'cold_call' as never,
      stage: 'cold_call' as never,
      callStatus: 'new' as never,
      ownerId: user.id,
    },
    select: { id: true },
  });
  const attempt = await prisma.coldCallAttempt.create({
    data: { leadId: lead.id, userId: user.id, direction: 'outbound' as never, status: 'queued' as never },
    select: { id: true },
  });
  return { leadId: lead.id, attemptId: attempt.id, userId: user.id };
}

async function cleanup(leadIds: string[]) {
  await prisma.emailOutbox.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.activity.deleteMany({ where: { entityId: { in: leadIds } } });
  await prisma.task.deleteMany({ where: { linkedLeadId: { in: leadIds } } });
  await prisma.coldCallAttempt.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
}

async function main() {
  const a = await makeLead('no-answer', null);
  const b = await makeLead('gatekeeper', 'gktest@example.com');

  try {
    // 1. no_answer transition
    const r1 = await applyColdCallOutcome({ leadId: a.leadId, attemptId: a.attemptId, userId: a.userId, payload: { outcome: 'no_answer' } });
    const lead1 = await prisma.lead.findUniqueOrThrow({ where: { id: a.leadId }, select: { callStatus: true, noAnswerAttempts: true } });
    check('no_answer -> callStatus retry', lead1.callStatus === 'retry');
    check('no_answer increments counter to 1', lead1.noAnswerAttempts === 1);
    check('result not idempotent on first apply', r1.idempotent === false);

    // 2. idempotent replay (same attemptId)
    const r2 = await applyColdCallOutcome({ leadId: a.leadId, attemptId: a.attemptId, userId: a.userId, payload: { outcome: 'no_answer' } });
    const lead2 = await prisma.lead.findUniqueOrThrow({ where: { id: a.leadId }, select: { noAnswerAttempts: true } });
    check('idempotent replay flagged idempotent', r2.idempotent === true);
    check('idempotent replay did NOT double-increment (still 1)', lead2.noAnswerAttempts === 1);

    // 3. gatekeeper -> outbox row created; SMTP unconfigured -> failed, NO email_sent activity
    await applyColdCallOutcome({ leadId: b.leadId, attemptId: b.attemptId, userId: b.userId, payload: { outcome: 'gatekeeper', gatekeeperName: 'Reception' } });
    await new Promise((res) => setTimeout(res, 400)); // allow post-commit outbox attempt
    const outbox = await prisma.emailOutbox.findMany({ where: { leadId: b.leadId } });
    check('gatekeeper enqueued exactly one outbox row', outbox.length === 1);
    check('outbox row is gatekeeper template', outbox[0]?.template === 'gatekeeper');
    const sentActivity = await prisma.activity.count({ where: { entityId: b.leadId, activityType: 'email_sent' } });
    if (outbox[0]?.status === 'failed') {
      check('no false email_sent activity when send failed', sentActivity === 0);
    } else {
      check('email_sent activity present when send succeeded', sentActivity === 1);
    }
    const leadB = await prisma.lead.findUniqueOrThrow({ where: { id: b.leadId }, select: { callStatus: true } });
    check('gatekeeper -> callStatus nurturing', leadB.callStatus === 'nurturing');
  } finally {
    await cleanup([a.leadId, b.leadId]);
    console.log('(cleaned up test leads)');
  }

  await prisma.$disconnect();
  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log('\n✅ outcome-flow integration: all checks passed');
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
