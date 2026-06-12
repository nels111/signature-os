/**
 * lib/twilio-wa.ts — Twilio WhatsApp (or SMS fallback) notification sender.
 *
 * WhatsApp via Twilio requires a WA-approved sender number.
 * Until that's set up, sends as SMS from the Twilio caller number.
 * When WA is enabled, set TWILIO_WA_SENDER=whatsapp:+14155238886 (or your WA number).
 */

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const AUTH_TOKEN   = process.env.TWILIO_AUTH_TOKEN || '';
const WA_SENDER    = process.env.TWILIO_WA_SENDER || '';  // whatsapp:+... when enabled
const SMS_SENDER   = process.env.TWILIO_CALLER_NUMBER || '+447480486271';

export async function sendTwilioWhatsapp(to: string, message: string): Promise<void> {
  if (!ACCOUNT_SID || !AUTH_TOKEN) return;

  // Clean up WA-style formatting for SMS (strip markdown bold asterisks)
  const smsText = message.replace(/\*/g, '').replace(/\n\n+/g, '\n');

  const useWA = !!WA_SENDER;
  const from  = useWA ? WA_SENDER  : SMS_SENDER;
  const toNum = useWA ? `whatsapp:${to}` : to;
  const body  = useWA ? message : smsText;

  const params = new URLSearchParams({ From: from, To: toNum, Body: body });

  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }
  );

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`[twilio-wa] send failed to ${to}:`, err);
    throw new Error(`Twilio error: ${resp.status}`);
  }
}
