export const runtime = 'nodejs';

import { prisma } from '@/lib/db';
import { notifyTaskDue, notifyTaskOverdue, notifyEventReminder } from '@/lib/notifications';

/**
 * Cron-driven notification scheduler.
 *
 * Auth: middleware accepts Authorization: Bearer ${API_KEY}.
 *
 * POST /api/notifications/scheduler
 *
 * Optional body: { jobs: ('task_due'|'task_overdue'|'event_reminder')[] }
 * When omitted, all three jobs run.
 *
 * Cron schedule (intended, set up separately):
 *   - task_due       08:00 daily
 *   - task_overdue   09:00 daily
 *   - event_reminder every 5 min
 *
 * Edge cases:
 *  - Notifications dedup at notify() level so it is safe to re-run within 24h
 *  - Event reminders skip dedup (multiple reminders per event are legitimate)
 *  - Soft-deleted tasks / events excluded via deletedAt: null
 *  - completed/cancelled tasks skipped
 *  - Missing ownerId skipped (notify returns no_user)
 */
export async function POST(request: Request) {
  // Middleware already validated either Bearer API_KEY or session cookie.
  // For extra safety on this endpoint, require the API key path.
  if (request.headers.get('x-api-auth') !== 'true') {
    return Response.json({ error: 'API key required' }, { status: 401 });
  }

  let body: { jobs?: string[] } | null = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const jobs = body?.jobs ?? ['task_due', 'task_overdue', 'event_reminder'];

  const results: Record<string, { scanned: number; created: number; deduped: number }> = {};

  if (jobs.includes('task_due')) {
    results.task_due = await runTaskDue();
  }
  if (jobs.includes('task_overdue')) {
    results.task_overdue = await runTaskOverdue();
  }
  if (jobs.includes('event_reminder')) {
    results.event_reminder = await runEventReminder();
  }

  return Response.json({ ok: true, results, ranAt: new Date().toISOString() });
}

async function runTaskDue() {
  // Tasks whose dueDate falls today (between start and end of today, local server time)
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Safety cap: even with a 24h window, a runaway data condition shouldn't
  // let the scheduler iterate over an unbounded result set.
  const SCHEDULER_BATCH_LIMIT = 1000;
  const tasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      dueDate: { gte: startOfDay, lte: endOfDay },
      status: { notIn: ['completed'] },
    },
    select: { id: true, subject: true, dueDate: true, ownerId: true },
    orderBy: { dueDate: 'asc' },
    take: SCHEDULER_BATCH_LIMIT,
  });

  let created = 0;
  let deduped = 0;
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const r = await notifyTaskDue({
      ownerUserId: t.ownerId,
      taskId: t.id,
      subject: t.subject,
      dueDate: t.dueDate,
    });
    if (r.created) created += 1;
    else deduped += 1;
  }
  return { scanned: tasks.length, created, deduped };
}

async function runTaskOverdue() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  // Only look 30 days back: anything older has been chased manually or is
  // dead data. This is the scheduler watermark — without it, every cron run
  // pulls every overdue task ever created.
  const watermark = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const SCHEDULER_BATCH_LIMIT = 1000;

  const tasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      dueDate: { gte: watermark, lt: startOfDay },
      status: { notIn: ['completed'] },
    },
    select: { id: true, subject: true, dueDate: true, ownerId: true },
    orderBy: { dueDate: 'desc' },
    take: SCHEDULER_BATCH_LIMIT,
  });

  let created = 0;
  let deduped = 0;
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const r = await notifyTaskOverdue({
      ownerUserId: t.ownerId,
      taskId: t.id,
      subject: t.subject,
      dueDate: t.dueDate,
    });
    if (r.created) created += 1;
    else deduped += 1;
  }
  return { scanned: tasks.length, created, deduped };
}

async function runEventReminder() {
  // Fire reminders for events starting within the next 15 minutes.
  // notifyEventReminder uses dedupWindowHours: 0 so re-runs won't be deduped,
  // but we narrow the window so we only fire ~once per event.
  const now = new Date();
  const windowStart = new Date(now.getTime() + 10 * 60 * 1000); // 10 min from now
  const windowEnd = new Date(now.getTime() + 20 * 60 * 1000);   // 20 min from now

  const SCHEDULER_BATCH_LIMIT = 500;
  const events = await prisma.calendarEvent.findMany({
    where: {
      deletedAt: null,
      startDate: { gte: windowStart, lte: windowEnd },
    },
    select: {
      id: true,
      title: true,
      startDate: true,
      ownerId: true,
      invites: { select: { inviteeId: true } },
    },
    orderBy: { startDate: 'asc' },
    take: SCHEDULER_BATCH_LIMIT,
  });

  let created = 0;
  let deduped = 0;

  for (const e of events) {
    const minutesUntil = Math.round((e.startDate.getTime() - now.getTime()) / 60000);

    // Recipients = owner + invitees (deduped via Set)
    const recipientIds = new Set<string>([e.ownerId]);
    for (const inv of e.invites) recipientIds.add(inv.inviteeId);

    for (const userId of recipientIds) {
      // For the per-event uniqueness, do an explicit dedup check here on a 60-min window
      const since = new Date(now.getTime() - 60 * 60 * 1000);
      const existing = await prisma.notification.findFirst({
        where: {
          userId,
          type: 'event_reminder',
          entityId: e.id,
          createdAt: { gte: since },
        },
        select: { id: true },
      });
      if (existing) {
        deduped += 1;
        continue;
      }
      const r = await notifyEventReminder({
        userId,
        eventId: e.id,
        title: e.title,
        startTime: e.startDate,
        minutesUntil,
      });
      if (r.created) created += 1;
      else deduped += 1;
    }
  }

  return { scanned: events.length, created, deduped };
}
