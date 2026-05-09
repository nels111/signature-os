import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const WEEKS_PER_MONTH = 4.33;
const BILLING_RATE_TARGET = 27;
const BILLING_RATE_FLOOR = 25;
const LABOUR_RATE = 17;
const PILOT_DISCOUNT = 25;
const MIN_MARGIN = 25;

// POST /api/quotes/calculate - Live pricing preview (no DB write)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { weeklyHours, sellRate, isPilot } = body;

    const numSellRate = parseFloat(sellRate || '0');
    const numWeeklyHours = parseFloat(weeklyHours || '0');
    const pilotDiscount = isPilot ? PILOT_DISCOUNT : 0;

    const effectiveRate = isPilot ? numSellRate * (1 - pilotDiscount / 100) : numSellRate;
    const weeklyRevenue = numWeeklyHours * effectiveRate;
    const weeklyCost = numWeeklyHours * LABOUR_RATE;
    const monthlyTotal = weeklyRevenue * WEEKS_PER_MONTH;
    const annualTotal = monthlyTotal * 12;
    const margin = weeklyRevenue > 0 ? ((weeklyRevenue - weeklyCost) / weeklyRevenue) * 100 : 0;

    let rateStatus: 'green' | 'amber' | 'red' = 'green';
    if (numSellRate < BILLING_RATE_FLOOR) rateStatus = 'red';
    else if (numSellRate < BILLING_RATE_TARGET) rateStatus = 'amber';

    let blocked = false;
    let blockReason = '';
    if (numSellRate < BILLING_RATE_FLOOR) {
      blocked = true;
      blockReason = `Sell rate below £${BILLING_RATE_FLOOR}/hr floor`;
    } else if (margin < MIN_MARGIN) {
      blocked = true;
      blockReason = `Margin ${margin.toFixed(1)}% below ${MIN_MARGIN}% minimum`;
    }

    return NextResponse.json({
      weeklyRevenue: Math.round(weeklyRevenue * 100) / 100,
      monthlyTotal: Math.round(monthlyTotal * 100) / 100,
      annualTotal: Math.round(annualTotal * 100) / 100,
      margin: Math.round(margin * 100) / 100,
      effectiveRate: Math.round(effectiveRate * 100) / 100,
      rateStatus,
      blocked,
      blockReason,
      labourRate: LABOUR_RATE,
      pilotDiscount: isPilot ? pilotDiscount : 0,
    });
  } catch (error) {
    console.error('Quote calc error:', error);
    return NextResponse.json({ error: 'Calculation failed' }, { status: 500 });
  }
}
