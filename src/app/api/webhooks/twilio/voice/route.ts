export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

// POST /api/webhooks/twilio/voice
// Called by Twilio when a call is initiated from the browser SDK.
// Returns TwiML that dials the target number and enables recording.
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const to = formData.get('To') as string | null;
    const callerNumber = process.env.TWILIO_CALLER_NUMBER || '+447480486271';

    // "To" is the phone number passed from the browser SDK when initiating the call.
    // Normalise UK mobile/landline numbers to E.164 if needed.
    let dialNumber = to;
    if (dialNumber && !dialNumber.startsWith('+')) {
      // Convert 07xxx -> +447xxx, 01xxx -> +441xxx, etc.
      if (dialNumber.startsWith('0')) {
        dialNumber = '+44' + dialNumber.slice(1);
      }
    }

    if (!dialNumber) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say voice="Polly.Brian-Neural" language="en-GB">No number provided.</Say></Response>`;
      return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const recordingCallbackBase = process.env.NEXTAUTH_URL || 'https://os.signature-cleans.co.uk';

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial
    callerId="${callerNumber}"
    record="record-from-answer"
    recordingChannels="dual"
    recordingStatusCallback="${recordingCallbackBase}/api/webhooks/twilio/recording"
    recordingStatusCallbackMethod="POST"
    recordingStatusCallbackEvent="completed"
    timeout="30"
  >
    <Number>${dialNumber}</Number>
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
