export const runtime = 'nodejs';

import { prisma } from '@/lib/db';
import { logQuoteAccepted } from '@/lib/activities';

const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
};

// HTML-escape user-controlled values before interpolation. Quote text
// (companyName, contactName) can be edited by sales reps; never trust it
// in a raw template literal. Renders &, <, >, ", and ' as named entities.
function esc(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shell(title: string, heading: string, body: string, status: 'ok' | 'info' | 'error' = 'ok'): string {
  const accent = status === 'ok' ? '#6B8E23' : status === 'info' ? '#2056A4' : '#D1242F';
  // `title`, `heading`, and `body` come from callers in this file (literal
  // strings or already-escaped interpolations). The accent comes from a
  // closed enum so it's safe inside the inline <style>.
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin:0; background:#f5f7f5; }
    .wrap { max-width: 520px; margin: 80px auto; padding: 32px; background:#fff; border-radius:14px; box-shadow:0 4px 16px rgba(0,0,0,0.06); }
    h1 { color: ${accent}; margin: 0 0 12px; font-size: 24px; }
    p { color:#444; line-height:1.55; font-size: 16px; }
    .badge { display:inline-block; padding:4px 10px; border-radius:6px; background:${accent}1a; color:${accent}; font-weight:600; font-size:12px; letter-spacing:0.05em; text-transform:uppercase; }
    .foot { margin-top:32px; color:#777; font-size:13px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="badge">Signature Cleans</div>
    <h1>${esc(heading)}</h1>
    <div>${body}</div>
    <p class="foot">If anything looks wrong, reply to the original quote email or call 01392 931035.</p>
  </div>
</body>
</html>`;
}

/**
 * Public quote acceptance landing page.
 *
 * Edge cases:
 *  - Unknown token -> generic 404 page (don't leak details)
 *  - Already accepted -> idempotent "you've already accepted" page
 *  - Already rejected -> let recipient accept anyway (override) and update
 *  - Expired or superseded -> show error page, do not accept
 *  - Draft -> shouldn't happen, treat as 404
 *  - DB error -> render generic error page (no internal details)
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return new Response(shell('Not found', 'Quote not found', '<p>This link is invalid or expired.</p>', 'error'), { status: 404, headers: HTML_HEADERS });
    }

    // Look up by trackingId (public, random UUID) NOT by id (sequential cuid).
    // Using id as the public token leaks the internal record identifier and
    // makes adjacent records guessable.
    const quote = await prisma.quote.findFirst({
      where: { trackingId: token },
      select: { id: true, status: true, companyName: true, contactName: true, monthlyTotal: true, supersededById: true, acceptedAt: true, dealId: true },
    });

    if (!quote) {
      return new Response(shell('Not found', 'Quote not found', '<p>This link is invalid or expired.</p>', 'error'), { status: 404, headers: HTML_HEADERS });
    }

    if (quote.status === 'expired' || quote.status === 'superseded' || quote.supersededById) {
      return new Response(
        shell('Expired', 'This quote is no longer active',
          `<p>This quote has been updated or expired. We'll be in touch with the latest version.</p>`,
          'error'),
        { status: 410, headers: HTML_HEADERS },
      );
    }

    if (quote.status === 'accepted') {
      return new Response(
        shell('Already accepted', 'Quote already accepted',
          `<p>Hi ${esc(quote.contactName ?? 'there')} - this quote was accepted on ${esc(quote.acceptedAt?.toDateString() ?? 'a previous date')}. Nick or Nelson will be in touch shortly with next steps.</p>`,
          'info'),
        { status: 200, headers: HTML_HEADERS },
      );
    }

    // Accept (transitions from sent / viewed / rejected -> accepted)
    await prisma.quote.update({
      where: { id: quote.id },
      data: { status: 'accepted', acceptedAt: new Date() },
    });

    // Notify the creator and log activity (attributed to the quote owner)
    try {
      const fresh = await prisma.quote.findUnique({
        where: { id: quote.id },
        select: { createdBy: true },
      });
      if (fresh?.createdBy) {
        await prisma.notification.create({
          data: {
            userId: fresh.createdBy,
            type: 'deal_stage_changed',
            title: 'Quote accepted',
            message: `${quote.companyName ?? 'A client'} accepted the quote.`,
            entityType: 'quote',
            entityId: quote.id,
          },
        });
        await logQuoteAccepted({
          userId: fresh.createdBy,
          quoteId: quote.id,
          dealId: quote.dealId,
          companyName: quote.companyName,
        });
      }
    } catch (e) {
      console.error('[accept] notification or activity failed', e);
    }

    return new Response(
      shell('Accepted', 'Quote accepted - thank you!',
        `<p>Hi ${esc(quote.contactName ?? 'there')},</p>
         <p>We've recorded your acceptance of the quote for ${esc(quote.companyName ?? 'your site')}. Nick will reach out within one working day to confirm start dates and onboarding.</p>
         <p>Peace of mind, every time.</p>`,
        'ok'),
      { status: 200, headers: HTML_HEADERS },
    );
  } catch (err) {
    console.error('[accept] error', err);
    return new Response(
      shell('Error', 'Something went wrong',
        '<p>We had a problem confirming your acceptance. Please reply to the quote email and we will sort it manually.</p>',
        'error'),
      { status: 500, headers: HTML_HEADERS },
    );
  }
}
