import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { StartCallSchema } from '@/lib/cold-calling/validators';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = StartCallSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { leadId } = parsed.data;

    // Verify lead exists and is callable
    const lead = await prisma.lead.findUnique({
      where: { id: leadId, deletedAt: null },
      select: { id: true, isCallable: true },
    });
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (!lead.isCallable) return NextResponse.json({ error: 'Lead is not callable' }, { status: 400 });

    const attempt = await prisma.coldCallAttempt.create({
      data: {
        leadId,
        userId: session.user.id,
        direction: 'outbound',
        status: 'queued',
        startedAt: new Date(),
      },
      select: { id: true, leadId: true },
    });

    return NextResponse.json({ attemptId: attempt.id, leadId: attempt.leadId });
  } catch (error) {
    console.error('Start call error:', error);
    return NextResponse.json({ error: 'Failed to start call' }, { status: 500 });
  }
}
