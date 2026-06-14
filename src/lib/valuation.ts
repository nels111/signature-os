/**
 * Company valuation model for Signature Cleans.
 *
 * Company Value = annual profit (EBITDA) × multiple.
 *   annual profit = annual recurring revenue × MARGIN_PCT
 *   (Mirrors the Regular Hours Sheet's own "Company Value" formula, which is
 *    monthly × 20% × 12 × 2 — i.e. a 20% margin and a 2× multiple. We keep the
 *    20% margin and lift the multiple to the researched, agreed levels.)
 *
 * Why a multiple, and why founder-independence matters (research #77):
 * commercial cleaning firms sell on a multiple of earnings, and owner-dependent
 * businesses transact at ~3–4× vs ~7–8× for ones that run without the owner — so
 * systemisation (SigOS / School of Excellence / franchise-ready) roughly DOUBLES
 * the company's value on the same revenue. ANCHOR = today's conservative figure;
 * SYSTEMISED = the target once fully founder-independent.
 *
 * Confirmed with Nelson 14 Jun: EBITDA basis, 20% margin (from the sheet),
 * 4× anchor + show the 7× systemised upside.
 */

export const MARGIN_PCT = 0.20;          // profit margin assumption (matches the hours sheet)
export const MULTIPLE_ANCHOR = 4;        // conservative systemised-regional multiple (today)
export const MULTIPLE_SYSTEMISED = 7;    // target once fully founder-independent
export const MULTIPLE_SHEET_LEGACY = 2;  // the hours sheet's current built-in multiple (for reference/parity)

export interface CompanyValuation {
  annualRecurringRevenue: number;
  marginPct: number;
  annualProfit: number;        // EBITDA = revenue × margin
  multiple: number;            // anchor multiple applied
  companyValue: number;        // annualProfit × anchor multiple
  systemisedMultiple: number;
  systemisedUpside: number;    // annualProfit × systemised multiple (founder-independent target)
  sheetLegacyValue: number;    // annualProfit × 2 (what the hours sheet shows today) — parity check
  assumptions: string;
}

/**
 * Compute the company valuation from annual recurring revenue.
 * Returns all inputs + the value at the anchor multiple, the systemised upside,
 * and the legacy sheet figure for transparency.
 */
export function computeCompanyValue(
  annualRecurringRevenue: number,
  opts?: { marginPct?: number; multiple?: number; systemisedMultiple?: number },
): CompanyValuation {
  const marginPct = opts?.marginPct ?? MARGIN_PCT;
  const multiple = opts?.multiple ?? MULTIPLE_ANCHOR;
  const systemisedMultiple = opts?.systemisedMultiple ?? MULTIPLE_SYSTEMISED;

  const annualProfit = annualRecurringRevenue * marginPct;
  return {
    annualRecurringRevenue: Math.round(annualRecurringRevenue),
    marginPct,
    annualProfit: Math.round(annualProfit),
    multiple,
    companyValue: Math.round(annualProfit * multiple),
    systemisedMultiple,
    systemisedUpside: Math.round(annualProfit * systemisedMultiple),
    sheetLegacyValue: Math.round(annualProfit * MULTIPLE_SHEET_LEGACY),
    assumptions: `${Math.round(marginPct * 100)}% margin × ${multiple}× multiple (EBITDA basis). Systemised target ${systemisedMultiple}×.`,
  };
}
