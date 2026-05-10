/**
 * Email HTML builders — ported from the Vercel quote generator's generate.js
 * Client email: branded, per-visit pricing, no hours, signed as Nick
 * Internal email: full cost breakdown with margins for Nelson/Nick
 */

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export interface QuoteEmailData {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  siteType: string;
  hoursPerDay: number;
  frequency: number;
  days: string[];
  margin: number;
  productCost: number;
  overheadCost: number;
  isPilot: boolean;
}

export interface QuoteCalcData {
  monthlyTotal: string;
  pilotMonthly: string;
  pilotSavings: string;
  perVisitCharge: string;
  pilotPerVisit: string;
  perVisitSavings: string;
  frequencyDisplay: string;
  pilotReviewDate: string;
  dateDisplay: string;
  weeklyLabour: string;
  weeklySpend: string;
  weeklyCharge: string;
  weeklyProfit: string;
  monthlyProfit: string;
  quoteRef: string;
}

export function buildClientEmailHtml(d: QuoteEmailData, calc: QuoteCalcData): string {
  const isPilot = d.isPilot;
  return `<!DOCTYPE html>
<html><head><style>
body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}
.container{max-width:600px;margin:0 auto;padding:20px}
.header{text-align:center;margin-bottom:30px;border-bottom:3px solid #2c5f2d;padding-bottom:20px}
.quote-box{background:#f8f9fa;padding:25px;border-radius:10px;margin:25px 0;border-left:5px solid #2c5f2d}
.pilot-box{background:linear-gradient(135deg,#fff9e6,#fff3cd);border-left:5px solid #ffc107}
.price{font-size:28px;color:#2c5f2d;font-weight:bold;margin:15px 0}
.price-strike{font-size:20px;color:#999;text-decoration:line-through}
.pilot-price{font-size:32px;color:#28a745;font-weight:bold;margin:15px 0}
.savings{background:#d4edda;color:#155724;padding:10px;border-radius:5px;margin:15px 0;font-weight:bold;text-align:center}
.footer{margin-top:40px;padding-top:20px;border-top:2px solid #ddd;font-size:14px;color:#666}
</style></head><body><div class="container">
<div class="header">
<img src="https://signature-cleans.co.uk/wp-content/uploads/2024/01/Final-agreed-Logos.png" alt="Signature Cleans" style="max-width:250px;height:auto;margin-bottom:15px">
</div>
<p>Dear <strong>${d.contactName}</strong>,</p>
<p>Thank you for your interest in Signature Cleans. We're delighted to provide you with a comprehensive cleaning quote for <strong>${d.companyName}</strong>.</p>
<div class="quote-box ${isPilot ? 'pilot-box' : ''}">
${isPilot ? '<div style="display:inline-block;background:#ffc107;color:#000;padding:5px 15px;border-radius:20px;font-size:12px;font-weight:bold;margin-bottom:10px">SPECIAL PILOT OFFER - 25% OFF</div>' : ''}
<h2 style="margin-top:0;color:${isPilot ? '#856404' : '#2c5f2d'}">${isPilot ? 'Your 30-Day Pilot Pricing' : 'Your Quote'}</h2>
${isPilot ? `<p style="color:#856404"><strong>Try our service risk-free with 25% discount for the first 30 days!</strong></p>
<p style="margin:10px 0;font-size:14px;color:#c4302b;font-weight:bold">This pilot offer is valid for 48 hours only</p>
<p><span style="font-weight:bold;color:#555">Standard Rate:</span> <span class="price-strike">\u00A3${calc.perVisitCharge} per visit</span></p>
<p><span style="font-weight:bold;color:#555">Your Pilot Rate:</span></p>
<div class="pilot-price">\u00A3${calc.pilotPerVisit} per visit</div>
<div class="savings">You Save: \u00A3${calc.perVisitSavings} per visit for 30 days!</div>` : `<div class="price">\u00A3${calc.perVisitCharge} per visit (excl. VAT)</div>`}
<p><strong>Service Frequency:</strong> ${calc.frequencyDisplay}</p>
<p><strong>Site Type:</strong> ${d.siteType}</p>
${isPilot ? `<p style="margin-top:20px;font-size:13px;color:#856404"><strong>Pilot Period:</strong> 30 days from agreed start date<br><strong>Standard pricing begins:</strong> 30 days following pilot commencement</p>` : ''}
</div>
<div style="background:#f8f9fa;padding:20px;border-radius:8px;margin:25px 0;text-align:center">
<h3 style="margin-top:0;color:#2c5f2d">Watch Our Introduction</h3>
<p>Learn more about Signature Cleans and what makes us different:</p>
<a href="https://youtube.com/shorts/H4GzE8LtA3I?si=3Jp6cE2qcX0kCikM" style="display:inline-block;background:#c4302b;color:white;padding:15px 30px;text-decoration:none;border-radius:5px;font-weight:bold;margin:10px 0">Watch Video</a>
</div>
<p><strong>Your Documents Are Attached</strong></p>
<p>Please review the attached quote document with scope of works, T&Cs, and declaration.</p>
<p style="margin-top:25px"><strong>Next Steps:</strong></p>
<ol>
<li>Download and review the attached quote document</li>
<li>${isPilot ? 'Enjoy 25% off for your first 30 days!' : 'Review our competitive pricing'}</li>
<li>If you're happy to proceed, sign and return the declaration page</li>
<li>We'll schedule your mobilisation and get you started</li>
</ol>
<p>If you have any questions, please don't hesitate to get in touch.</p>
<div class="footer">
<p style="margin:5px 0"><strong>Nick Stentiford</strong><br>CEO & Founder, Signature Cleans</p>
<p style="margin:10px 0">01392 931035<br>nick@signature-cleans.co.uk<br>www.signature-cleans.co.uk</p>
<p style="margin:15px 0 0;font-size:12px">28 Admiral Walk, Teignmouth, TQ14 9NG</p>
</div></div></body></html>`;
}

export function buildInternalEmailHtml(d: QuoteEmailData, calc: QuoteCalcData): string {
  const isPilot = d.isPilot;
  const LABOUR_RATE = 17;
  return `<!DOCTYPE html>
<html><head><style>
body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
.container{max-width:700px;margin:0 auto;padding:20px;background:#f5f5f5}
.header{background:#2c5f2d;color:white;padding:20px;border-radius:8px 8px 0 0}
.content{background:white;padding:25px;border-radius:0 0 8px 8px;box-shadow:0 2px 4px rgba(0,0,0,.1)}
.section{background:#fafafa;padding:20px;margin:20px 0;border-radius:8px;border-left:4px solid #2c5f2d}
.section-title{color:#2c5f2d;font-size:18px;font-weight:bold;margin-bottom:15px;padding-bottom:10px;border-bottom:2px solid #2c5f2d}
table{width:100%;border-collapse:collapse;margin:15px 0;background:white}
th{background:#2c5f2d;color:white;padding:12px;text-align:left}
td{padding:10px;border-bottom:1px solid #ddd}
.highlight-row{background:#e8f5e9;font-weight:bold}
</style></head><body><div class="container">
<div class="header">
<h2 style="margin:0">${isPilot ? 'NEW QUOTE - PILOT PRICING ACTIVE' : 'NEW QUOTE GENERATED'}</h2>
<p style="margin:5px 0 0">${calc.dateDisplay}</p>
</div>
${isPilot ? '<div style="background:#ffc107;color:#000;padding:15px;text-align:center;font-weight:bold;font-size:16px">PILOT PRICING ACTIVE - 25% DISCOUNT FOR 30 DAYS</div>' : ''}
<div class="content">
<div class="section">
<div class="section-title">Client Information</div>
<p><strong>Company:</strong> ${d.companyName}<br>
<strong>Contact:</strong> ${d.contactName}<br>
<strong>Email:</strong> ${d.contactEmail}<br>
<strong>Phone:</strong> ${d.contactPhone}<br>
<strong>Address:</strong> ${d.address}<br>
<strong>Site Type:</strong> ${d.siteType}</p>
</div>
<div class="section">
<div class="section-title">Pricing Summary</div>
${isPilot ? `<div style="background:#fff3cd;padding:20px;border-left:5px solid #ffc107;margin:20px 0;border-radius:5px">
<h3 style="margin-top:0;color:#856404">PILOT PRICING APPLIED</h3>
<p><strong>Standard:</strong> <span style="text-decoration:line-through;color:#999">\u00A3${calc.monthlyTotal} pcm</span> (\u00A3${calc.perVisitCharge}/visit)</p>
<p><strong>Pilot:</strong> <span style="font-size:28px;color:#28a745;font-weight:bold">\u00A3${calc.pilotMonthly} pcm</span> (\u00A3${calc.pilotPerVisit}/visit)</p>
<div style="background:#d4edda;color:#155724;padding:12px;border-radius:5px;margin:10px 0;font-weight:bold;text-align:center">Monthly Savings: \u00A3${calc.pilotSavings}</div>
<p style="font-size:14px;color:#856404"><strong>Pilot Period:</strong> 30 days<br><strong>Review reminder:</strong> ${calc.pilotReviewDate}</p>
</div>` : `<div style="font-size:28px;color:#2c5f2d;font-weight:bold;margin:10px 0">\u00A3${calc.monthlyTotal} pcm (excl. VAT)</div>
<div style="font-size:16px;color:#555;margin:5px 0">\u00A3${calc.perVisitCharge} per visit | Client sees: per-visit rate only</div>`}
<p><strong>Frequency:</strong> ${calc.frequencyDisplay}<br>
<strong>Hours/Day:</strong> ${d.hoursPerDay}</p>
</div>
<div class="section">
<div class="section-title">Cost Breakdown</div>
<table>
<tr><th>Item</th><th style="text-align:right">Amount</th></tr>
<tr><td>Hourly Rate</td><td style="text-align:right">\u00A3${LABOUR_RATE}.00</td></tr>
<tr><td>Weekly Labour</td><td style="text-align:right">\u00A3${calc.weeklyLabour}</td></tr>
<tr><td>Weekly Products</td><td style="text-align:right">\u00A3${fmt(d.productCost)}</td></tr>
<tr><td>Weekly Overhead</td><td style="text-align:right">\u00A3${fmt(d.overheadCost)}</td></tr>
<tr><td><strong>Weekly Total Spend</strong></td><td style="text-align:right"><strong>\u00A3${calc.weeklySpend}</strong></td></tr>
<tr class="highlight-row"><td><strong>Weekly Charge</strong></td><td style="text-align:right"><strong>\u00A3${calc.weeklyCharge}</strong></td></tr>
<tr style="background:#e8f5e9"><td><strong>Weekly Profit</strong></td><td style="text-align:right;color:#2c5f2d"><strong>\u00A3${calc.weeklyProfit}</strong></td></tr>
<tr style="background:#c8e6c9"><td><strong>Monthly Profit</strong></td><td style="text-align:right;color:#1b5e20;font-size:18px"><strong>\u00A3${calc.monthlyProfit}</strong></td></tr>
<tr><td><strong>Gross Margin</strong></td><td style="text-align:right"><strong>${d.margin}%</strong></td></tr>
</table>
</div>
<div style="background:#e3f2fd;padding:20px;border-left:4px solid #2196f3;margin:20px 0;border-radius:5px">
<div class="section-title">Next Actions</div>
<ul>
<li>Quote sent to client at <strong>${d.contactEmail}</strong></li>
<li>Quote reference: <strong>${calc.quoteRef}</strong></li>
${isPilot ? `<li style="color:#856404"><strong>PILOT PRICING:</strong> Set calendar reminder for <strong>${calc.pilotReviewDate}</strong></li>` : ''}
<li>Follow up within 24-48 hours</li>
<li>Schedule site visit if required</li>
</ul>
</div>
<div style="text-align:center;margin-top:20px;padding-top:20px;border-top:2px solid #ddd;font-size:12px;color:#666">
<p><strong>Quote Ref:</strong> ${calc.quoteRef} | <strong>Generated:</strong> ${calc.dateDisplay}</p>
<p>Automated notification from Signature Cleans Quote Generator</p>
</div>
</div></div></body></html>`;
}

export function getClientEmailSubject(isPilot: boolean): string {
  return isPilot
    ? 'Your Pilot Pricing Quote (25% OFF) - Signature Cleans'
    : 'Your Cleaning Quote - Signature Cleans';
}

export function getInternalEmailSubject(companyName: string, isPilot: boolean): string {
  return isPilot
    ? `NEW QUOTE (PILOT PRICING) - ${companyName}`
    : `New Quote Generated - ${companyName}`;
}
