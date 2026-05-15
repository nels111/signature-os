export const runtime = 'nodejs';

import { prisma } from '@/lib/db';

// 1x1 transparent GIF (43 bytes)
const PIXEL = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
  0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21,
  0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b,
]);

const NO_CACHE_HEADERS = {
  'Content-Type': 'image/gif',
  'Content-Length': String(PIXEL.length),
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

/**
 * Tracking pixel for quote emails.
 *
 * Always returns a 1x1 GIF so we never leak whether a token is valid.
 *
 * Edge cases:
 *  - Unknown token -> pixel, no-op
 *  - Already accepted / rejected -> still bump openCount, never downgrade status
 *  - Already viewed -> bump openCount, leave viewedAt at first hit
 *  - Sent but not yet viewed -> promote to 'viewed', set viewedAt
 *  - Draft (shouldn't happen) -> bump openCount only, do not change status
 *  - Superseded -> bump openCount but keep status
 *  - DB error -> still return pixel (we don't break recipient email rendering)
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (token) {
      // Token is quote.trackingId (random UUID), NOT the internal cuid. Using
      // the internal id leaks record identifiers and lets recipients enumerate
      // adjacent quotes via their inbox.
      const q = await prisma.quote.findFirst({
        where: { trackingId: token },
        select: { id: true, status: true, viewedAt: true },
      });
      if (q) {
        const data: Record<string, unknown> = { openCount: { increment: 1 } };
        // Promote sent -> viewed on first open
        if (q.status === 'sent') {
          data.status = 'viewed';
          if (!q.viewedAt) data.viewedAt = new Date();
        } else if (q.status === 'viewed' && !q.viewedAt) {
          // Defensive: status was viewed but viewedAt never set
          data.viewedAt = new Date();
        }
        await prisma.quote.update({ where: { id: q.id }, data });
      }
    }
  } catch (err) {
    console.error('[pixel] failed to update quote', err);
  }

  return new Response(PIXEL, { status: 200, headers: NO_CACHE_HEADERS });
}
