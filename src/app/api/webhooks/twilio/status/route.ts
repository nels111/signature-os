export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

// POST /api/webhooks/twilio/status
// Receives call status updates from Twilio.
// Currently just logs for debugging — recording is handled by /recording webhook.
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const callSid = formData.get('CallSid');
    const callStatus = formData.get('CallStatus');
    const duration = formData.get('CallDuration');
    console.log('Twilio status update:', { callSid, callStatus, duration });
    return new NextResponse('OK', { status: 200 });
  } catch {
    return new NextResponse('OK', { status: 200 });
  }
}
