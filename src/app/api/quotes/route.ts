import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// Pricing guardrails
const BILLING_RATE_TARGET = 27;
const BILLING_RATE_FLOOR = 25;
const LABOUR_RATE = 17;
const WEEKS_PER_MONTH = 4.33;
const PILOT_DISCOUNT = 25; // percent
const MIN_MARGIN = 25; // percent

function calculateQuoteTotals(weeklyHours: number, sellRate: number, labourRate: number, isPilot: boolean, pilotDiscount: number) {
  const effectiveRate = isPilot ? sellRate * (1 - pilotDiscount / 100) : sellRate;
  const weeklyRevenue = weeklyHours * effectiveRate;
  const monthlyTotal = weeklyRevenue * WEEKS_PER_MONTH;
  const annualTotal = monthlyTotal * 12;
  const weeklyCost = weeklyHours * labourRate;
  const margin = weeklyRevenue > 0 ? ((weeklyRevenue - weeklyCost) / weeklyRevenue) * 100 : 0;

  return {
    monthlyTotal: Math.round(monthlyTotal * 100) / 100,
    annualTotal: Math.round(annualTotal * 100) / 100,
    margin: Math.round(margin * 100) / 100,
  };
}

// GET /api/quotes - List quotes
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20') || 20, 100);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { deal: { name: { contains: search, mode: 'insensitive' } } },
        { account: { name: { contains: search, mode: 'insensitive' } } },
        { contact: { firstName: { contains: search, mode: 'insensitive' } } },
        { contact: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          deal: { select: { id: true, name: true } },
          account: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
          creator: { select: { id: true, name: true } },
        },
      }),
      prisma.quote.count({ where }),
    ]);

    return NextResponse.json({
      quotes,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Quotes list error:', error);
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 });
  }
}

// POST /api/quotes - Create quote with pricing validation
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { dealId, accountId, contactId, weeklyHours, sellRate, isPilot } = body as {
      dealId?: string; accountId?: string; contactId?: string;
      weeklyHours?: number | string; sellRate?: number | string; isPilot?: boolean;
    };

    if (!weeklyHours || !sellRate) {
      return NextResponse.json({ error: 'weeklyHours and sellRate are required' }, { status: 400 });
    }

    const numSellRate = parseFloat(String(sellRate));
    const numWeeklyHours = parseFloat(String(weeklyHours));
    const labourRate = LABOUR_RATE;
    const pilotDiscount = isPilot ? PILOT_DISCOUNT : 0;

    // HARD BLOCK: sell rate below floor
    if (numSellRate < BILLING_RATE_FLOOR) {
      return NextResponse.json({
        error: `Sell rate £${numSellRate}/hr is below the £${BILLING_RATE_FLOOR}/hr floor. Head Office approval required.`,
        rateStatus: 'blocked',
      }, { status: 400 });
    }

    const totals = calculateQuoteTotals(numWeeklyHours, numSellRate, labourRate, isPilot ?? false, pilotDiscount);

    // HARD BLOCK: margin below minimum
    if (totals.margin < MIN_MARGIN) {
      return NextResponse.json({
        error: `Margin ${totals.margin}% is below the ${MIN_MARGIN}% minimum.`,
        rateStatus: 'blocked',
        margin: totals.margin,
      }, { status: 400 });
    }

    // WARNING: sell rate below target but above floor
    const rateStatus = numSellRate >= BILLING_RATE_TARGET ? 'green' : 'amber';

    const quote = await prisma.quote.create({
      data: {
        dealId: dealId || null,
        accountId: accountId || null,
        contactId: contactId || null,
        weeklyHours: numWeeklyHours,
        sellRate: numSellRate,
        labourRate,
        weeksPerMonth: WEEKS_PER_MONTH,
        isPilot: isPilot || false,
        pilotDiscount: isPilot ? PILOT_DISCOUNT : null,
        monthlyTotal: totals.monthlyTotal,
        annualTotal: totals.annualTotal,
        margin: totals.margin,
        createdBy: session.user.id,
      },
      include: {
        deal: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return NextResponse.json({ quote, rateStatus });
  } catch (error) {
    console.error('Quote create error:', error);
    return NextResponse.json({ error: 'Failed to create quote' }, { status: 500 });
  }
}
