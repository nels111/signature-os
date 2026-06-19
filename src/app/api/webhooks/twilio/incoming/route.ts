export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { validateTwilioSignature, shouldSkipTwilioValidation } from '@/lib/twilio-verify';

/**
 * POST /api/webhooks/twilio/incoming
 *
 * Inbound handler for the cold-calling business number (TWILIO_CALLER_NUMBER).
 * When a prospect calls the number back (e.g. a missed cold call), greet them
 * and take a voicemail, which is emailed to the Hello inbox by the recording
 * callback. Nothing ever rings the VA's personal phone.
 */
export async function POST(request: NextRequest) {
  if (!shouldSkipTwilioValidation()) {
    const valid = await validateTwilioSignature(request);
    if (!valid) return new NextResponse('Forbidden', { status: 403 });
  }

  const base = (process.env.APP_URL || 'https://os.signature-cleans.co.uk').replace(/\/$/, '');
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Brian-Neural" language="en-GB">Thank you for calling Signature Cleans. Sorry we missed your call. Please leave a brief message after the tone and a member of our team will get back to you.</Say>
  <Record maxLength="120" playBeep="true" timeout="5" recordingStatusCallback="${base}/api/webhooks/twilio/incoming/recording" recordingStatusCallbackMethod="POST" />
  <Say voice="Polly.Brian-Neural" language="en-GB">We did not receive a message. Goodbye.</Say>
</Response>`;

  return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
