/**
 * Cold calling email templates — four outbound emails triggered by call outcomes.
 *
 * All emails:
 *  - From: hello@signature-cleans.co.uk (displayed as Nick Stentiford)
 *  - Signed as Nick
 *  - Include Nick's 2025 email signature image
 *
 * Attachments:
 *  - Gatekeeper:              signature only
 *  - Callback Booked:         signature only
 *  - Decision Maker / Info:   signature + 1-pager PDF
 *  - Site Visit Booked:       signature + 1-pager PDF
 */

import fs from 'fs';
import path from 'path';

// Asset paths (served from /public/assets/email/)
const ASSETS_DIR = path.join(process.cwd(), 'public', 'assets', 'email');

function loadAsset(filename: string): string {
  return fs.readFileSync(path.join(ASSETS_DIR, filename)).toString('base64');
}

export function getNickSignatureAttachment() {
  return {
    filename: 'signature.jpg',
    contentType: 'image/jpeg',
    content: loadAsset('nick-signature.jpg'),
  };
}

export function getOnePagerAttachment() {
  return {
    filename: 'Signature Cleans - Overview.pdf',
    contentType: 'application/pdf',
    content: loadAsset('signature-cleans-1pager.pdf'),
  };
}

// ─── Template helpers ────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapHtml(body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #222; margin: 0; padding: 0; }
  .email-body { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
  p { margin: 0 0 16px; }
  .sig-image { margin-top: 24px; max-width: 320px; height: auto; display: block; }
</style>
</head>
<body>
<div class="email-body">
${body}
</div>
</body>
</html>`;
}

// ─── Gatekeeper ──────────────────────────────────────────────────────────────

export interface GatekeeperEmailVars {
  firstName: string;
  company: string;
}

export function buildGatekeeperEmail(v: GatekeeperEmailVars) {
  const firstName = escapeHtml(v.firstName);
  const company = escapeHtml(v.company);

  const text = `Hi ${v.firstName},

I tried to get through earlier. I was hoping to speak with whoever looks after facilities or cleaning at ${v.company}.

We're Signature Cleans, a commercial cleaning company covering Devon, Cornwall and Somerset. We work with businesses of all sizes and would love to have a quick chat to see if we could help.

Would you be able to point me in the right direction or pass this along to the right person?

Many Thanks,
Nick
01392 931035
nick@signature-cleans.co.uk`;

  const html = wrapHtml(`<p>Hi ${firstName},</p>
<p>I tried to get through earlier. I was hoping to speak with whoever looks after facilities or cleaning at ${company}.</p>
<p>We're Signature Cleans, a commercial cleaning company covering Devon, Cornwall and Somerset. We work with businesses of all sizes and would love to have a quick chat to see if we could help.</p>
<p>Would you be able to point me in the right direction or pass this along to the right person?</p>
<p>Many Thanks,<br>Nick</p>
<img src="cid:nick-signature" alt="Nick Stentiford - Signature Cleans" class="sig-image" />`);

  return {
    subject: `Cleaning services for ${v.company}`,
    text,
    html,
    attachments: [getNickSignatureAttachment()],
  };
}

// ─── Callback Booked ─────────────────────────────────────────────────────────

export interface CallbackEmailVars {
  firstName: string;
  callbackDate: string; // e.g. "Wednesday 4 June"
  callbackTime: string; // e.g. "2:00pm"
}

export function buildCallbackEmail(v: CallbackEmailVars) {
  const firstName = escapeHtml(v.firstName);

  const text = `Hi ${v.firstName},

Really appreciate you taking the time to chat. As agreed, I'll give you a call on ${v.callbackDate} at ${v.callbackTime}. If anything changes just drop me a message.

Looking forward to speaking properly.

Many Thanks,
Nick
01392 931035
nick@signature-cleans.co.uk`;

  const html = wrapHtml(`<p>Hi ${firstName},</p>
<p>Really appreciate you taking the time to chat. As agreed, I'll give you a call on <strong>${escapeHtml(v.callbackDate)}</strong> at <strong>${escapeHtml(v.callbackTime)}</strong>. If anything changes just drop me a message.</p>
<p>Looking forward to speaking properly.</p>
<p>Many Thanks,<br>Nick</p>
<img src="cid:nick-signature" alt="Nick Stentiford - Signature Cleans" class="sig-image" />`);

  return {
    subject: `Speak soon, Signature Cleans`,
    text,
    html,
    attachments: [getNickSignatureAttachment()],
  };
}

// ─── Decision Maker Spoke / Send Info ────────────────────────────────────────

export interface SendInfoEmailVars {
  firstName: string;
  company: string;
}

export function buildSendInfoEmail(v: SendInfoEmailVars) {
  const firstName = escapeHtml(v.firstName);
  const company = escapeHtml(v.company);

  const text = `Hi ${v.firstName},

Great speaking with you earlier. As promised, wanted to send across a bit more about what we do.

We provide commercial cleaning across Devon, Cornwall and Somerset, covering everything from daily office cleans to specialist contracts. We're fully managed, reliability is our thing, and we work around your schedule.

I've attached a quick overview so you can see what we're about. I'd love to pop over for a site visit so I can give you an accurate picture of what we'd do for ${v.company}. No obligation, just a chance to meet properly and put a number together.

What does your diary look like over the next week or two?

Many Thanks,
Nick
01392 931035
nick@signature-cleans.co.uk`;

  const html = wrapHtml(`<p>Hi ${firstName},</p>
<p>Great speaking with you earlier. As promised, wanted to send across a bit more about what we do.</p>
<p>We provide commercial cleaning across Devon, Cornwall and Somerset, covering everything from daily office cleans to specialist contracts. We're fully managed, reliability is our thing, and we work around your schedule.</p>
<p>I've attached a quick overview so you can see what we're about. I'd love to pop over for a site visit so I can give you an accurate picture of what we'd do for ${company}. No obligation, just a chance to meet properly and put a number together.</p>
<p>What does your diary look like over the next week or two?</p>
<p>Many Thanks,<br>Nick</p>
<img src="cid:nick-signature" alt="Nick Stentiford - Signature Cleans" class="sig-image" />`);

  return {
    subject: `More about Signature Cleans`,
    text,
    html,
    attachments: [getNickSignatureAttachment(), getOnePagerAttachment()],
  };
}

// ─── Site Visit Booked ───────────────────────────────────────────────────────

export interface SiteVisitEmailVars {
  firstName: string;
  company: string;
  visitDate: string;  // e.g. "Wednesday 4 June"
  visitTime: string;  // e.g. "10:00am"
  visitAddress?: string;
}

export function buildSiteVisitEmail(v: SiteVisitEmailVars) {
  const firstName = escapeHtml(v.firstName);
  const company = escapeHtml(v.company);
  const addressLine = v.visitAddress
    ? ` at ${escapeHtml(v.visitAddress)}`
    : '';
  const addressText = v.visitAddress ? ` at ${v.visitAddress}` : '';

  const text = `Hi ${v.firstName},

Just confirming our site visit on ${v.visitDate} at ${v.visitTime}${addressText}.

I've attached a brief overview of Signature Cleans so you've got something to look over beforehand. Looking forward to seeing the site and having a proper chat about what we can do for ${v.company}.

If anything changes in the meantime just let me know.

Many Thanks,
Nick
01392 931035
nick@signature-cleans.co.uk`;

  const html = wrapHtml(`<p>Hi ${firstName},</p>
<p>Just confirming our site visit on <strong>${escapeHtml(v.visitDate)}</strong> at <strong>${escapeHtml(v.visitTime)}</strong>${addressLine}.</p>
<p>I've attached a brief overview of Signature Cleans so you've got something to look over beforehand. Looking forward to seeing the site and having a proper chat about what we can do for ${company}.</p>
<p>If anything changes in the meantime just let me know.</p>
<p>Many Thanks,<br>Nick</p>
<img src="cid:nick-signature" alt="Nick Stentiford - Signature Cleans" class="sig-image" />`);

  return {
    subject: `Site visit confirmed: ${v.company}`,
    text,
    html,
    attachments: [getNickSignatureAttachment(), getOnePagerAttachment()],
  };
}
