/**
 * Compliance Tracker Seeder — Task #28
 * Seeds operatives from /workspace/compliance/operative-compliance-tracker.csv
 * into the `operatives` and `compliance_records` tables.
 *
 * Run after applying the migration:
 *   psql $DATABASE_URL -f scripts/migrations/compliance-tracker.sql
 *   node scripts/seed-compliance.mjs
 *
 * Idempotent: uses upsert on connecteamId, so safe to re-run.
 */

import { createRequire } from 'module'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Load env
const dotenv = require('dotenv')
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const CSV_PATH = path.join(
  process.env.HOME,
  '.dorabot/workspace/compliance/operative-compliance-tracker.csv'
)

function parseDate(s) {
  if (!s || s.trim() === '') return null
  const d = new Date(s.trim())
  return isNaN(d.getTime()) ? null : d
}

function parseCsv(raw) {
  const lines = raw.split('\n').filter(l => l.trim())
  const [header, ...rows] = lines
  const cols = header.split(',').map(c => c.trim())
  return rows.map(row => {
    const vals = row.split(',')
    return Object.fromEntries(cols.map((c, i) => [c, (vals[i] ?? '').trim()]))
  })
}

async function main() {
  console.log('Reading CSV:', CSV_PATH)
  const raw = readFileSync(CSV_PATH, 'utf-8')
  const records = parseCsv(raw)
  console.log(`Found ${records.length} operatives`)

  let created = 0, updated = 0

  for (const r of records) {
    const connecteamId = BigInt(r.connecteam_id)

    const operative = await prisma.operative.upsert({
      where:  { connecteamId },
      update: {
        fullName:  r.full_name  || 'Unknown',
        entity:    r.entity     || 'Unknown',
        role:      r.role       || null,
        phone:     r.phone      || null,
        startDate: parseDate(r.start_date),
        notes:     r.notes      || null,
      },
      create: {
        connecteamId,
        fullName:  r.full_name  || 'Unknown',
        entity:    r.entity     || 'Unknown',
        role:      r.role       || null,
        phone:     r.phone      || null,
        startDate: parseDate(r.start_date),
        notes:     r.notes      || null,
      },
    })

    // Only create compliance stub if it doesn't already exist
    const existing = await prisma.compliance.findUnique({
      where: { operativeId: operative.id }
    })

    if (!existing) {
      await prisma.compliance.create({
        data: {
          operativeId:           operative.id,
          dbsIssued:             parseDate(r.dbs_issued),
          dbsExpiry:             parseDate(r.dbs_expiry),
          dbsCertificateNumber:  r.dbs_certificate_number  || null,
          insuranceProvider:     r.insurance_provider      || null,
          insuranceExpiry:       parseDate(r.insurance_expiry),
          insurancePolicyNumber: r.insurance_policy_number || null,
          rtwShareCode:          r.rtw_share_code          || null,
          // All statuses default to 'missing' — cron will compute on first run
        },
      })
      created++
    } else {
      updated++
    }

    console.log(`  ✓ ${r.full_name} (${r.entity})`)
  }

  console.log(`\nDone. ${created} compliance stubs created, ${updated} operatives already had records.`)
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
