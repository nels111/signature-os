import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getColdCallingStats, getVaStats } from '@/lib/cold-calling/stats';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') ?? 'week') as 'today' | 'week' | 'month';

    const isVa = session.user.role === 'va';

    if (isVa) {
      const stats = await getVaStats(session.user.id, range);
      return NextResponse.json(stats);
    }

    const stats = await getColdCallingStats(range);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
