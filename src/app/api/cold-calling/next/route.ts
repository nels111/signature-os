import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getNextLead } from '@/lib/cold-calling/queue';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await getNextLead();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Next lead error:', error);
    return NextResponse.json({ error: 'Failed to get next lead' }, { status: 500 });
  }
}
