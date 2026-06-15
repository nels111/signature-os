import { NextResponse } from 'next/server';
import { syncAllConfiguredMailboxes } from '@/lib/email-sync';

export const runtime = 'nodejs';
export const maxDuration = 120;

// GET /api/cron/sync-emails — scheduled IMAP sync for every configured mailbox.
// Auth is handled by the global middleware: callers must present a valid
// Bearer API_KEY (the cron) or a logged-in session. Keeps the per-lead and
// per-contact email threads current without anyone opening the inbox.
export async function GET() {
  try {
    const res = await syncAllConfiguredMailboxes();
    return NextResponse.json({ ok: true, ...res });
  } catch (error) {
    console.error('[cron/sync-emails]', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
