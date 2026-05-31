import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = await params;

    const task = await prisma.task.findUnique({
      where: { id: taskId, deletedAt: null },
      select: { id: true, ownerId: true, status: true },
    });

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const isAdmin = session.user.role !== 'va';
    if (!isAdmin && task.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        previousStatus: task.status,
      },
      select: { id: true, status: true, completedAt: true },
    });

    return NextResponse.json({ ok: true, task: updated });
  } catch (error) {
    console.error('Complete task error:', error);
    return NextResponse.json({ error: 'Failed to complete task' }, { status: 500 });
  }
}
