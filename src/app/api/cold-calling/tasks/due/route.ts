import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const isVa = session.user.role === 'va';

    const tasks = await prisma.task.findMany({
      where: {
        taskType: { in: ['callback', 'follow_up_call', 'contract_renewal_follow_up'] as never[] },
        status: { in: ['not_started', 'in_progress', 'waiting'] },
        dueDate: { lte: now },
        deletedAt: null,
        ...(isVa ? { ownerId: session.user.id } : {}),
        linkedLead: { isCallable: true, deletedAt: null },
      },
      include: {
        linkedLead: {
          select: {
            id: true,
            companyName: true,
            contactName: true,
            phone: true,
            email: true,
            stage: true,
          },
        },
        owner: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 50,
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Due tasks error:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}
