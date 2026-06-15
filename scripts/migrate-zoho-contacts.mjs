/**
 * Zoho → SigOS Contacts migration (G5: retire Zoho).
 *
 * 9 Jun decision (#75 §4):
 *   - Migrate ALL Zoho Contacts (active clients) into SigOS contacts.
 *   - Scrape the Zoho DEAL pipeline and attach deal context to the matching contact
 *     (deals were never converted properly in Zoho).
 *   - Do NOT migrate Zoho Leads (start leads fresh).
 *
 * Safe by default: DRY-RUN (no writes). Prints the plan + sample mappings and
 * writes a full plan to /tmp/zoho-migration-plan.json. Pass --live to actually
 * write (creates contacts, dedupes by email, soft-marks them source-tagged).
 *
 * Run:  node --env-file=.env scripts/migrate-zoho-contacts.mjs
 *       node --env-file=.env scripts/migrate-zoho-contacts.mjs --live
 */
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const LIVE = process.argv.includes('--live');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const {
  ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN,
  ZOHO_API_DOMAIN, ZOHO_ACCOUNTS_URL, AGENT_OWNER_USER_ID,
} = process.env;

const OWNER_ID = AGENT_OWNER_USER_ID; // Nelson — createdBy for migrated contacts

function mapSource(zohoSource) {
  const s = (zohoSource || '').toLowerCase();
  if (s.includes('cold call')) return 'cold_call';
  if (s.includes('email')) return 'cold_email';
  if (s.includes('referr')) return 'referral';
  if (s.includes('web')) return 'website';
  if (s.includes('linkedin')) return 'linkedin';
  if (s.includes('partner')) return 'partner';
  if (s.includes('mail')) return 'direct_mail';
  return 'other';
}

async function zohoToken() {
  const res = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      refresh_token: ZOHO_REFRESH_TOKEN,
    }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error('Zoho auth failed: ' + JSON.stringify(j));
  return j.access_token;
}

async function fetchAll(token, module, fields) {
  const out = [];
  let pageToken = null;
  for (let i = 0; i < 50; i++) {
    const url = new URL(`${ZOHO_API_DOMAIN}/crm/v7/${module}`);
    url.searchParams.set('fields', fields);
    url.searchParams.set('per_page', '200');
    if (pageToken) url.searchParams.set('page_token', pageToken);
    const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
    if (res.status === 204) break;
    const j = await res.json();
    if (!j.data) break;
    out.push(...j.data);
    if (j.info?.more_records && j.info?.next_page_token) pageToken = j.info.next_page_token;
    else break;
  }
  return out;
}

// Exclude obvious test rows and internal staff (not real client contacts).
const INTERNAL_EMAILS = new Set([
  'nelson@signature-cleans.co.uk', 'nick@signature-cleans.co.uk',
  'jasmin@signature-cleans.co.uk', 'jaz@signature-cleans.co.uk',
  'hello@signature-cleans.co.uk',
]);
function isTestOrInternal(z, email) {
  const blob = `${z.Full_Name || ''} ${z.First_Name || ''} ${z.Last_Name || ''} ${z.Account_Name?.name || ''}`.toLowerCase();
  if (/\btest\b|test company|demo/.test(blob)) return true;
  if (email && (INTERNAL_EMAILS.has(email) || email.endsWith('@signature-cleans.co.uk'))) return true;
  return false;
}

function splitName(full) {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: 'Unknown', last: '—' };
  if (parts.length === 1) return { first: parts[0], last: '—' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

async function main() {
  console.log(`\n=== Zoho → Contacts migration (${LIVE ? 'LIVE WRITE' : 'DRY RUN'}) ===\n`);
  if (!OWNER_ID) throw new Error('AGENT_OWNER_USER_ID not set');

  const token = await zohoToken();
  console.log('Zoho auth OK');

  const contacts = await fetchAll(token, 'Contacts',
    'First_Name,Last_Name,Full_Name,Email,Phone,Mobile,Account_Name,Title,Department,Lead_Source,Description,Mailing_Street,Mailing_City,Mailing_Zip');
  const deals = await fetchAll(token, 'Deals',
    'Deal_Name,Stage,Amount,Closing_Date,Account_Name,Contact_Name');
  console.log(`Fetched ${contacts.length} Zoho contacts, ${deals.length} deals`);

  // Index deals by contact id and by account name for context attachment
  const dealsByContact = new Map();
  for (const d of deals) {
    const cid = d.Contact_Name?.id;
    if (!cid) continue;
    if (!dealsByContact.has(cid)) dealsByContact.set(cid, []);
    dealsByContact.get(cid).push(d);
  }

  // Existing SigOS contacts (dedupe by lowercased email)
  const existing = await prisma.contact.findMany({
    where: { deletedAt: null },
    select: { email: true },
  });
  const existingEmails = new Set(existing.map((c) => (c.email || '').toLowerCase()).filter(Boolean));

  const plan = { create: [], skipDuplicate: [], skipNoData: [], skipTestInternal: [], dealsAttached: 0 };

  for (const z of contacts) {
    const email = (z.Email || '').toLowerCase().trim() || null;
    if (isTestOrInternal(z, email)) { plan.skipTestInternal.push(z.Full_Name || z.Account_Name?.name || z.id); continue; }
    let first = z.First_Name, last = z.Last_Name;
    if (!first && !last) { const s = splitName(z.Full_Name); first = s.first; last = s.last; }
    first = (first || 'Unknown').trim();
    last = (last || '—').trim();

    if (!email && !z.Full_Name && !z.Account_Name?.name) { plan.skipNoData.push(z.id); continue; }
    if (email && existingEmails.has(email)) { plan.skipDuplicate.push({ email }); continue; }

    const zDeals = dealsByContact.get(z.id) || [];
    const dealLines = zDeals.map((d) =>
      `Deal: ${d.Deal_Name} — ${d.Stage}${d.Amount ? ` — £${d.Amount}` : ''}${d.Closing_Date ? ` (close ${d.Closing_Date})` : ''}`);
    if (dealLines.length) plan.dealsAttached += dealLines.length;

    const noteParts = [];
    if (z.Title) noteParts.push(`Title: ${z.Title}`);
    if (z.Department) noteParts.push(`Dept: ${z.Department}`);
    const addr = [z.Mailing_Street, z.Mailing_City, z.Mailing_Zip].filter(Boolean).join(', ');
    if (addr) noteParts.push(`Address: ${addr}`);
    if (z.Description) noteParts.push(z.Description);
    if (dealLines.length) noteParts.push('— Zoho deals —', ...dealLines);
    noteParts.push(`[Imported from Zoho ${z.id}]`);

    plan.create.push({
      firstName: first,
      lastName: last,
      email,
      phone: z.Phone || z.Mobile || null,
      company: z.Account_Name?.name || null,
      source: mapSource(z.Lead_Source),
      notes: noteParts.join('\n'),
      createdBy: OWNER_ID,
    });
    if (email) existingEmails.add(email); // avoid in-batch dupes
  }

  console.log(`\nPLAN:`);
  console.log(`  would CREATE     : ${plan.create.length}`);
  console.log(`  skip (duplicate) : ${plan.skipDuplicate.length}`);
  console.log(`  skip (no data)   : ${plan.skipNoData.length}`);
  console.log(`  skip (test/internal): ${plan.skipTestInternal.length} ${plan.skipTestInternal.length ? '→ ' + plan.skipTestInternal.join(', ') : ''}`);
  console.log(`  deal lines attached to contacts: ${plan.dealsAttached}`);
  console.log(`\nSAMPLE (first 5 to create):`);
  for (const c of plan.create.slice(0, 5)) {
    console.log(`  • ${c.firstName} ${c.lastName} | ${c.email || 'no-email'} | ${c.company || 'no-company'} | src=${c.source}`);
  }

  const fs = await import('node:fs');
  fs.writeFileSync('/tmp/zoho-migration-plan.json', JSON.stringify(plan, null, 2));
  console.log(`\nFull plan written to /tmp/zoho-migration-plan.json`);

  if (LIVE) {
    console.log(`\nWRITING ${plan.create.length} contacts...`);
    let n = 0;
    for (const c of plan.create) { await prisma.contact.create({ data: c }); n++; }
    console.log(`Created ${n} contacts.`);
  } else {
    console.log(`\nDRY RUN — nothing written. Re-run with --live to import.`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
