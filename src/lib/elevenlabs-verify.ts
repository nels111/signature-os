import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Authentication for the ElevenLabs answering-service webhook.
 *
 * Two accepted proofs (either is sufficient):
 *  1. HMAC signature — the ElevenLabs workspace post-call webhook signs every
 *     request: header `ElevenLabs-Signature: t=<unix>,v0=<hex sha256>` where the
 *     digest is HMAC_SHA256(secret, `${t}.${rawBody}`).
 *  2. Shared secret — when wired via the agent's custom server-tool (which lets
 *     us set request headers), an `Authorization: Bearer <secret>` or
 *     `x-webhook-secret: <secret>` header matching ELEVENLABS_WEBHOOK_SECRET.
 *
 * Secret source: ELEVENLABS_WEBHOOK_SECRET. With no secret set, every request
 * is refused (fail closed).
 */

const FRESHNESS_WINDOW_MS = 30 * 60 * 1000; // 30 min replay window

/**
 * In production, signature validation is ALWAYS enforced. The skip flag is
 * honoured only outside production so a misconfigured prod env can never
 * disable webhook auth.
 */
export function shouldSkipElevenLabsValidation(): boolean {
  const flag = process.env.ELEVENLABS_SKIP_SIGNATURE_VALIDATION === 'true';
  if (process.env.NODE_ENV === 'production') {
    if (flag) {
      console.error('[elevenlabs-verify] ELEVENLABS_SKIP_SIGNATURE_VALIDATION=true is IGNORED in production — validation is FORCED ON.');
    }
    return false;
  }
  return flag;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Verify the `t=..,v0=..` HMAC signature against the raw request body. */
export function verifyHmacSignature(rawBody: string, signatureHeader: string, secret: string, now: number = Date.now()): boolean {
  const parts: Record<string, string> = {};
  for (const seg of signatureHeader.split(',')) {
    const idx = seg.indexOf('=');
    if (idx === -1) continue;
    const k = seg.slice(0, idx).trim();
    const v = seg.slice(idx + 1).trim();
    if (k) parts[k] = v;
  }
  const t = parts['t'];
  const v0 = parts['v0'];
  if (!t || !v0) return false;

  // Replay protection: reject stale timestamps.
  const ts = Number(t);
  if (Number.isFinite(ts)) {
    const ageMs = Math.abs(now - ts * 1000);
    if (ageMs > FRESHNESS_WINDOW_MS) {
      console.warn('[elevenlabs-verify] stale signature timestamp — rejected');
      return false;
    }
  }

  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return safeEqual(v0, expected);
}

/**
 * Validate an incoming webhook request. Pass the RAW body string (read with
 * request.text() before JSON.parse) and the request headers.
 */
export function validateElevenLabsRequest(rawBody: string, headers: Headers, now: number = Date.now()): boolean {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[elevenlabs-verify] ELEVENLABS_WEBHOOK_SECRET not set — refusing webhook');
    return false;
  }

  // 1) HMAC signature (workspace post-call webhook).
  const sig = headers.get('elevenlabs-signature');
  if (sig) return verifyHmacSignature(rawBody, sig, secret, now);

  // 2) Shared-secret fallback (custom server-tool wiring).
  const authHeader = headers.get('authorization');
  const bearer = authHeader && /^Bearer\s+/i.test(authHeader) ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';
  const shared = headers.get('x-webhook-secret') || bearer;
  if (shared) return safeEqual(shared, secret);

  return false;
}
