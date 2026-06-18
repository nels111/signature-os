/**
 * One-time backfill: set leads.callStatus + nextCallAt from the legacy shape,
 * using the SAME pure mapper the tests prove. ADDITIVE: only writes callStatus
 * and (when the mapper dictates) nextCallAt. Never deletes or touches other
 * fields. Re-runnable (idempotent — recomputes from legacy fields each run).
 *
 *   DRY RUN (default): npx tsx scripts/sigos/backfill-callstatus.ts
 *   APPLY:             npx tsx scripts/sigos/backfill-callstatus.ts --apply
 *
 * Reads DATABASE_URL from .env (point it at the candidate DB for testing).
 */
import 'dotenv/config';
import { Pool } from 'pg';
import { mapLegacyToCallStatus, type LegacyLeadRow } from '../../src/lib/cold-calling/migrate-callstatus';

const APPLY = process.argv.includes('--apply');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const now = new Date();

  const { rows } = await pool.query(`
    SELECT id, stage, "queueType", "firstCalledAt", "nextCallAt", "siteVisitAt",
           "dormantUntil", phone, "noAnswerAttempts", "voicemailAttempts", "gatekeeperAttempts"
    FROM leads
  `);

  const histogram: Record<string, number> = {};
  const fromTo: Record<string, number> = {};
  const updates: { id: string; callStatus: string; nextCallAt: Date | null }[] = [];

  for (const r of rows) {
    const legacy: LegacyLeadRow = {
      stage: r.stage,
      queueType: r.queueType,
      firstCalledAt: r.firstCalledAt,
      nextCallAt: r.nextCallAt,
      siteVisitAt: r.siteVisitAt,
      dormantUntil: r.dormantUntil,
      phone: r.phone,
      noAnswerAttempts: r.noAnswerAttempts ?? 0,
      voicemailAttempts: r.voicemailAttempts ?? 0,
      gatekeeperAttempts: r.gatekeeperAttempts ?? 0,
    };
    const mapped = mapLegacyToCallStatus(legacy, now);
    histogram[mapped.callStatus] = (histogram[mapped.callStatus] ?? 0) + 1;
    const key = `${r.stage} -> ${mapped.callStatus}`;
    fromTo[key] = (fromTo[key] ?? 0) + 1;
    updates.push({ id: r.id, callStatus: mapped.callStatus, nextCallAt: mapped.nextCallAt });
  }

  // ── Conservation: every input row produced exactly one mapped output. ──
  const inCount = rows.length;
  const outCount = updates.length;
  const histTotal = Object.values(histogram).reduce((a, b) => a + b, 0);

  console.log(`\nLeads read:        ${inCount}`);
  console.log(`Mapped outputs:    ${outCount}`);
  console.log(`Histogram total:   ${histTotal}`);
  console.log('\nfrom -> to:');
  for (const [k, v] of Object.entries(fromTo).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(40)} ${v}`);
  }
  console.log('\ncallStatus totals:');
  for (const [k, v] of Object.entries(histogram).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(12)} ${v}`);
  }

  if (inCount !== outCount || histTotal !== inCount) {
    console.error('\n❌ CONSERVATION FAILED — a lead was dropped. Aborting.');
    await pool.end();
    process.exit(1);
  }
  console.log('\n✅ Conservation holds: no lead dropped.');

  if (!APPLY) {
    console.log('\n(DRY RUN — no writes. Re-run with --apply to write.)');
    await pool.end();
    return;
  }

  console.log('\nApplying...');
  let written = 0;
  for (const u of updates) {
    await pool.query(`UPDATE leads SET "callStatus" = $1::"LeadCallStatus", "nextCallAt" = $2 WHERE id = $3`, [
      u.callStatus,
      u.nextCallAt,
      u.id,
    ]);
    written += 1;
  }
  console.log(`✅ Wrote callStatus to ${written} leads.`);

  const { rows: nullRows } = await pool.query(`SELECT count(*)::int AS n FROM leads WHERE "callStatus" IS NULL`);
  console.log(`Leads still NULL callStatus: ${nullRows[0].n} (must be 0)`);
  await pool.end();
  if (nullRows[0].n !== 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
