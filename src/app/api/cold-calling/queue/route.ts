import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getQueue } from '@/lib/cold-calling/queue';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '25'), 100);

    const queue = await getQueue(limit);
    return NextResponse.json(queue);
  } catch (error) {
    console.error('Queue fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 });
  }
}
