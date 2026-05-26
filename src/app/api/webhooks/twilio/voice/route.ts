export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { validateTwilioSignature } from '@/lib/twilio-verify';

// Escape XML special characters in attribute or text content. Without this an
// attacker can craft a "To" value that closes the <Number> element and injects
// arbitrary TwiML (e.g. <Dial> to a premium number on Nelson's billing).
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Accept E.164 (+44...) or UK leading-zero forms only. Reject everything else
// so that XML escaping is a belt-and-braces second layer.
function normaliseUkNumber(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\+[1-9]\d{6,14}$/.test(trimmed)) return trimmed;
  if (/^0\d{9,10}$/.test(trimmed)) return '+44' + trimmed.slice(1);
  return null;
}

// POST /api/webhooks/twilio/voice
// Called by Twilio when a call is initiated from the browser SDK.
// Returns TwiML that dials the target number and enables recording.
export async function POST(request: NextRequest) {
  try {
    // Twilio signature validation: enforce in production, allow opt-out in dev/test.
    const skipValidation = process.env.TWILIO_SKIP_SIGNATURE_VALIDATION === 'true';
    if (!skipValidation) {
      const valid = await validateTwilioSignature(request);
      if (!valid) {
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    const formData = await request.formData();
    const to = formData.get('To') as string | null;
    const callerNumber = process.env.TWILIO_CALLER_NUMBER;

    if (!callerNumber || !/^\+[1-9]\d{6,14}$/.test(callerNumber)) {
      console.error('TWILIO_CALLER_NUMBER missing or invalid E.164 format');
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say voice="Polly.Brian-Neural" language="en-GB">Calling service is not configured. Please contact support.</Say></Response>`;
      return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const dialNumber = normaliseUkNumber(to);

    if (!dialNumber) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say voice="Polly.Brian-Neural" language="en-GB">No valid number provided.</Say></Response>`;
      return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const recordingCallbackBase = process.env.NEXTAUTH_URL || 'https://os.signature-cleans.co.uk';
    const callerEsc = escapeXml(callerNumber);
    const dialEsc = escapeXml(dialNumber);
    const cbEsc = escapeXml(`${recordingCallbackBase}/api/webhooks/twilio/recording`);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial
    callerId="${callerEsc}"
    record="record-from-answer"
    recordingChannels="dual"
    recordingStatusCallback="${cbEsc}"
    recordingStatusCallbackMethod="POST"
    recordingStatusCallbackEvent="completed"
    timeout="30"
  >
    <Number>${dialEsc}</Number>
  </Dial>
</Response>`;

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('Twilio voice webhook error:', error);
    const errTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say voice="Polly.Brian-Neural" language="en-GB">An error occurred. Please try again.</Say></Response>`;
    return new NextResponse(errTwiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
