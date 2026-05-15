export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getSmtpConfig } from '@/lib/smtp';
import { readFileSync, existsSync } from 'fs';
import * as nodemailer from 'nodemailer';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * Resend an already-sent quote.
 *
 * Differences vs /send:
 *  - Only allowed when status is sent or viewed
 *  - Blocked for draft (use /send), accepted, rejected, expired, superseded
 *  - Does NOT mutate sentAt, status, openCount (it's a re-delivery, not a new send)
 *  - Still re-injects tracking pixel + accept link (idempotent)
 *  - Optional body.note appears in a small preface to the recipient
 *
 * Edge cases:
 *  - PDF missing on disk -> 400 (force regenerate)
 *  - No contact email -> 400
 *  - SMTP not configured -> 500 with clear message
 *  - createdBy != session.user.id -> 403 (consistent with /send)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rate = checkRateLimit(`emailSend:${session.user.id}`, RATE_LIMITS.emailSend);
    if (rate.limited) {
      return Response.json(
        { error: 'Too many resends. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rate.retryAfterMs ?? 60000) / 1000)) } }
      );
    }

    const { id } = await params;
    let body: { note?: string } | null = null;
    try { body = await request.json(); } catch { body = null; }

    const quote = await prisma.quote.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        contactEmail: true,
        contactName: true,
        companyName: true,
        emailSubject: true,
        emailHtml: true,
        pdfPath: true,
        createdBy: true,
        supersededById: true,
        trackingId: true,
      },
    });

    if (!quote) {
      return Response.json({ error: 'Quote not found' }, { status: 404 });
    }
    if (quote.createdBy !== session.user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (quote.supersededById) {
      return Response.json({ error: 'Quote has been superseded. Open the latest version to resend.' }, { status: 400 });
    }
    if (!['sent', 'viewed'].includes(quote.status)) {
      return Response.json({
        error: quote.status === 'draft'
          ? 'Draft quote: use Send (not Resend) for the first delivery.'
          : `Quote is ${quote.status}. Clone it to send a new version.`,
      }, { status: 400 });
    }

    if (!quote.contactEmail) return Response.json({ error: 'No contact email on quote' }, { status: 400 });
    if (!quote.emailSubject || !quote.emailHtml) return Response.json({ error: 'Quote has no email content. Regenerate the quote.' }, { status: 400 });
    if (!quote.pdfPath || !existsSync(quote.pdfPath)) return Response.json({ error: 'PDF not found. Please regenerate the quote.' }, { status: 400 });

    const smtpUser = process.env.SMTP_USER || 'nick@signature-cleans.co.uk';
    const smtpPass = process.env.SMTP_PASS;
    if (!smtpPass) return Response.json({ error: 'SMTP not configured.' }, { status: 500 });

    // Ensure trackingId exists (legacy quotes may not have one).
    let trackingId = quote.trackingId;
    if (!trackingId) {
      trackingId = crypto.randomUUID();
      await prisma.quote.update({ where: { id: quote.id }, data: { trackingId } });
    }

    // Inject tracking pixel + accept link (idempotent - safe even if previous send already had it)
    const appUrl = process.env.APP_URL || 'https://os.signature-cleans.co.uk';
    const pixelUrl = `${appUrl}/api/quotes/track/${trackingId}/pixel.gif`;
    const acceptUrl = `${appUrl}/api/quotes/track/${trackingId}/accept`;
    let html = quote.emailHtml;
    if (!html.includes(pixelUrl)) {
      const block = `
      <div style="text-align:center;margin:24px 0;">
        <a href="${acceptUrl}" style="background:#6B8E23;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;display:inline-block;">Accept this quote</a>
      </div>
      <img src="${pixelUrl}" alt="" width="1" height="1" style="display:none;width:1px;height:1px;" />`;
      html = html.includes('</body>') ? html.replace('</body>', `${block}</body>`) : `${html}\n${block}`;
    }

    // Optional gentle preface from the sender
    if (body?.note) {
      const safeNote = body.note.replace(/[<>]/g, '');
      const preface = `<div style="background:#f6faef;border-left:4px solid #6B8E23;padding:12px 16px;margin:0 0 16px;font-style:italic;color:#3b4a18;">${safeNote}</div>`;
      // Insert after first <body> if present
      if (html.includes('<body>')) html = html.replace('<body>', `<body>${preface}`);
      else html = `${preface}${html}`;
    }

    const pdfBuffer = readFileSync(quote.pdfPath);
    const pdfFilename = `Signature Cleans T&C's and quote letter (${quote.companyName}).pdf`;
    const config = getSmtpConfig(smtpUser, smtpPass);

    const transporter = nodemailer.createTransport({
      host: config.host, port: config.port, secure: false,
      auth: { user: config.user, pass: config.pass },
    });

    await transporter.sendMail({
      from: '"Nick Stentiford" <nick@signature-cleans.co.uk>',
      to: quote.contactEmail,
      cc: 'nelson@signature-cleans.co.uk',
      bcc: 'nick@signature-cleans.co.uk',
      replyTo: 'nick@signature-cleans.co.uk',
      subject: `Re: ${quote.emailSubject}`,
      html,
      attachments: [{ filename: pdfFilename, content: pdfBuffer, contentType: 'application/pdf' }],
    });

    return Response.json({ success: true, sent_to: quote.contactEmail });
  } catch (err) {
    console.error('[resend] error', err);
    return Response.json({ error: 'Failed to resend quote' }, { status: 500 });
  }
}
