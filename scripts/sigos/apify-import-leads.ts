/**
 * Apify Google Maps -> cold-calling queue importer.
 *
 *   npx tsx scripts/sigos/apify-import-leads.ts            # pull + show what would import (no DB writes)
 *   npx tsx scripts/sigos/apify-import-leads.ts --apply    # pull + create leads
 *
 * NOTE: the PULL itself spends Apify credits (whether or not --apply is set).
 * Only run on Nelson's go. The DB write is gated by --apply.
 *
 * Maps each place -> Lead { companyName, phone, sector, source=cold_call,
 * stage=cold_call, callStatus defaults to 'new' (queue-ready), ownerId=Nelson }.
 * De-dupes within the batch and against existing non-deleted leads (by phone
 * digits, then by normalized company name).
 */
import 'dotenv/config';
import { prisma } from '@/lib/db';
import { pullPlaces, type ApifyPlace } from './apify-pull';

const APPLY = process.argv.includes('--apply');
const OWNER_EMAIL = 'nelson@signature-cleans.co.uk';

// Target categories (Google Maps search strings) × locations. Override per run:
//   --searches "gym,car dealership"   --location "Exeter, UK"   (locations ';'-separated)
function argVal(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
const DEFAULT_SEARCHES = 'office,solicitors,accountants,estate agents,restaurant,pub,hotel,car dealership,dental practice,veterinary clinic,gym,care home,private school';
const SEARCHES = (argVal('--searches') ?? DEFAULT_SEARCHES).split(',').map((s) => s.trim()).filter(Boolean);
const LOCATIONS = (argVal('--location') ?? 'Exeter, UK;Plymouth, UK').split(';').map((s) => s.trim()).filter(Boolean);
const PER_SEARCH = Number(argVal('--limit') ?? 25);

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function phoneDigits(s: string | undefined | null): string {
  if (!s) return '';
  const d = s.replace(/\D/g, '');
  // last 10 digits = the significant part (handles +44 / 0 prefixes)
  return d.slice(-10);
}

async function main() {
  const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true } });
  if (!owner) throw new Error(`owner ${OWNER_EMAIL} not found`);

  // Existing leads for de-dupe (non-deleted).
  const existing = await prisma.lead.findMany({
    where: { deletedAt: null },
    select: { companyName: true, phone: true },
  });
  const seenNames = new Set(existing.map((l) => normName(l.companyName)));
  const seenPhones = new Set(existing.map((l) => phoneDigits(l.phone)).filter(Boolean));

  // Pull all (search × location).
  const places: ApifyPlace[] = [];
  for (const location of LOCATIONS) {
    for (const search of SEARCHES) {
      try {
        const got = await pullPlaces(search, location, PER_SEARCH);
        console.log(`  pulled ${got.length.toString().padStart(3)}  ${search} @ ${location}`);
        places.push(...got);
      } catch (e) {
        console.error(`  ERROR ${search} @ ${location}: ${(e as Error).message}`);
      }
    }
  }
  console.log(`\nTotal pulled: ${places.length}`);

  // De-dupe + map.
  const toCreate: { companyName: string; phone: string; sector: string | null; notes: string }[] = [];
  let dupExisting = 0;
  let dupBatch = 0;
  let noPhone = 0;

  for (const p of places) {
    const name = (p.title || '').trim();
    const phone = (p.phone || p.phoneUnformatted || '').trim();
    if (!name) continue;
    if (!phone) { noPhone++; continue; }
    const nk = normName(name);
    const pk = phoneDigits(phone);
    if (seenNames.has(nk) || (pk && seenPhones.has(pk))) { dupExisting++; continue; }
    // within-batch dedupe
    if (seenNames.has('B:' + nk) || (pk && seenPhones.has('B:' + pk))) { dupBatch++; continue; }
    seenNames.add('B:' + nk);
    if (pk) seenPhones.add('B:' + pk);

    toCreate.push({
      companyName: name,
      phone,
      sector: p.categoryName || null,
      notes: [p.address, p.website].filter(Boolean).join(' · '),
    });
  }

  console.log(`\nNew to import: ${toCreate.length}`);
  console.log(`Skipped — already in OS: ${dupExisting} · duplicate in batch: ${dupBatch} · no phone: ${noPhone}`);
  console.log('\nSample of new leads:');
  for (const l of toCreate.slice(0, 12)) {
    console.log(`  ${l.companyName.slice(0, 34).padEnd(36)} ${l.phone.padEnd(16)} ${l.sector ?? ''}`);
  }

  if (!APPLY) {
    console.log('\n(DRY RUN — no DB writes. Re-run with --apply to import.)');
    await prisma.$disconnect();
    return;
  }

  let created = 0;
  for (const l of toCreate) {
    await prisma.lead.create({
      data: {
        companyName: l.companyName,
        phone: l.phone,
        sector: l.sector,
        coldCallNotes: l.notes || null,
        source: 'cold_call' as never,
        stage: 'cold_call' as never,
        // callStatus defaults to 'new' (DB default) -> enters the v2 queue
        ownerId: owner.id,
      },
    });
    created++;
  }
  console.log(`\n✅ Imported ${created} leads into the cold-calling queue.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
