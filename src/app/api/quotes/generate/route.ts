import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const LABOUR_RATE = 17;
const WEEKS_PER_MONTH = 4.33;

// POST /api/quotes/generate - Generate a quote (mirrors the Vercel app's /api/generate)
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

    // Calculate pricing
    const weeklyHours = hours_per_day * frequency;
    const weeklyLabour = hours_per_day * LABOUR_RATE * frequency;
    const weeklySpend = weeklyLabour + (product_cost || 0) + (overhead_cost || 0);
    const marginDecimal = margin / 100;
    const weeklyCharge = marginDecimal < 1 ? weeklySpend / (1 - marginDecimal) : 0;
    const monthlyTotal = Math.round(weeklyCharge * WEEKS_PER_MONTH * 100) / 100;
    const annualTotal = Math.round(monthlyTotal * 12 * 100) / 100;
    const perVisit = frequency > 0 ? weeklyCharge / frequency : 0;
    const actualMargin = weeklyCharge > 0 ? ((weeklyCharge - weeklySpend) / weeklyCharge) * 100 : 0;

    // Determine sell rate (per visit rate / hours per day)
    const sellRate = hours_per_day > 0 ? perVisit / hours_per_day : 0;

    // Generate quote ref
    const quoteRef = 'SC-' + Date.now().toString(36).toUpperCase();

    // Save to DB
    const quote = await prisma.quote.create({
      data: {
        weeklyHours,
        sellRate: Math.round(sellRate * 100) / 100,
        labourRate: LABOUR_RATE,
        weeksPerMonth: WEEKS_PER_MONTH,
        isPilot: pilot_pricing || false,
        pilotDiscount: pilot_pricing ? 25 : null,
        monthlyTotal,
        annualTotal,
        margin: Math.round(actualMargin * 100) / 100,
        trackingId: quoteRef,
        createdBy: session.user.id,
      },
    });

    // TODO: Wire up email sending (branded HTML template) and CRM logging
    // For now, just save the quote and return success

    return NextResponse.json({
      success: true,
      quote_ref: quoteRef,
      quote_id: quote.id,
      pricing: {
        perVisit: Math.round(perVisit * 100) / 100,
        weeklyCharge: Math.round(weeklyCharge * 100) / 100,
        monthlyTotal,
        annualTotal,
        margin: Math.round(actualMargin * 100) / 100,
        pilotPerVisit: pilot_pricing ? Math.round(perVisit * 0.75 * 100) / 100 : null,
      },
    });
  } catch (error) {
    console.error('Quote generate error:', error);
    return NextResponse.json({ error: 'Failed to generate quote' }, { status: 500 });
  }
}
