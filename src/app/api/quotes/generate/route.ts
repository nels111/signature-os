import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { generateQuotePdf, calculateQuotePricing } from '@/lib/quotes/pdf-generator';
import {
  buildClientEmailHtml, getClientEmailSubject,
  buildInternalEmailHtml, getInternalEmailSubject,
} from '@/lib/quotes/email-templates';

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < Math.abs(days)) {
    result.setDate(result.getDate() + (days > 0 ? 1 : -1));
    if (result.getDay() !== 0 && result.getDay() !== 6) added++;
  }
  return result;
}

// POST /api/quotes/generate - Generate quote, PDF, and email draft
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: 5 quotes per minute
    const rl = checkRateLimit(`quote:${session.user.id}`, RATE_LIMITS.quoteGenerate);
    if (rl.limited) {
      return NextResponse.json({ error: 'Too many quotes. Try again shortly.' }, { status: 429 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const {
      company_name, address, contact_name, contact_email, contact_phone,
      site_type, hours_per_day, frequency, days,
      margin, product_cost, overhead_cost, pilot_pricing,
      floor_override,
    } = body as {
      company_name?: string; address?: string; contact_name?: string;
      contact_email?: string; contact_phone?: string; site_type?: string;
      hours_per_day?: number | string; frequency?: number | string; days?: string[];
      margin?: number | string; product_cost?: number | string;
      overhead_cost?: number | string; pilot_pricing?: boolean;
      floor_override?: boolean;
    };

    // Validate required fields
    if (!company_name || !address || !contact_name || !contact_email || !site_type || !hours_per_day || !frequency || !days?.length || !margin) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact_email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Pricing guardrails (SOUL.md standing orders):
    //   - Margin must be between 0% and 95% (avoid divide-by-zero / nonsense)
    //   - Hours and frequency must be positive
    //   - Computed sell rate must be >= £25/hr floor unless admin sets floor_override
    const SELL_RATE_FLOOR = 25;
    const hoursNum = parseFloat(String(hours_per_day));
    const freqNum = parseInt(String(frequency));
    const marginNum = parseFloat(String(margin));
    const productNum = parseFloat(String(product_cost)) || 0;
    const overheadNum = parseFloat(String(overhead_cost)) || 0;

    if (!Number.isFinite(hoursNum) || hoursNum <= 0 || hoursNum > 24) {
      return NextResponse.json({ error: 'hours_per_day must be between 0 and 24' }, { status: 400 });
    }
    if (!Number.isInteger(freqNum) || freqNum <= 0 || freqNum > 14) {
      return NextResponse.json({ error: 'frequency must be between 1 and 14' }, { status: 400 });
    }
    if (!Number.isFinite(marginNum) || marginNum < 0 || marginNum >= 95) {
      return NextResponse.json({ error: 'margin must be between 0 and 95 percent' }, { status: 400 });
    }
    if (productNum < 0 || overheadNum < 0) {
      return NextResponse.json({ error: 'product_cost and overhead_cost must be non-negative' }, { status: 400 });
    }

    // Compute the per-hour sell rate the same way calculateQuotePricing does, so
    // we can reject anything below the £25 floor before we spin up the PDF / DB.
    // Labour rate comes from OrgSettings (editable, defaults to £17).
    const { getDefaultLabourRate } = await import('@/lib/org-settings');
    const LABOUR_RATE = await getDefaultLabourRate();
    const weeklyLabour = hoursNum * LABOUR_RATE * freqNum;
    const weeklySpend = weeklyLabour + productNum + overheadNum;
    const weeklyCharge = weeklySpend / (1 - marginNum / 100);
    const perVisitCharge = weeklyCharge / freqNum;
    const computedSellRate = perVisitCharge / hoursNum;

    if (computedSellRate < SELL_RATE_FLOOR && !floor_override) {
      return NextResponse.json({
        error: `Computed sell rate £${computedSellRate.toFixed(2)}/hr is below the £${SELL_RATE_FLOOR}/hr floor. Increase margin, or set floor_override:true with Head Office approval.`,
        computedSellRate: Math.round(computedSellRate * 100) / 100,
      }, { status: 422 });
    }

    // Only admins can use floor_override
    if (floor_override && session.user.role !== 'admin') {
      return NextResponse.json({
        error: 'floor_override requires admin role (Head Office approval).',
      }, { status: 403 });
    }

    const pdfData = {
      companyName: company_name as string,
      address: address as string,
      contactName: contact_name as string,
      contactEmail: contact_email as string,
      contactPhone: contact_phone || 'Not provided',
      siteType: site_type as string,
      hoursPerDay: parseFloat(String(hours_per_day)),
      frequency: parseInt(String(frequency)),
      days: days as string[],
      margin: parseFloat(String(margin)),
      productCost: parseFloat(String(product_cost)) || 0,
      overheadCost: parseFloat(String(overhead_cost)) || 0,
      isPilot: pilot_pricing || false,
      labourRate: LABOUR_RATE,
    };

    // Calculate pricing
    const pricing = calculateQuotePricing(pdfData);

    // Generate PDF
    const { pdfPath, pdfFilename } = await generateQuotePdf(pdfData);

    // Build email HTML for preview
    const now = new Date();
    const pilotEndDate = new Date(now);
    pilotEndDate.setDate(pilotEndDate.getDate() + 30);
    const pilotReviewDate = addBusinessDays(pilotEndDate, -5);

    const calcData = {
      monthlyTotal: fmt(pricing.monthlyTotal),
      pilotMonthly: fmt(pricing.pilotMonthly),
      pilotSavings: fmt(pricing.pilotSavings),
      perVisitCharge: fmt(pricing.perVisitCharge),
      pilotPerVisit: fmt(pricing.pilotPerVisit),
      perVisitSavings: fmt(pricing.perVisitCharge - pricing.pilotPerVisit),
      frequencyDisplay: pricing.frequencyDisplay,
      pilotReviewDate: fmtDate(pilotReviewDate),
      dateDisplay: pricing.dateDisplay,
      weeklyLabour: fmt(pricing.weeklyLabour),
      weeklySpend: fmt(pricing.weeklySpend),
      weeklyCharge: fmt(pricing.weeklyCharge),
      weeklyProfit: fmt(pricing.weeklyProfit),
      monthlyProfit: fmt(pricing.monthlyProfit),
      quoteRef: pricing.quoteRef,
    };

    const clientEmailHtml = buildClientEmailHtml(pdfData, calcData);
    const clientEmailSubject = getClientEmailSubject(pdfData.isPilot);
    const internalEmailHtml = buildInternalEmailHtml(pdfData, calcData);
    const internalEmailSubject = getInternalEmailSubject(company_name, pdfData.isPilot);

    // Save to DB as draft
    const quote = await prisma.quote.create({
      data: {
        companyName: company_name,
        address,
        contactName: contact_name,
        contactEmail: contact_email,
        contactPhone: contact_phone || 'Not provided',
        siteType: site_type,
        hoursPerDay: parseFloat(String(hours_per_day)),
        frequency: parseInt(String(frequency)),
        days,
        productCost: parseFloat(String(product_cost)) || 0,
        overheadCost: parseFloat(String(overhead_cost)) || 0,
        weeklyHours: pricing.weeklyHours,
        sellRate: Math.round(pricing.sellRate * 100) / 100,
        labourRate: 17,
        weeksPerMonth: 4.33,
        isPilot: pilot_pricing || false,
        pilotDiscount: pilot_pricing ? 25 : null,
        monthlyTotal: pricing.monthlyTotal,
        annualTotal: pricing.annualTotal,
        margin: Math.round(pricing.actualMargin * 100) / 100,
        pdfPath,
        emailSubject: clientEmailSubject,
        emailHtml: clientEmailHtml,
        trackingId: crypto.randomUUID(),
        status: 'draft',
        createdBy: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      quote_id: quote.id,
      quote_ref: pricing.quoteRef,
      status: 'draft',
      pricing: {
        perVisit: Math.round(pricing.perVisitCharge * 100) / 100,
        pilotPerVisit: pdfData.isPilot ? Math.round(pricing.pilotPerVisit * 100) / 100 : null,
        weeklyCharge: Math.round(pricing.weeklyCharge * 100) / 100,
        monthlyTotal: pricing.monthlyTotal,
        annualTotal: pricing.annualTotal,
        margin: Math.round(pricing.actualMargin * 100) / 100,
      },
      email: {
        subject: clientEmailSubject,
        html: clientEmailHtml,
        to: contact_email,
        pdfFilename,
      },
      internal: {
        subject: internalEmailSubject,
        html: internalEmailHtml,
      },
    });
  } catch (error) {
    console.error('Quote generate error:', error);
    return NextResponse.json({ error: 'Failed to generate quote' }, { status: 500 });
  }
}
