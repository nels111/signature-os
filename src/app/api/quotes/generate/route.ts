import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
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

    const body = await request.json();
    const {
      company_name, address, contact_name, contact_email, contact_phone,
      site_type, hours_per_day, frequency, days,
      margin, product_cost, overhead_cost, pilot_pricing
    } = body;

    // Validate required fields
    if (!company_name || !address || !contact_name || !contact_email || !site_type || !hours_per_day || !frequency || !days?.length || !margin) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact_email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const pdfData = {
      companyName: company_name,
      address,
      contactName: contact_name,
      contactEmail: contact_email,
      contactPhone: contact_phone || 'Not provided',
      siteType: site_type,
      hoursPerDay: parseFloat(hours_per_day),
      frequency: parseInt(frequency),
      days,
      margin: parseFloat(margin),
      productCost: parseFloat(product_cost) || 0,
      overheadCost: parseFloat(overhead_cost) || 0,
      isPilot: pilot_pricing || false,
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
        hoursPerDay: parseFloat(hours_per_day),
        frequency: parseInt(frequency),
        days,
        productCost: parseFloat(product_cost) || 0,
        overheadCost: parseFloat(overhead_cost) || 0,
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
        trackingId: pricing.quoteRef,
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
