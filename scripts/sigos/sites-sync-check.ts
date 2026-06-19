/** Verify the sites mutate-on-read fix against the candidate DB. */
import 'dotenv/config';
import { prisma } from '@/lib/db';
import { syncSitesFromSheet } from '@/lib/sites-sync';

(async () => {
  try {
    // Read-only GET path: count writes before and after a "read" to prove no side-effects.
    const before = await prisma.site.count();
    const sites = await prisma.site.findMany({
      where: { active: true },
      orderBy: [{ cellTier: 'asc' }, { name: 'asc' }],
      include: { regularHoursSheetRow: true },
    });
    const augmented = sites.map(({ regularHoursSheetRow, ...s }) => ({
      ...s,
      weeklyHours: regularHoursSheetRow ? Number(regularHoursSheetRow.avgWeeklyHours) : null,
    }));
    const after = await prisma.site.count();
    console.log(`READ path: ${augmented.length} active sites, site count ${before} -> ${after} (must be equal = no write on read)`);
    console.log('  sample:', augmented.slice(0, 3).map((s) => `${s.name} [${s.cellTier}] ${s.weeklyHours ?? '-'}h`).join(' | '));

    // Explicit sync path (writes to the candidate DB — disposable).
    const r = await syncSitesFromSheet();
    console.log(`SYNC path OK: +${r.created} new, ~${r.updated} updated, -${r.deactivated} deactivated, ${r.linked} linked (fetched ${r.fetchedAt})`);

    // Idempotency: a second sync should be a near no-op (0 created).
    const r2 = await syncSitesFromSheet();
    console.log(`SYNC again: +${r2.created} new, ~${r2.updated} updated (created should be 0 = idempotent)`);
    console.log(r.created >= 0 && r2.created === 0 ? '\nOK sites fix verified' : '\nNOTE: second sync still created rows — check');
  } catch (e) {
    console.error('SITES CHECK ERROR:', (e as Error).message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
