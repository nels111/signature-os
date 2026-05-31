import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { applyColdCallOutcome } from '@/lib/cold-calling/outcome-rules';
import { OutcomeSchema } from '@/lib/cold-calling/validators';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { attemptId } = await params;

    // Verify attempt exists and belongs to this user
    const attempt = await prisma.coldCallAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, leadId: true, userId: true, outcome: true },
    });

    if (!attempt) {
      return NextResponse.json({ error: 'Call attempt not found' }, { status: 404 });
    }

    // Allow admins to log any attempt; VA can only log their own
    const isAdmin = session.user.role !== 'va';
    if (!isAdmin && attempt.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Prevent double-logging
    if (attempt.outcome) {
      return NextResponse.json({ error: 'Outcome already logged for this attempt' }, { status: 409 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = OutcomeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const result = await applyColdCallOutcome({
      leadId: attempt.leadId,
      attemptId,
      userId: session.user.id,
      payload: parsed.data,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Outcome error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to apply outcome' }, { status: 500 });
  }
}
