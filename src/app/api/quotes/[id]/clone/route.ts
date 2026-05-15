export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Clone a sent (or later) quote into a fresh draft.
 *
 * Use case: user wants to edit a quote that's already gone out. Editing a sent
 * quote in place would rewrite history. Instead we create a new draft with the
 * same form data and mark the original as superseded.
 *
 * Edge cases:
 *  - Source is a draft -> clone anyway (sometimes useful to start a variant)
 *  - Source already superseded -> still clone, chain via supersededById
 *  - Source has been deleted -> 404
 *  - createdBy != session.user.id -> 403
 *  - Clone keeps form data + pricing inputs, drops sent state (sentAt/viewedAt/openCount/trackingId)
 *  - The new clone's id is the new tracking token going forward
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const src = await prisma.quote.findUnique({ where: { id } });
    if (!src) return Response.json({ error: 'Quote not found' }, { status: 404 });
    if (src.createdBy !== session.user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create a fresh draft with same form data + pricing inputs
    const clone = await prisma.quote.create({
      data: {
        dealId: src.dealId,
        accountId: src.accountId,
        contactId: src.contactId,
        status: 'draft',
        companyName: src.companyName,
        address: src.address,
        contactName: src.contactName,
        contactEmail: src.contactEmail,
        contactPhone: src.contactPhone,
        siteType: src.siteType,
        hoursPerDay: src.hoursPerDay,
        frequency: src.frequency,
        days: src.days,
        productCost: src.productCost,
        overheadCost: src.overheadCost,
        weeklyHours: src.weeklyHours,
        sellRate: src.sellRate,
        labourRate: src.labourRate,
        weeksPerMonth: src.weeksPerMonth,
        isPilot: src.isPilot,
        pilotDiscount: src.pilotDiscount,
        monthlyTotal: src.monthlyTotal,
        annualTotal: src.annualTotal,
        margin: src.margin,
        // Carry forward email subject + html so user can tweak before sending
        emailSubject: src.emailSubject,
        emailHtml: src.emailHtml,
        // PDF: keep reference; will be regenerated on next save
        pdfPath: src.pdfPath,
        createdBy: session.user.id,
        // No trackingId yet (set on send), no sentAt, no viewedAt
      },
    });

    // Mark source as superseded if it had been sent (otherwise leave as draft)
    if (['sent', 'viewed', 'accepted', 'rejected', 'expired'].includes(src.status)) {
      await prisma.quote.update({
        where: { id: src.id },
        data: { status: 'superseded', supersededById: clone.id },
      });
    }

    return Response.json({ quote: clone }, { status: 201 });
  } catch (err) {
    console.error('[clone] error', err);
    return Response.json({ error: 'Failed to clone quote' }, { status: 500 });
  }
}
