/**
 * Site reconciliation from the Regular Hours Sheet.
 *
 * This logic used to live INSIDE `GET /api/sites`, which meant every read of the
 * sites list created/updated/deactivated DB rows — side-effects on a GET, an
 * N+1 write storm, and races under concurrent dashboard loads. It now lives here
 * as an explicit, serialized write path, invoked by the daily cron and the admin
 * sync endpoint. `GET /api/sites` is read-only.
 *
 * Serialized with a Postgres advisory lock (auto-released at transaction end) so
 * two concurrent syncs can never race on the same rows.
 */

import { prisma } from '@/lib/db';
import { fetchHoursSheet } from '@/lib/dropbox-hours';
import { getDefaultLabourRate } from '@/lib/org-settings';

/** Stable arbitrary key for the sites-sync advisory lock. */
const SITES_SYNC_LOCK_KEY = 4827_001;

function deriveCellTier(weeklyHours: number): 'A' | 'B' | 'C' {
  if (weeklyHours >= 31) return 'C';
  if (weeklyHours >= 16) return 'B';
  return 'A';
}

function deriveRate(weeklyEarnings: number, weeklyHours: number): number {
  if (!weeklyHours) return 27;
  // Round to nearest 50p
  return Math.round((weeklyEarnings / weeklyHours) * 2) / 2;
}

export interface SiteSyncResult {
  created: number;
  updated: number;
  deactivated: number;
  linked: number;
  fetchedAt: string;
}

/**
 * Pull the sheet and reconcile Site rows: create new contracts, update cellTier
 * and active state when they shift, link the canonical sheet-row FK, and
 * deactivate sites that have dropped out of the sheet. Never overwrites
 * user-confirmed billing fields.
 */
export async function syncSitesFromSheet(opts?: {
  sheetData?: Awaited<ReturnType<typeof fetchHoursSheet>>;
  defaultLabourRate?: number;
}): Promise<SiteSyncResult> {
  // Network fetch OUTSIDE the transaction (don't hold the lock during I/O).
  // Callers that already fetched the sheet pass it in to avoid a second fetch.
  const sheetData = opts?.sheetData ?? (await fetchHoursSheet());
  const defaultLabourRate = opts?.defaultLabourRate ?? (await getDefaultLabourRate());

  return prisma.$transaction(async (tx) => {
    // Serialize concurrent syncs; released automatically when the tx ends.
    // $executeRaw (not $queryRaw) — the lock function returns void.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SITES_SYNC_LOCK_KEY})`;

    const dbSites = await tx.site.findMany({});
    const dbByName = new Map(dbSites.map((s) => [s.name.toLowerCase().trim(), s]));

    const sheetRows = await tx.regularHoursSheetRow.findMany({ select: { id: true, businessName: true } });
    const sheetRowIdByName = new Map(sheetRows.map((r) => [r.businessName.toLowerCase().trim(), r.id]));

    const seenNames = new Set<string>();
    let created = 0;
    let updated = 0;
    let deactivated = 0;
    let linked = 0;

    for (const row of sheetData.contracts) {
      const nameKey = row.name.toLowerCase().trim();
      seenNames.add(nameKey);

      const cellTier = deriveCellTier(row.weeklyHours);
      const shouldBeActive = row.status === 'active';
      const sheetRowId = sheetRowIdByName.get(nameKey) ?? null;
      const existing = dbByName.get(nameKey);

      if (existing) {
        const updates: Record<string, unknown> = {};
        if (existing.cellTier !== cellTier) updates.cellTier = cellTier;
        if (existing.active !== shouldBeActive) updates.active = shouldBeActive;
        if (!existing.regularHoursSheetRowId && sheetRowId) {
          updates.regularHoursSheetRowId = sheetRowId;
          linked++;
        }
        if (Object.keys(updates).length > 0) {
          await tx.site.update({ where: { id: existing.id }, data: updates });
          updated++;
        }
      } else {
        await tx.site.create({
          data: {
            name: row.name.trim(),
            cellTier,
            billingType: 'hourly',
            billingRatePerHour: deriveRate(row.weeklyEarnings, row.weeklyHours),
            labourRatePerHour: defaultLabourRate,
            rateConfirmed: false,
            active: shouldBeActive,
            regularHoursSheetRowId: sheetRowId,
          },
        });
        created++;
      }
    }

    // Deactivate active sites that have dropped out of the sheet entirely.
    for (const dbSite of dbSites) {
      if (dbSite.active && !seenNames.has(dbSite.name.toLowerCase().trim())) {
        await tx.site.update({ where: { id: dbSite.id }, data: { active: false } });
        deactivated++;
      }
    }

    return { created, updated, deactivated, linked, fetchedAt: sheetData.fetchedAt };
  });
}
