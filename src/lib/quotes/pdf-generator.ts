import { renameSync, readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

const TEMPLATES_DIR = join(process.cwd(), 'templates');
const OUTPUT_DIR = join(process.cwd(), 'generated-quotes');

// Ensure output dir exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

export interface QuotePdfData {
  companyName: string;
  address: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  siteType: string;
  hoursPerDay: number;
  frequency: number;
  days: string[];
  margin: number;
  productCost: number;
  overheadCost: number;
  isPilot: boolean;
  /** Optional override. Defaults to org-wide default labour rate when omitted. */
  labourRate?: number;
}

// Default fallback when no rate is passed in. Real default lives in OrgSettings.
const DEFAULT_LABOUR_RATE = 17;
const WEEKS_PER_MONTH = 4.33;
const PILOT_DISCOUNT = 0.25;
const PILOT_DAYS = 30;

const SCOPES: Record<string, string> = {
  "Office/Commercial": `Toilet & Washroom Areas
• Thoroughly clean and disinfect all toilets, urinals, basins, and taps
• Polish mirrors, wipe partitions, doors, and tiled walls
• Sweep and mop hard floors with antibacterial cleaner
• Disinfect door plates, handles, and light switches

Kitchen / Canteen / Tea Points
• Clean and sanitise worktops, sinks, splashbacks, and cupboard fronts
• Wipe appliances, handles, switches, and touchpoints
• Sweep and mop floors using degreasing solution
• Empty bins, replace liners, and wipe bin exteriors

Entrances / Offices / Common Areas
• Vacuum carpets and mats, mop all hard floors
• Wipe desks, ledges, skirtings, radiators, and window sills
• Spot-clean internal glass and partitions
• Sanitise high-contact surfaces (handles, switches, banisters)
• Empty bins and replace liners

Note: Schedule refined during mobilisation to reflect site layout and access.`,

  "Welfare/Construction": `Welfare Facilities
• Clean and disinfect all toilets, urinals, sinks, taps, and mirrors
• Remove mud and site debris from floors, doors, and walls
• Sweep and mop using disinfectant
• Re-stock consumables where supplied
• Empty bins and replace liners

Drying / Changing Rooms
• Collect and remove rubbish
• Wipe benches, walls, doors, and lockers
• Sweep and mop floors with antibacterial detergent

Site Office / Canteen Cabins
• Wipe and sanitise desks, chairs, cupboards, and appliances
• Clean sinks, splashbacks, and microwaves/fridge fronts
• Vacuum or mop floors
• Empty bins and sanitise

Corridors / Portacabins
• Dust accessible surfaces
• Vacuum or mop floors
• Clean touchpoints and glazing`,

  "Hospitality/Venue": `Customer Toilets
• Deep clean and sanitise all WCs, urinals, basins, taps, hand dryers, and partitions
• Polish mirrors and stainless steel
• Replenish soap, paper, and air-freshener units
• Sweep and mop with disinfectant

Front of House / Bar / Dining Areas
• Wipe and sanitise tables, chairs, and highchairs
• Vacuum or mop floors, polish surfaces and ledges
• Remove litter and debris, tidy presentation
• Clean internal glass, entrance doors, and display panels

General Duties
• Empty bins, replace liners, wipe exteriors
• Remove rubbish to external bins
• Ensure all areas are left clean, sanitised, and ready for service`,

  "Education/Institutional": `Classrooms / Offices / Staff Rooms
• Dust and wipe desks, chairs, and window sills
• Empty bins and replace liners
• Vacuum carpets and mop hard floors
• Clean touchpoints, switches, and door handles

Toilets / Washrooms
• Clean and disinfect all sanitaryware, taps, and mirrors
• Refill soap and towel dispensers (client-supplied)
• Sweep and mop floors, wipe partitions and doors

Stairs / Corridors / Entrances
• Vacuum or sweep stairs and landings
• Mop floors, wipe rails and skirtings
• Spot-clean internal glass and walls`,

  "Specialist/Industrial": `Workshops / Industrial Areas
• Sweep and mop using degreasing cleaner suitable for workshop floors
• Clean benches, machinery surrounds, and worktops where safe to do so
• Wipe switches, handles, and control panels
• Empty waste bins and dispose of debris appropriately

Toilets / Washrooms
• Clean and sanitise all fixtures, fittings, and mirrors
• Sweep and mop floors with disinfectant
• Restock consumables where supplied

Kitchen / Break Areas
• Wipe and disinfect worktops, sinks, cupboards, and appliances
• Sweep and mop floors
• Empty bins and sanitise`,

  "Dental/Medical": `Clinical / Practice Areas
• Clean and disinfect all clinical and sanitary fixtures including sinks, taps, and basins
• Sanitise touchpoints such as handles, switches, and chair controls
• Vacuum or mop all floors with approved antibacterial detergent
• Wipe skirtings, cills, and accessible ledges
• Clean internal glazing and partitions

Toilets / Washrooms
• Disinfect all sanitaryware, mirrors, and dispensers
• Sweep and mop floors with disinfectant
• Wipe partitions, handles, and door plates

Note: Tasks are undertaken to support infection-control standards and may be refined during mobilisation.`
};

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

export function calculateQuotePricing(data: QuotePdfData) {
  const now = new Date();
  const labourRate = data.labourRate ?? DEFAULT_LABOUR_RATE;
  const weeklyLabour = data.hoursPerDay * labourRate * data.frequency;
  const weeklySpend = weeklyLabour + data.productCost + data.overheadCost;
  const marginDecimal = data.margin / 100;
  const weeklyCharge = marginDecimal < 1 ? weeklySpend / (1 - marginDecimal) : 0;
  const monthlyTotal = Math.round(weeklyCharge * WEEKS_PER_MONTH);
  const weeklyProfit = weeklyCharge - weeklySpend;
  const monthlyProfit = weeklyProfit * WEEKS_PER_MONTH;
  const perVisitCharge = data.frequency > 0 ? weeklyCharge / data.frequency : 0;
  const pilotPerVisit = data.isPilot ? perVisitCharge * (1 - PILOT_DISCOUNT) : perVisitCharge;
  const pilotMonthly = data.isPilot ? Math.round(monthlyTotal * (1 - PILOT_DISCOUNT)) : monthlyTotal;
  const pilotSavings = data.isPilot ? monthlyTotal - pilotMonthly : 0;
  const annualTotal = monthlyTotal * 12;
  const weeklyHours = data.hoursPerDay * data.frequency;
  const sellRate = data.hoursPerDay > 0 ? perVisitCharge / data.hoursPerDay : 0;
  const actualMargin = weeklyCharge > 0 ? ((weeklyCharge - weeklySpend) / weeklyCharge) * 100 : 0;

  const fileDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const quoteRef = `SC-${fileDate}-${data.companyName.substring(0, 3).toUpperCase()}`;
  const daysString = data.days.join(', ');
  const frequencyDisplay = `${data.frequency}x per week (${daysString})`;

  const pilotEndDate = new Date(now);
  pilotEndDate.setDate(pilotEndDate.getDate() + PILOT_DAYS);
  const pilotReviewDate = addBusinessDays(pilotEndDate, -5);

  return {
    weeklyLabour, weeklySpend, weeklyCharge, monthlyTotal,
    weeklyProfit, monthlyProfit, perVisitCharge, pilotPerVisit,
    pilotMonthly, pilotSavings, annualTotal, weeklyHours,
    sellRate, actualMargin, quoteRef, daysString,
    frequencyDisplay, fileDate, pilotReviewDate,
    dateDisplay: fmtDate(now),
  };
}

export async function generateQuotePdf(data: QuotePdfData): Promise<{ pdfPath: string; pdfFilename: string }> {
  const pricing = calculateQuotePricing(data);
  const templateFile = data.isPilot ? 'pilot-quote.docx' : 'standard-quote.docx';
  const templatePath = join(TEMPLATES_DIR, templateFile);

  // Read template
  const content = readFileSync(templatePath, 'binary');
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  });

  // Build placeholders (matching the Google Docs template format)
  const placeholders: Record<string, string> = {
    'Date': pricing.dateDisplay,
    'CompanyName': data.companyName,
    'Address': data.address,
    'ContactName': data.contactName,
    'ContactPhone': data.contactPhone || 'Not provided',
    'Frequency': pricing.daysString,
    'MonthlyTotal': `\u00A3${fmt(pricing.perVisitCharge)} per visit (excl. VAT)`,
    'PerVisitRate': `\u00A3${fmt(pricing.perVisitCharge)} per visit (excl. VAT)`,
    'PilotPerVisitRate': `\u00A3${fmt(pricing.pilotPerVisit)} per visit (excl. VAT)`,
    'ScopeOfWorks': SCOPES[data.siteType] || '(Scope not found)',
    'FullMonthlyTotal': `\u00A3${fmt(pricing.perVisitCharge)} per visit (excl. VAT)`,
    'PilotMonthlyTotal': `\u00A3${fmt(pricing.pilotPerVisit)} per visit (excl. VAT)`,
    'PilotDiscountPercent': '25%',
    'PilotPeriodDays': String(PILOT_DAYS),
    'QuoteRef': pricing.quoteRef,
    'RateDescription': `${data.frequency} visits per week`,
    'CleaningSchedule': pricing.daysString,
    'SiteName': data.companyName,
    'StandardRateUnit': 'per visit',
    'ContractTerm': 'Rolling monthly contract',
    'InvoiceEmail': data.contactEmail,
  };

  doc.render(placeholders);

  // Generate docx buffer
  const buf = doc.getZip().generate({ type: 'nodebuffer' });
  const safeCompany = data.companyName.replace(/[^a-zA-Z0-9 ]/g, '_');
  const docxFilename = `${safeCompany}_Quote_${pricing.fileDate}.docx`;
  const docxPath = join(OUTPUT_DIR, docxFilename);
  writeFileSync(docxPath, buf);

  // Convert to PDF via LibreOffice (async, no shell)
  try {
    await execFileAsync('libreoffice', [
      '--headless', '--convert-to', 'pdf', '--outdir', OUTPUT_DIR, docxPath
    ], { timeout: 30000 });
  } catch (e) {
    console.error('LibreOffice conversion error:', e);
    throw new Error('PDF conversion failed');
  }

  // Clean up docx
  try { unlinkSync(docxPath); } catch { /* ignore */ }

  const pdfFilename = `Signature Cleans T&C's and quote letter (${data.companyName}).pdf`;
  const generatedPdfName = `${safeCompany}_Quote_${pricing.fileDate}.pdf`;
  const generatedPdfPath = join(OUTPUT_DIR, generatedPdfName);

  // Rename to the expected filename
    const finalPdfPath = join(OUTPUT_DIR, pdfFilename.replace(/[/\\?%*:|"<>]/g, '_'));
  if (existsSync(generatedPdfPath)) {
    renameSync(generatedPdfPath, finalPdfPath);
  }

  return { pdfPath: finalPdfPath, pdfFilename };
}
