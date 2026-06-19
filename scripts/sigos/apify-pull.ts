/**
 * Apify Google Maps lead puller (test/dev).
 *   npx tsx scripts/sigos/apify-pull.ts "<search>" "<location>" <limit>
 * Reads APIFY_API_TOKEN from .env (never pass it on the command line).
 *
 * Returns Google Maps places: business name, phone, address, website, category.
 */
import 'dotenv/config';

const TOKEN = process.env.APIFY_API_TOKEN;
const ACTOR = 'compass~crawler-google-places';

export interface ApifyPlace {
  title?: string;
  phone?: string;
  phoneUnformatted?: string;
  address?: string;
  website?: string;
  categoryName?: string;
  city?: string;
  postalCode?: string;
  url?: string;
  totalScore?: number;
}

export async function pullPlaces(search: string, location: string, limit: number): Promise<ApifyPlace[]> {
  if (!TOKEN) throw new Error('APIFY_API_TOKEN not set');
  const input = {
    searchStringsArray: [search],
    locationQuery: location,
    maxCrawledPlacesPerSearch: limit,
    language: 'en',
    skipClosedPlaces: true,
  };
  const url = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${TOKEN}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Apify ${res.status}: ${t.slice(0, 400)}`);
  }
  return (await res.json()) as ApifyPlace[];
}

// CLI
if (process.argv[1] && process.argv[1].includes('apify-pull')) {
  const [search, location, limitStr] = process.argv.slice(2);
  pullPlaces(search || 'dental practice', location || 'Exeter, UK', Number(limitStr) || 20)
    .then((items) => {
      const withPhone = items.filter((i) => i.phone || i.phoneUnformatted).length;
      const pct = items.length ? Math.round((withPhone / items.length) * 100) : 0;
      console.log(`\nPulled ${items.length} results · ${withPhone} with phone (${pct}%)\n`);
      console.log('NAME'.padEnd(34) + 'PHONE'.padEnd(17) + 'CATEGORY'.padEnd(22) + 'SITE');
      for (const i of items.slice(0, 30)) {
        console.log(
          (i.title || '?').slice(0, 32).padEnd(34) +
            (i.phone || i.phoneUnformatted || '—').slice(0, 15).padEnd(17) +
            (i.categoryName || '').slice(0, 20).padEnd(22) +
            (i.website ? 'yes' : ''),
        );
      }
    })
    .catch((e) => {
      console.error('PULL ERROR:', e.message);
      process.exit(1);
    });
}
