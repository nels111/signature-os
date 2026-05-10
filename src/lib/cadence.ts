import { prisma } from '@/lib/db';

const MERGE_FIELDS: Record<string, (lead: LeadData) => string> = {
  '{{contact_name}}': (l) => l.contactName,
  '{{company_name}}': (l) => l.companyName,
  '{{first_name}}': (l) => l.contactName.split(' ')[0],
  '{{calendly_link}}': () => 'https://calendly.com/signature-cleans',
};

interface LeadData {
  contactName: string;
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
    result = result.replaceAll(field, resolver(lead));
  }
  return result;
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
  // Verify lead exists and has email
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, email: true, cadenceStatus: true, deletedAt: true },
  });

  if (!lead || lead.deletedAt) throw new Error('Lead not found');
  if (!lead.email) throw new Error('Lead has no email address');
  if (lead.cadenceStatus === 'active') throw new Error('Lead already in active cadence');

  // Create cadence with steps
  const firstDelay = templateIds[0]?.delayDays ?? 1;
  const nextSendAt = new Date(Date.now() + firstDelay * 24 * 60 * 60 * 1000);

  const cadence = await prisma.cadence.create({
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
  await prisma.lead.update({
    where: { id: leadId },
    data: { cadenceStatus: 'active' },
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
  const cadence = await prisma.cadence.findUnique({
    where: { id: cadenceId },
    select: { id: true, leadId: true, status: true },
  });

  if (!cadence) throw new Error('Cadence not found');
  if (cadence.status !== 'active') throw new Error('Cadence is not active');

  await prisma.cadence.update({
    where: { id: cadenceId },
    data: {
      status: reason,
      pausedAt: new Date(),
      pauseReason: reason,
      nextSendAt: null,
    },
  });

  await prisma.lead.update({
    where: { id: cadence.leadId },
    data: { cadenceStatus: reason },
  });
}

/**
 * Resume a paused cadence.
 */
export async function resumeCadence(cadenceId: string): Promise<void> {
  const cadence = await prisma.cadence.findUnique({
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
  const nextSendAt = new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000);

  await prisma.cadence.update({
    where: { id: cadenceId },
    data: {
      status: 'active',
      pausedAt: null,
      pauseReason: null,
      nextSendAt,
    },
  });

  await prisma.lead.update({
    where: { id: cadence.leadId },
    data: { cadenceStatus: 'active' },
  });
}

/**
 * Get cadence status overview — all active/paused cadences with lead info.
 */
export async function getCadenceOverview() {
  return prisma.cadence.findMany({
    where: { status: { in: ['active', 'paused_replied', 'paused_meeting', 'long_term_nurture'] } },
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
