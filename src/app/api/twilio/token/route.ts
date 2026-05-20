export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import twilio from 'twilio';

const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

// GET /api/twilio/token
// Returns a short-lived Twilio Access Token scoped to the Voice SDK.
// Only VA and admin roles can obtain a token.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== 'va' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
      console.error('Missing Twilio env vars');
      return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 });
    }

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: false,
    });

    // AccessToken requires Account SID, API Key SID, and API Key Secret
    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity: session.user.id,
      ttl: 3600, // 1 hour
    });
    token.addGrant(voiceGrant);

    return NextResponse.json({ token: token.toJwt() });
  } catch (error) {
    console.error('Twilio token error:', error);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}
