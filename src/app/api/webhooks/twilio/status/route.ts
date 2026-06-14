export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { validateTwilioSignature, shouldSkipTwilioValidation } from '@/lib/twilio-verify';

// POST /api/webhooks/twilio/status
// Receives call status updates from Twilio.
// Currently just logs for debugging, recording is handled by /recording webhook.
export async function POST(request: NextRequest) {
  try {
    const skipValidation = shouldSkipTwilioValidation();
    if (!skipValidation) {
      const valid = await validateTwilioSignature(request);
      if (!valid) {
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    return new NextResponse('OK', { status: 200 });
  } catch {
    return new NextResponse('OK', { status: 200 });
  }
}
