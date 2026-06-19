export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { validateTwilioSignature, shouldSkipTwilioValidation } from '@/lib/twilio-verify';

/**
 * POST /api/webhooks/twilio/incoming/recording
 *
 * Twilio recording callback for inbound voicemails on the business number.
 * Emails the voicemail (caller number + recording link) to the Hello inbox so
 * a callback never hits anyone's personal phone and no lead is lost.
 */
export async function POST(request: NextRequest) {
  if (!shouldSkipTwilioValidation()) {
    const valid = await validateTwilioSignature(request);
    if (!valid) return new NextResponse('Forbidden', { status: 403 });
  }

  const form = await request.formData();
  const from = (form.get('From') as string) || 'unknown caller';
  const recordingUrl = (form.get('RecordingUrl') as string) || '';
  const duration = (form.get('RecordingDuration') as string) || '?';

  try {
    const pass = process.env.HELLO_MAILBOX_PASSWORD;
    if (pass) {
      const { sendEmail, getSmtpConfig } = await import('@/lib/smtp');
      const config = getSmtpConfig('hello@signature-cleans.co.uk', pass);
      const link = recordingUrl ? `${recordingUrl}.mp3` : '(no recording)';
      await sendEmail(config, {
        from: 'Signature Cleans Voicemail <hello@signature-cleans.co.uk>',
        to: 'hello@signature-cleans.co.uk',
        subject: `New voicemail from ${from}`,
        text: `A caller left a voicemail on the cold-calling line.\n\nFrom: ${from}\nDuration: ${duration}s\nRecording: ${link}\n\nCall them back to follow up.`,
        html: `<p>A caller left a voicemail on the cold-calling line.</p><ul><li><strong>From:</strong> ${from}</li><li><strong>Duration:</strong> ${duration}s</li><li><strong>Recording:</strong> <a href="${link}">listen</a></li></ul><p>Call them back to follow up.</p>`,
      });
    }
  } catch (e) {
    console.error('[twilio/incoming/recording] email failed:', e instanceof Error ? e.message : e);
  }

  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
    headers: { 'Content-Type': 'text/xml' },
  });
}
