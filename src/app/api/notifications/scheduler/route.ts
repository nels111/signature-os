export const runtime = 'nodejs';

import { prisma } from '@/lib/db';
import { notifyTaskDue, notifyTaskOverdue, notifyEventReminder, notifyLeadCold } from '@/lib/notifications';
import { expandRecurringEvent } from '@/lib/recurring';
import { sendPushToUser } from '@/lib/push';

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
 *   - lead_cold      08:30 daily
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
  const jobs = body?.jobs ?? ['task_due', 'task_overdue', 'event_reminder', 'lead_cold'];

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
  if (jobs.includes('lead_cold')) {
    results.lead_cold = await runLeadColdAlert();
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
  // Fire reminders for events (including recurring occurrences) starting within the next 15 minutes.
  const now = new Date();
  const windowStart = new Date(now.getTime() + 10 * 60 * 1000); // 10 min from now
  const windowEnd = new Date(now.getTime() + 20 * 60 * 1000);   // 20 min from now

  const SCHEDULER_BATCH_LIMIT = 500;

  // Fetch all events whose series has started by windowEnd.
  // Non-recurring: filtered by startDate in window.
  // Recurring: may have a future occurrence even if original startDate is in the past.
  const allEvents = await prisma.calendarEvent.findMany({
    where: {
      deletedAt: null,
      startDate: { lte: windowEnd },
    },
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      repeat: true,
      ownerId: true,
      invites: { select: { inviteeId: true } },
    },
    orderBy: { startDate: 'asc' },
    take: SCHEDULER_BATCH_LIMIT,
  });

  // Build unified list: find each event's notification time if it falls in the window
  const toNotify: Array<{ id: string; title: string; notifyAt: Date; ownerId: string; invites: { inviteeId: string }[] }> = [];

  for (const ev of allEvents) {
    if (!ev.repeat) {
      // Non-recurring: include only if startDate is in window
      if (ev.startDate >= windowStart && ev.startDate <= windowEnd) {
        toNotify.push({ ...ev, notifyAt: ev.startDate });
      }
    } else {
      // Recurring: expand and check for occurrence in window
      const occurrences = expandRecurringEvent(ev, windowStart, windowEnd);
      if (occurrences.length > 0) {
        toNotify.push({ ...ev, notifyAt: occurrences[0].startDate });
      }
    }
  }

  let created = 0;
  let deduped = 0;

  for (const e of toNotify) {
    const minutesUntil = Math.round((e.notifyAt.getTime() - now.getTime()) / 60000);

    // Recipients = owner + invitees (deduped via Set)
    const recipientIds = new Set<string>([e.ownerId]);
    for (const inv of e.invites) recipientIds.add(inv.inviteeId);

    for (const userId of recipientIds) {
      // Dedup: skip if we already sent an event_reminder for this event within the last 60 min
      // (safe for recurring since occurrences are at minimum 1 day apart)
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
        startTime: e.notifyAt,
        minutesUntil,
      });
      if (r.created) created += 1;
      else deduped += 1;
    }
  }

  return { scanned: toNotify.length, created, deduped };
}

/**
 * Lead cold alert: notify admin users about active leads with no activity in 14+ days.
 *
 * "Active" means the lead is not in a terminal stage (foad, not_interested_for_now).
 * We look at the Activity table for any activity against the lead within the last 14 days.
 * Uses the lead's updatedAt as a fallback if no explicit Activity exists.
 *
 * Dedup: 48h per lead so it resurfaces daily-ish without spamming.
 */
async function runLeadColdAlert() {
  const COLD_DAYS = 14;
  const BATCH_LIMIT = 200;

  const coldThreshold = new Date(Date.now() - COLD_DAYS * 24 * 60 * 60 * 1000);

  // Terminal stages to exclude — must match valid LeadStage enum values in schema
  const TERMINAL_STAGES = ['foad', 'not_interested_for_now'] as const;

  const leads = await prisma.lead.findMany({
    where: {
      stage: { notIn: [...TERMINAL_STAGES] },
      // Quick pre-filter: leads not updated recently (excludes obviously active ones)
      updatedAt: { lte: coldThreshold },
    },
    select: {
      id: true,
      companyName: true,
      contactName: true,
      updatedAt: true,
      ownerId: true,
    },
    take: BATCH_LIMIT,
    orderBy: { updatedAt: 'asc' },
  });

  if (leads.length === 0) return { scanned: 0, created: 0, deduped: 0 };

  // For each candidate, verify no recent Activity exists (updatedAt can be bumped by other ops)
  const leadIds = leads.map(l => l.id);
  const recentActivity = await prisma.activity.findMany({
    where: {
      entityType: 'lead',
      entityId: { in: leadIds },
      createdAt: { gte: coldThreshold },
    },
    select: { entityId: true },
  });
  const activeLeadIds = new Set(recentActivity.map(a => a.entityId));

  const coldLeads = leads.filter(l => !activeLeadIds.has(l.id));
  if (coldLeads.length === 0) return { scanned: leads.length, created: 0, deduped: 0 };

  // Find all admin users to notify
  const admins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: { id: true },
  });
  if (admins.length === 0) return { scanned: coldLeads.length, created: 0, deduped: 0 };

  let created = 0;
  let deduped = 0;

  for (const lead of coldLeads) {
    const daysSince = Math.floor((Date.now() - lead.updatedAt.getTime()) / (24 * 60 * 60 * 1000));
    const label = lead.companyName || lead.contactName || 'Unknown lead';

    for (const admin of admins) {
      const r = await notifyLeadCold({
        userId: admin.id,
        leadId: lead.id,
        leadLabel: label,
        daysSince,
      });
      if (r.created) {
        created += 1;
        // Push only on first alert (r.created) to avoid push spam
        sendPushToUser(admin.id, {
          title: `Lead gone cold (${daysSince}d)`,
          body: label,
          icon: '/icon-192.png',
          url: `/dashboard/leads/${lead.id}`,
          tag: `lead-cold-${lead.id}`,
        }).catch(err => console.error('[scheduler] cold lead push failed:', err));
      } else {
        deduped += 1;
      }
    }
  }

  return { scanned: coldLeads.length, created, deduped };
}
