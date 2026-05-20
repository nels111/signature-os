import { prisma } from '@/lib/db';

const MERGE_FIELDS: Record<string, (lead: LeadData) => string> = {
  '{{contact_name}}': (l) => l.contactName || 'there',
  '{{company_name}}': (l) => l.companyName,
  '{{first_name}}': (l) => l.contactName?.trim().split(' ')[0] || 'there',
  '{{calendly_link}}': () => 'https://calendly.com/signature-cleans',
};

interface LeadData {
  contactName: string | null;
  companyName: string;
  email: string | null;
}

/**
 * Replace merge fields in email template content.
 */
export function replaceMergeFields(html: string, lead: LeadData): string {
  let result = html;
  for (const [field, resolver] of Object.entries(MERGE_FIELDS)) {
    result = result.replaceAll(field, escapeHtml(resolver(lead)));
  }
  return result;
}

/**
 * Replace merge fields in subject line.
 */
export function replaceMergeFieldsPlain(text: string, lead: LeadData): string {
  let result = text;
  for (const [field, resolver] of Object.entries(MERGE_FIELDS)) {
    // Strip any HTML tags from plain-text context (subjects, etc)
    result = result.replaceAll(field, stripTags(resolver(lead)));
  }
  return result;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/**
 * Start a cadence for a lead. Creates the cadence record and links steps
 * from the email templates in sequence order.
 */
export async function startCadence(
  leadId: string,
  templateIds: { templateId: string; delayDays: number }[]
): Promise<string> {
  const MS_PER_DAY = 86_400_000;

  // Atomic transaction to prevent race conditions
  const cadence = await prisma.$transaction(async (tx) => {
    // Verify lead exists and has email
    const lead = await tx.lead.findUnique({
      where: { id: leadId },
      select: { id: true, email: true, cadenceStatus: true, deletedAt: true },
    });

    if (!lead || lead.deletedAt) throw new Error('Lead not found');
    if (!lead.email) throw new Error('Lead has no email address');
    if (lead.cadenceStatus === 'active') throw new Error('Lead already in active cadence');

    // Validate all template IDs exist
    const templateCount = await tx.emailTemplate.count({
      where: { id: { in: templateIds.map(t => t.templateId) } },
    });
    if (templateCount !== templateIds.length) throw new Error('One or more template IDs are invalid');

    // Create cadence with steps
    const firstDelay = templateIds[0]?.delayDays ?? 1;
    const nextSendAt = new Date(Date.now() + firstDelay * MS_PER_DAY);

    const created = await tx.cadence.create({
      data: {
        leadId,
        status: 'active',
        currentStep: 0,
        nextSendAt,
        steps: {
          create: templateIds.map((t, i) => ({
            stepNumber: i,
            templateId: t.templateId,
            delayDays: t.delayDays,
          })),
        },
      },
    });

    // Update lead cadence status
    await tx.lead.update({
      where: { id: leadId },
      data: { cadenceStatus: 'active' },
    });

    return created;
  });

  return cadence.id;
}

/**
 * Pause a cadence with a reason.
 */
export async function pauseCadence(
  cadenceId: string,
  reason: 'paused_replied' | 'paused_meeting' | 'stopped_active_client'
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const cadence = await tx.cadence.findUnique({
      where: { id: cadenceId },
      select: { id: true, leadId: true, status: true },
    });

    if (!cadence) throw new Error('Cadence not found');
    if (cadence.status !== 'active') throw new Error('Cadence is not active');

    await tx.cadence.update({
      where: { id: cadenceId },
      data: {
        status: reason,
        pausedAt: new Date(),
        pauseReason: reason,
        nextSendAt: null,
      },
    });

    await tx.lead.update({
      where: { id: cadence.leadId },
      data: { cadenceStatus: reason },
    });
  });
}

/**
 * Resume a paused cadence.
 */
export async function resumeCadence(cadenceId: string): Promise<void> {
  const MS_PER_DAY = 86_400_000;

  await prisma.$transaction(async (tx) => {
    const cadence = await tx.cadence.findUnique({
      where: { id: cadenceId },
      select: { id: true, leadId: true, status: true, currentStep: true, steps: { select: { delayDays: true, stepNumber: true }, orderBy: { stepNumber: 'asc' } } },
    });

    if (!cadence) throw new Error('Cadence not found');
    if (cadence.status === 'active') throw new Error('Cadence is already active');
    if (cadence.status === 'completed' || cadence.status === 'stopped_active_client') {
      throw new Error('Cadence cannot be resumed');
    }

    const nextStep = cadence.steps.find(s => s.stepNumber === cadence.currentStep);
    const delayDays = nextStep?.delayDays ?? 1;
    const nextSendAt = new Date(Date.now() + delayDays * MS_PER_DAY);

    await tx.cadence.update({
      where: { id: cadenceId },
      data: {
        status: 'active',
        pausedAt: null,
        pauseReason: null,
        nextSendAt,
      },
    });

    await tx.lead.update({
      where: { id: cadence.leadId },
      data: { cadenceStatus: 'active' },
    });
  });
}

/**
 * Get cadence status overview — all active/paused cadences with lead info.
 */
export async function getCadenceOverview() {
  return prisma.cadence.findMany({
    where: {
      status: { in: ['active', 'paused_replied', 'paused_meeting', 'long_term_nurture'] },
      lead: { deletedAt: null },
    },
    orderBy: { nextSendAt: 'asc' },
    select: {
      id: true,
      status: true,
      currentStep: true,
      nextSendAt: true,
      startedAt: true,
      pausedAt: true,
      pauseReason: true,
      lead: { select: { id: true, companyName: true, contactName: true, email: true } },
      steps: { select: { stepNumber: true, sentAt: true, openedAt: true, repliedAt: true }, orderBy: { stepNumber: 'asc' } },
    },
  });
}
