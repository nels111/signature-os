// Full historical sync using parallel IMAP fetches
// Leverages IONOS-to-IONOS network speed
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import pg from 'pg';

const DB_URL = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString: DB_URL, max: 10 });

const MAILBOXES = [
  { email: 'nelson@signature-cleans.co.uk', password: 'BioClean2025',
    folders: ['INBOX', 'Sent Items', 'Subcontractors', 'Drafts'] },
  { email: 'hello@signature-cleans.co.uk', password: 'BioClean2025',
    folders: ['INBOX', 'Sent Items'] },
];

async function getUserId(email) {
  const res = await pool.query('SELECT id FROM users WHERE "ionosEmail" = $1', [email]);
  if (res.rows.length > 0) return res.rows[0].id;
  const nelson = await pool.query('SELECT id FROM users WHERE email = $1', ['nelson@signature-cleans.co.uk']);
  return nelson.rows[0]?.id || null;
}

async function processMessage(msg, folder, email, userId) {
  if (!msg.source) return false;
  const p = await simpleParser(msg.source);
  const mid = p.messageId || `${email}-${folder}-${msg.uid}`;
  const from = p.from?.text || '';
  const to = p.to ? (Array.isArray(p.to) ? p.to.map(t => t.text) : [p.to.text]) : [];
  const cc = p.cc ? (Array.isArray(p.cc) ? p.cc.map(c => c.text) : [p.cc.text]) : [];

  await pool.query(
    `INSERT INTO emails ("id","messageId","mailbox","from","to","cc","subject","bodyText","bodyHtml","date","folder","userId","isRead","createdAt")
     VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,NOW())
     ON CONFLICT ("messageId") DO UPDATE SET folder=$10`,
    [mid, email, from, to, cc, p.subject || '(No Subject)', p.text || null, p.html || null, p.date || new Date(), folder, userId]
  );
  return true;
}

async function syncFolder(client, folder, email, userId) {
  let lock;
  try {
    lock = await client.getMailboxLock(folder);
  } catch (e) {
    console.log(`  Skip ${folder}: ${e.message}`);
    return 0;
  }

  const total = client.mailbox.exists || 0;
  if (total === 0) { lock.release(); return 0; }
  console.log(`  ${folder}: ${total} messages`);

  let synced = 0;
  let errs = 0;
  const BATCH = 20;

  try {
    for (let start = 1; start <= total; start += BATCH) {
      const end = Math.min(start + BATCH - 1, total);

      // Collect batch
      const msgs = [];
      try {
        for await (const msg of client.fetch(`${start}:${end}`, { source: true, uid: true })) {
          msgs.push(msg);
        }
      } catch {
        errs += BATCH;
        continue;
      }

      // Process batch in parallel (5 concurrent)
      const chunks = [];
      for (let i = 0; i < msgs.length; i += 5) {
        chunks.push(msgs.slice(i, i + 5));
      }

      for (const chunk of chunks) {
        const results = await Promise.allSettled(
          chunk.map(msg => processMessage(msg, folder, email, userId))
        );
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) synced++;
          else errs++;
        }
      }

      if (end % 100 === 0 || end === total) {
        console.log(`  ${folder}: ${end}/${total} (${synced} ok, ${errs} err)`);
      }
    }
  } finally {
    lock.release();
  }

  console.log(`  ${folder} DONE: ${synced} synced`);
  return synced;
}

async function syncMailbox(mb) {
  const userId = await getUserId(mb.email);
  if (!userId) { console.error(`No user for ${mb.email}`); return; }

  console.log(`\n=== ${mb.email} ===`);

  const client = new ImapFlow({
    host: 'imap.ionos.co.uk', port: 993, secure: true,
    auth: { user: mb.email, pass: mb.password },
    logger: false,
  });

  await client.connect();
  let grand = 0;

  for (const folder of mb.folders) {
    grand += await syncFolder(client, folder, mb.email, userId);
  }

  await client.logout().catch(() => {});
  console.log(`${mb.email} TOTAL: ${grand}`);
}

async function main() {
  const t0 = Date.now();
  console.log('Full Historical Sync (IONOS optimised)\n');

  for (const mb of MAILBOXES) {
    try { await syncMailbox(mb); }
    catch (e) { console.error(`${mb.email} FAILED: ${e.message}`); }
  }

  const r = await pool.query(`SELECT mailbox, COUNT(*) as c, MIN(date)::date as oldest, MAX(date)::date as newest FROM emails GROUP BY mailbox`);
  console.log('\n=== FINAL ===');
  for (const row of r.rows) console.log(`${row.mailbox}: ${row.c} emails (${row.oldest} → ${row.newest})`);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`\nCompleted in ${elapsed}s`);
  await pool.end();
}

main();
