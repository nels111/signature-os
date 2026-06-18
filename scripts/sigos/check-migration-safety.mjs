/**
 * Block destructive SQL in Prisma migrations by default.
 *   node scripts/sigos/check-migration-safety.mjs
 * Scans prisma/migrations for DROP TABLE/COLUMN, TRUNCATE, DELETE FROM. A
 * migration whose folder name contains ".approved-destructive." is allowed.
 * Exit 1 if any unapproved destructive statement is found.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'prisma/migrations';
const DANGER = [/DROP\s+TABLE/i, /DROP\s+COLUMN/i, /\bTRUNCATE\b/i, /DELETE\s+FROM/i];

let offenders = [];
let dirs = [];
try {
  dirs = readdirSync(ROOT).filter((d) => {
    try {
      return statSync(join(ROOT, d)).isDirectory();
    } catch {
      return false;
    }
  });
} catch {
  console.log('No migrations directory; nothing to check.');
  process.exit(0);
}

for (const dir of dirs) {
  if (dir.includes('.approved-destructive.')) continue;
  const file = join(ROOT, dir, 'migration.sql');
  let sql = '';
  try {
    sql = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const re of DANGER) {
    if (re.test(sql)) offenders.push(`${dir}: matches ${re}`);
  }
}

if (offenders.length > 0) {
  console.error('❌ Destructive migration(s) found (rename folder with .approved-destructive. to allow):');
  for (const o of offenders) console.error('   ' + o);
  process.exit(1);
}
console.log(`✅ ${dirs.length} migration(s) checked — no unapproved destructive SQL.`);
