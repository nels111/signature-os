/**
 * lib/twilio-sms.ts — minimal Twilio SMS sender.
 *
 * Sends a plain SMS from the business number (TWILIO_CALLER_NUMBER) via the
 * Twilio REST API. Best-effort: returns false on any failure rather than
 * throwing, so a notification path is never broken by a single SMS failure.
 */

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const SMS_SENDER = process.env.TWILIO_CALLER_NUMBER || '+447480486271';

export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!ACCOUNT_SID || !AUTH_TOKEN) {
    console.error('[twilio-sms] TWILIO_ACCOUNT_SID/AUTH_TOKEN not set — SMS skipped');
    return false;
  }
  if (!to) return false;

  const params = new URLSearchParams({ From: SMS_SENDER, To: to, Body: body });

  try {
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );
    if (!resp.ok) {
      console.error(`[twilio-sms] send failed to ${to}:`, resp.status, await resp.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('[twilio-sms] error:', e instanceof Error ? e.message : e);
    return false;
  }
}
