import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Whether Twilio signature validation may be skipped.
 * ALWAYS false in production: the TWILIO_SKIP_SIGNATURE_VALIDATION flag is honoured
 * only OUTSIDE production, so a misconfigured prod env can never disable webhook auth.
 * Logs loudly if the flag is set in production (it is being ignored).
 */
export function shouldSkipTwilioValidation(): boolean {
  const flag = process.env.TWILIO_SKIP_SIGNATURE_VALIDATION === 'true';
  if (process.env.NODE_ENV === 'production') {
    if (flag) {
      console.error('[twilio-verify] TWILIO_SKIP_SIGNATURE_VALIDATION=true is IGNORED in production — signature validation is FORCED ON.');
    }
    return false;
  }
  return flag;
}

/**
 * Validate that a webhook POST genuinely came from Twilio.
 *
 * Twilio signs every webhook with HMAC-SHA1 using your AUTH_TOKEN.
 * Algorithm (per https://www.twilio.com/docs/usage/webhooks/webhooks-security):
 *   1. Take the full URL of the request (https, with query string).
 *   2. Append each form parameter sorted alphabetically by name, concatenating name+value with no separator.
 *   3. HMAC-SHA1 the result with the AUTH_TOKEN as the key.
 *   4. Base64-encode the digest.
 *   5. Compare against the X-Twilio-Signature header in constant time.
 *
 * Returns true if the signature is valid, false otherwise.
 *
 * Set TWILIO_SKIP_SIGNATURE_VALIDATION=true to bypass in dev/test only.
 */
export async function validateTwilioSignature(
  request: Request,
): Promise<boolean> {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error('[twilio-verify] TWILIO_AUTH_TOKEN not set — refusing webhook');
    return false;
  }

  const signature = request.headers.get('x-twilio-signature');
  if (!signature) return false;

  // Reconstruct the URL Twilio used to sign. When behind a proxy we need
  // the public URL — prefer X-Forwarded-* headers, fall back to request.url.
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const url = new URL(request.url);
  const publicUrl = host ? `${proto}://${host}${url.pathname}${url.search}` : request.url;

  // Clone the request so consumers can still read formData() afterwards.
  const clone = request.clone();
  const form = await clone.formData();
  const params: Array<[string, string]> = [];
  for (const [key, value] of form.entries()) {
    params.push([key, String(value)]);
  }
  params.sort((a, b) => a[0].localeCompare(b[0]));

  let data = publicUrl;
  for (const [key, value] of params) {
    data += key + value;
  }

  const expected = createHmac('sha1', authToken).update(data).digest('base64');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) {
    console.warn('[twilio-verify] signature length mismatch — reconstructed URL:', publicUrl, '| got sig:', signature, '| expected sig:', expected);
    return false;
  }
  const match = timingSafeEqual(sigBuf, expBuf);
  if (!match) {
    console.warn('[twilio-verify] signature mismatch — reconstructed URL:', publicUrl, '| params:', params.map(([k]) => k).join(','), '| got sig:', signature, '| expected sig:', expected);
  }
  return match;
}
