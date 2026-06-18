/**
 * Run the cold-calling DB invariants. Exit 1 if any returns rows.
 *   node scripts/sigos/run-db-invariants.mjs
 * Reads DATABASE_URL from .env.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';

const sql = readFileSync(new URL('../../tests/db/cold-calling-invariants.sql', import.meta.url), 'utf8');

// Split on the named SELECTs (each invariant is its own statement, ';'-terminated).
const statements = sql
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter((s) => s && !s.replace(/--.*$/gm, '').trim().startsWith('') === false && /select/i.test(s));

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let failed = 0;
  for (const stmt of statements) {
    const nameMatch = stmt.match(/'([a-z_]+)' AS invariant/i);
    const name = nameMatch ? nameMatch[1] : 'invariant';
    const { rows } = await pool.query(stmt);
    if (rows.length === 0) {
      console.log(`✅ ${name}: 0 rows`);
    } else {
      failed += 1;
      console.error(`❌ ${name}: ${rows.length} rows — ${rows.slice(0, 5).map((r) => r.id).join(', ')}`);
    }
  }
  await pool.end();
  if (failed > 0) {
    console.error(`\n${failed} invariant(s) FAILED.`);
    process.exit(1);
  }
  console.log('\n✅ All cold-calling DB invariants hold.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
