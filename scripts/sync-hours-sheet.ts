/**
 * sync-hours-sheet.ts
 *
 * Standalone cron script: pull the Regular Hours Sheet from Dropbox and upsert
 * all rows into `regular_hours_sheet_rows`, then auto-link unlinked Sites.
 *
 * Run via: tsx scripts/sync-hours-sheet.ts
 * Cron:    0 4 * * * /var/www/signature-cleans-os/scripts/run-sync-hours.sh
 *
 * Exit 0 on success, 1 on error (so cron mailer can catch failures).
 */

import { fetchHoursSheet } from '../src/lib/dropbox-hours'
import { prisma } from '../src/lib/db'
import { syncSitesFromSheet } from '../src/lib/sites-sync'

const LOG_TAG = '[sync-hours-sheet]'

function log(msg: string) {
  const ts = new Date().toISOString()
  console.log(`${ts} ${LOG_TAG} ${msg}`)
}

async function run() {
  log('starting Regular Hours Sheet sync')

  let sheet
  try {
    sheet = await fetchHoursSheet()
  } catch (err) {
    log(`ERROR: sheet fetch failed: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }

  log(`fetched sheet: ${sheet.contracts.length} contracts, fetched at ${sheet.fetchedAt}`)

  let upserted = 0
  let errCount = 0

  for (const row of sheet.contracts) {
    try {
      await prisma.regularHoursSheetRow.upsert({
        where: { businessName: row.name },
        create: {
          businessName: row.name,
          cleanType: row.cleanType || null,
          hoursPerVisit: row.hoursPerVisit,
          frequencyPerWeek: row.frequencyPerWeek,
          avgWeeklyHours: row.weeklyHours,
          avgWeeklyEarnings: row.weeklyEarnings,
          avgMonthlyEarnings: row.monthlyEarnings,
          signedTerms: row.signedTerms,
          annualValue: row.annualValue,
          firstAuditDate: row.firstAuditDate ? new Date(row.firstAuditDate) : null,
          status: row.status,
          syncedAt: new Date(),
        },
        update: {
          cleanType: row.cleanType || null,
          hoursPerVisit: row.hoursPerVisit,
          frequencyPerWeek: row.frequencyPerWeek,
          avgWeeklyHours: row.weeklyHours,
          avgWeeklyEarnings: row.weeklyEarnings,
          avgMonthlyEarnings: row.monthlyEarnings,
          signedTerms: row.signedTerms,
          annualValue: row.annualValue,
          firstAuditDate: row.firstAuditDate ? new Date(row.firstAuditDate) : null,
          status: row.status,
          syncedAt: new Date(),
        },
      })
      upserted++
    } catch (err) {
      log(`ERROR: upsert failed for "${row.name}": ${err instanceof Error ? err.message : String(err)}`)
      errCount++
    }
  }

  log(`upserted ${upserted} rows (${errCount} errors)`)

  // Auto-link unlinked Sites by case-insensitive name match
  const sheetRows = await prisma.regularHoursSheetRow.findMany({
    select: { id: true, businessName: true },
  })
  const byNameKey = new Map(
    sheetRows.map(r => [r.businessName.toLowerCase().trim(), r.id])
  )

  const unlinkedSites = await prisma.site.findMany({
    where: { regularHoursSheetRowId: null },
    select: { id: true, name: true },
  })

  let linked = 0
  for (const site of unlinkedSites) {
    const sheetRowId = byNameKey.get(site.name.toLowerCase().trim())
    if (sheetRowId) {
      await prisma.site.update({
        where: { id: site.id },
        data: { regularHoursSheetRowId: sheetRowId },
      })
      linked++
    }
  }

  log(`auto-linked ${linked} new sites`)

  // Reconcile Site records (create / update cellTier+active / deactivate) — this
  // used to run as a side-effect of GET /api/sites; now it runs here in the cron.
  try {
    const s = await syncSitesFromSheet({ sheetData: sheet })
    log(`site reconcile: +${s.created} new, ~${s.updated} updated, -${s.deactivated} deactivated, ${s.linked} linked`)
  } catch (err) {
    log(`ERROR: site reconcile failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  log(`totals: ${sheet.totals.activeContracts} active, ${sheet.totals.weeklyHours.toFixed(1)} hrs/wk, £${sheet.totals.weeklyEarnings.toFixed(2)}/wk`)
  log('sync complete')
  await prisma.$disconnect()
}

run().catch(err => {
  console.error(`${new Date().toISOString()} ${LOG_TAG} FATAL: ${err}`)
  process.exit(1)
})
