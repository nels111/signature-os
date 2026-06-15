import { NextRequest, NextResponse } from 'next/server';
import { syncAllConfiguredMailboxes } from '@/lib/email-sync';

export const runtime = 'nodejs';
export const maxDuration = 120;

// GET /api/cron/sync-emails — scheduled IMAP sync for every configured mailbox.
// Protected by CRON_SECRET (Authorization: Bearer <secret>). Keeps the per-lead
// and per-contact email threads current without anyone opening the inbox.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const res = await syncAllConfiguredMailboxes();
    return NextResponse.json({ ok: true, ...res });
  } catch (error) {
    console.error('[cron/sync-emails]', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
