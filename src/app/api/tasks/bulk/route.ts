export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { TaskStatus } from '@prisma/client';

type BulkAction = 'mark_done' | 'mark_undone' | 'delete';

const VALID_ACTIONS: BulkAction[] = ['mark_done', 'mark_undone', 'delete'];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
    return Response.json({ error: 'ids[] is required' }, { status: 400 });
  }
  if (!VALID_ACTIONS.includes(body.action)) {
    return Response.json({ error: 'invalid action' }, { status: 400 });
  }

  const ids: string[] = body.ids.filter((x: unknown) => typeof x === 'string');
  if (ids.length === 0) {
    return Response.json({ error: 'no valid ids' }, { status: 400 });
  }
  if (ids.length > 100) {
    return Response.json({ error: 'max 100 ids per call' }, { status: 400 });
  }

  const action: BulkAction = body.action;

  // Load all tasks, filter by permission (personal: only owner)
  const tasks = await prisma.task.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, status: true, previousStatus: true, taskType: true, ownerId: true },
  });

  const allowed = tasks.filter(t =>
    !(t.taskType === 'personal' && t.ownerId !== session.user.id)
  );
  const skipped = tasks.length - allowed.length;

  let processed = 0;
  const errors: { id: string; error: string }[] = [];

  // Process each individually so one failure does not abort the batch
  for (const t of allowed) {
    try {
      if (action === 'delete') {
        await prisma.task.update({ where: { id: t.id }, data: { deletedAt: new Date() } });
        processed += 1;
        continue;
      }
      if (action === 'mark_done') {
        if (t.status === 'completed') continue; // idempotent skip
        await prisma.task.update({
          where: { id: t.id },
          data: {
            status: 'completed',
            previousStatus: t.status,
            completedAt: new Date(),
          },
        });
        processed += 1;
        continue;
      }
      if (action === 'mark_undone') {
        if (t.status !== 'completed') continue;
        const restore: TaskStatus = (t.previousStatus ?? 'not_started') as TaskStatus;
        await prisma.task.update({
          where: { id: t.id },
          data: {
            status: restore,
            previousStatus: null,
            completedAt: null,
          },
        });
        processed += 1;
      }
    } catch (e) {
      errors.push({ id: t.id, error: e instanceof Error ? e.message : 'unknown error' });
    }
  }

  return Response.json({
    requested: ids.length,
    processed,
    skipped,
    notFound: ids.length - tasks.length,
    errors,
  });
}
