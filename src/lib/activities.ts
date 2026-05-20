import { prisma } from '@/lib/db';
import type { ActivityType } from '@prisma/client';

/**
 * Activity logger.
 *
 * Safe-by-default contract: never throws, never rejects. Caller routes
 * always succeed even if activity logging fails. Errors are logged
 * server-side via console.error.
 *
 * Edge cases handled:
 *  - userId missing -> silent no-op
 *  - description too long (> 5000 chars) -> truncated with ellipsis
 *  - metadata too large -> dropped (we log a warning, keep the activity)
 *  - DB error -> swallowed (never break the calling request)
 *  - entityId missing -> activity still recorded with entity-less context
 */

const MAX_DESCRIPTION = 5000;
const MAX_METADATA_JSON = 10000;

export interface LogActivityOptions {
  userId: string | null | undefined;
  activityType: ActivityType;
  description: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function logActivity(opts: LogActivityOptions): Promise<{ created: boolean; reason?: string }> {
  try {
    if (!opts.userId) return { created: false, reason: 'no_user' };
    if (!opts.description) return { created: false, reason: 'no_description' };

    let description = opts.description;
    if (description.length > MAX_DESCRIPTION) {
      description = description.slice(0, MAX_DESCRIPTION - 3) + '...';
    }

    let metadata: Record<string, unknown> | undefined = opts.metadata ?? undefined;
    if (metadata && JSON.stringify(metadata).length > MAX_METADATA_JSON) {
      console.warn('[logActivity] metadata too large, dropping');
      metadata = undefined;
    }

    await prisma.activity.create({
      data: {
        userId: opts.userId,
        activityType: opts.activityType,
        description,
        entityType: opts.entityType ?? undefined,
        entityId: opts.entityId ?? undefined,
        metadata: metadata as never,
      },
    });

    return { created: true };
  } catch (err) {
    console.error('[logActivity] failed', err);
    return { created: false, reason: 'error' };
  }
}

// ============ Convenience helpers ============

export async function logLeadCreated(params: {
  userId: string;
  leadId: string;
  companyName: string;
  contactName: string | null | undefined;
  source: string;
}) {
  const nameLabel = params.contactName || 'unknown contact';
  return logActivity({
    userId: params.userId,
    activityType: 'lead_created',
    description: `Lead created: ${params.companyName} (${nameLabel}) from ${params.source.replace(/_/g, ' ')}`,
    entityType: 'lead',
    entityId: params.leadId,
    metadata: { source: params.source },
  });
}

export async function logLeadStageChange(params: {
  userId: string;
  leadId: string;
  leadLabel: string;
  fromStage: string;
  toStage: string;
}) {
  return logActivity({
    userId: params.userId,
    activityType: 'status_change',
    description: `Stage moved: ${params.fromStage.replace(/_/g, ' ')} -> ${params.toStage.replace(/_/g, ' ')}`,
    entityType: 'lead',
    entityId: params.leadId,
    metadata: { fromStage: params.fromStage, toStage: params.toStage, leadLabel: params.leadLabel },
  });
}

export async function logDealCreated(params: {
  userId: string;
  dealId: string;
  dealName: string;
  fromLeadId?: string | null;
}) {
  return logActivity({
    userId: params.userId,
    activityType: 'deal_created',
    description: params.fromLeadId
      ? `Deal created from lead: ${params.dealName}`
      : `Deal created: ${params.dealName}`,
    entityType: 'deal',
    entityId: params.dealId,
    metadata: params.fromLeadId ? { convertedFromLeadId: params.fromLeadId } : undefined,
  });
}

export async function logDealStageChange(params: {
  userId: string;
  dealId: string;
  dealName: string;
  fromStage: string;
  toStage: string;
}) {
  return logActivity({
    userId: params.userId,
    activityType: 'status_change',
    description: `Stage moved: ${params.fromStage.replace(/_/g, ' ')} -> ${params.toStage.replace(/_/g, ' ')}`,
    entityType: 'deal',
    entityId: params.dealId,
    metadata: { fromStage: params.fromStage, toStage: params.toStage, dealName: params.dealName },
  });
}

export async function logQuoteSent(params: {
  userId: string;
  quoteId: string;
  dealId?: string | null;
  recipientEmail: string;
  trackingId?: string | null;
}) {
  // Log against the deal (timeline shows on the deal page) AND the quote (for completeness)
  // We write twice: once for the deal context, once for the quote context
  if (params.dealId) {
    await logActivity({
      userId: params.userId,
      activityType: 'quote_sent',
      description: `Quote sent to ${params.recipientEmail}${params.trackingId ? ` (ref ${params.trackingId})` : ''}`,
      entityType: 'deal',
      entityId: params.dealId,
      metadata: { quoteId: params.quoteId, trackingId: params.trackingId },
    });
  }
  return logActivity({
    userId: params.userId,
    activityType: 'quote_sent',
    description: `Quote sent to ${params.recipientEmail}${params.trackingId ? ` (ref ${params.trackingId})` : ''}`,
    entityType: 'quote',
    entityId: params.quoteId,
    metadata: { dealId: params.dealId, trackingId: params.trackingId },
  });
}

export async function logQuoteAccepted(params: {
  userId: string;
  quoteId: string;
  dealId?: string | null;
  companyName?: string | null;
}) {
  if (params.dealId) {
    await logActivity({
      userId: params.userId,
      activityType: 'status_change',
      description: `Quote accepted${params.companyName ? ` by ${params.companyName}` : ''}`,
      entityType: 'deal',
      entityId: params.dealId,
      metadata: { quoteId: params.quoteId, event: 'quote_accepted' },
    });
  }
  return logActivity({
    userId: params.userId,
    activityType: 'status_change',
    description: `Quote accepted${params.companyName ? ` by ${params.companyName}` : ''}`,
    entityType: 'quote',
    entityId: params.quoteId,
    metadata: { dealId: params.dealId, event: 'quote_accepted' },
  });
}
