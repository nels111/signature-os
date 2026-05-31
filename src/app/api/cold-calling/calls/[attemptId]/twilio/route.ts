import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AttachTwilioSchema } from '@/lib/cold-calling/validators';

export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { attemptId } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = AttachTwilioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { twilioCallSid, status, startedAt } = parsed.data;

    await prisma.coldCallAttempt.update({
      where: { id: attemptId },
      data: {
        twilioCallSid,
        status: status === 'in_progress' ? 'in_progress' : 'ringing',
        startedAt: startedAt ? new Date(startedAt) : undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Attach Twilio error:', error);
    return NextResponse.json({ error: 'Failed to attach Twilio data' }, { status: 500 });
  }
}
