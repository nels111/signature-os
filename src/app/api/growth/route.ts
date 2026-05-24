import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasRole } from '@/lib/authz';
import { fetchHoursSheet } from '@/lib/dropbox-hours';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TARGET_HOURS = 1000;
const TARGET_DATE = new Date('2026-12-31T23:59:59Z');

// 15-min cache
let cache: { data: object | null; expires: number } = { data: null, expires: 0 };

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Financial data (weekly earnings, contract values). Restrict to leadership.
  if (!hasRole(session, 'admin', 'sales', 'operations')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (cache.data && Date.now() < cache.expires) {
    return NextResponse.json(cache.data);
  }

  let hoursSheet: Awaited<ReturnType<typeof fetchHoursSheet>> | null = null;
  try {
    hoursSheet = await fetchHoursSheet();
  } catch (err) {
    console.error('Growth tracker: hours sheet fetch failed', err);
  }

  const now = new Date();
  const weeksRemaining = Math.max(0, (TARGET_DATE.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000));

  const currentHours = hoursSheet?.totals.weeklyHours ?? 0;
  const pipelineHours = hoursSheet
    ? hoursSheet.contracts
        .filter((c) => c.status === 'pipeline')
        .reduce((s, c) => s + c.weeklyHours, 0)
    : 0;

  const gap = Math.max(0, TARGET_HOURS - currentHours);
  const weeklyGainNeeded = weeksRemaining > 0 ? gap / weeksRemaining : gap;
  const progressPct = Math.min(100, (currentHours / TARGET_HOURS) * 100);

  // Active contracts sorted by weekly hours desc
  const activeContracts = hoursSheet
    ? hoursSheet.contracts
        .filter((c) => c.status === 'active' && c.weeklyHours > 0)
        .sort((a, b) => b.weeklyHours - a.weeklyHours)
    : [];

  const pipelineContracts = hoursSheet
    ? hoursSheet.contracts
        .filter((c) => c.status === 'pipeline' && c.weeklyHours > 0)
        .sort((a, b) => b.weeklyHours - a.weeklyHours)
    : [];

  const data = {
    currentHours,
    targetHours: TARGET_HOURS,
    progressPct,
    gap,
    weeksRemaining: Math.round(weeksRemaining * 10) / 10,
    weeklyGainNeeded: Math.round(weeklyGainNeeded * 10) / 10,
    pipelineHours,
    activeContracts,
    pipelineContracts,
    weeklyEarnings: hoursSheet?.totals.weeklyEarnings ?? 0,
    monthlyEarnings: hoursSheet?.totals.monthlyEarnings ?? 0,
    fetchedAt: hoursSheet?.fetchedAt ?? null,
  };

  cache = { data, expires: Date.now() + 15 * 60 * 1000 };
  return NextResponse.json(data);
}
