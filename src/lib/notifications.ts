import { prisma } from '@/lib/db';
import type { NotificationType } from '@prisma/client';

/**
 * Notification helper with 24-hour dedup.
 *
 * Dedup rule: if a notification with the same userId + type + entityId
 * was created in the last 24 hours, skip creating a duplicate.
 *
 * Edge cases handled:
 *  - userId missing -> silent no-op (never throw upstream)
 *  - entityId missing -> dedup falls back to userId + type only
 *  - target user is the actor (e.g. user assigns lead to themselves) -> skip
 *  - DB error -> log and swallow (never break the calling request)
 */
export interface NotifyOptions {
  userId: string | null | undefined;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  /** If set, do not notify this user (caller is also the target). */
  actorUserId?: string | null;
  /** Override the 24h dedup window in hours. Pass 0 to disable dedup. */
  dedupWindowHours?: number;
}

const DEFAULT_DEDUP_HOURS = 24;

export async function notify(opts: NotifyOptions): Promise<{ created: boolean; reason?: string }> {
  try {
    if (!opts.userId) return { created: false, reason: 'no_user' };

    // Never notify the actor about their own action
    if (opts.actorUserId && opts.actorUserId === opts.userId) {
      return { created: false, reason: 'self_action' };
    }

    const dedupHours = opts.dedupWindowHours ?? DEFAULT_DEDUP_HOURS;

    if (dedupHours > 0) {
      const since = new Date(Date.now() - dedupHours * 60 * 60 * 1000);
      const existing = await prisma.notification.findFirst({
        where: {
          userId: opts.userId,
          type: opts.type,
          entityId: opts.entityId ?? null,
          createdAt: { gte: since },
        },
        select: { id: true },
      });
      if (existing) return { created: false, reason: 'deduped' };
    }

    await prisma.notification.create({
      data: {
        userId: opts.userId,
        type: opts.type,
        title: opts.title,
        message: opts.message,
        entityType: opts.entityType ?? null,
        entityId: opts.entityId ?? null,
      },
    });

    return { created: true };
  } catch (err) {
    console.error('[notify] failed to create notification', err);
    return { created: false, reason: 'error' };
  }
}

/**
 * Convenience helpers for the specific event types.
 * These keep the calling code clean and centralize the message format.
 */

export async function notifyLeadAssigned(params: {
  ownerUserId: string;
  actorUserId?: string | null;
  leadId: string;
  leadLabel: string;
}) {
  return notify({
    userId: params.ownerUserId,
    actorUserId: params.actorUserId ?? null,
    type: 'lead_assigned',
    title: 'Lead assigned to you',
    message: params.leadLabel,
    entityType: 'lead',
    entityId: params.leadId,
  });
}

export async function notifyDealStageChanged(params: {
  ownerUserId: string;
  actorUserId?: string | null;
  dealId: string;
  dealName: string;
  fromStage: string;
  toStage: string;
}) {
  return notify({
    userId: params.ownerUserId,
    actorUserId: params.actorUserId ?? null,
    type: 'deal_stage_changed',
    title: `Deal moved to ${params.toStage.replace(/_/g, ' ')}`,
    message: `${params.dealName}: ${params.fromStage.replace(/_/g, ' ')} -> ${params.toStage.replace(/_/g, ' ')}`,
    entityType: 'deal',
    entityId: params.dealId,
    // Stage changes can happen multiple times legitimately; dedup keyed on entityId
    // would suppress later moves. Use a smaller window so each genuine move surfaces.
    dedupWindowHours: 1,
  });
}

export async function notifyTaskDue(params: {
  ownerUserId: string;
  taskId: string;
  subject: string;
  dueDate: Date;
}) {
  return notify({
    userId: params.ownerUserId,
    type: 'task_due',
    title: 'Task due today',
    message: params.subject,
    entityType: 'task',
    entityId: params.taskId,
  });
}

export async function notifyTaskOverdue(params: {
  ownerUserId: string;
  taskId: string;
  subject: string;
  dueDate: Date;
}) {
  const days = Math.max(1, Math.floor((Date.now() - params.dueDate.getTime()) / (24 * 60 * 60 * 1000)));
  return notify({
    userId: params.ownerUserId,
    type: 'task_overdue',
    title: days === 1 ? 'Task overdue' : `Task overdue (${days} days)`,
    message: params.subject,
    entityType: 'task',
    entityId: params.taskId,
  });
}

export async function notifyEventReminder(params: {
  userId: string;
  eventId: string;
  title: string;
  startTime: Date;
  minutesUntil: number;
}) {
  return notify({
    userId: params.userId,
    type: 'event_reminder',
    title: `Meeting in ${params.minutesUntil} min`,
    message: params.title,
    entityType: 'event',
    entityId: params.eventId,
    // Two reminders may legitimately fire (1d before + 15min before)
    dedupWindowHours: 0,
  });
}

export async function notifyAuditDue(params: {
  ownerUserId: string;
  auditId: string;
  siteName: string;
  daysUntilDue: number;
}) {
  return notify({
    userId: params.ownerUserId,
    type: 'audit_due',
    title: `Audit due in ${params.daysUntilDue} day${params.daysUntilDue === 1 ? '' : 's'}`,
    message: params.siteName,
    entityType: 'audit',
    entityId: params.auditId,
  });
}

export async function notifyShiftAlert(params: {
  userId: string;
  shiftKey: string;
  title: string;
  message: string;
}) {
  return notify({
    userId: params.userId,
    type: 'shift_alert',
    title: params.title,
    message: params.message,
    entityType: 'shift',
    entityId: params.shiftKey,
    dedupWindowHours: 12,
  });
}
