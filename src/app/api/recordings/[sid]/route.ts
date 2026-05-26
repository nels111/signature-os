export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasRole } from '@/lib/authz';

// GET /api/recordings/[sid]
// Proxies a Twilio recording with authentication so the browser can play it.
// Twilio recording URLs require Basic auth — the browser can't supply that directly.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sid: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  // Call recordings contain client conversations. Only the callers (VA, sales)
  // and admins should access them — never operatives or operations staff.
  if (!hasRole(session, 'admin', 'sales', 'va')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { sid } = await params;

  // Validate SID format: RE followed by 32 hex chars
  if (!/^RE[0-9a-fA-F]{32}$/.test(sid)) {
    return new NextResponse('Invalid recording SID', { status: 400 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    return new NextResponse('Twilio not configured', { status: 503 });
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${sid}.mp3`;
  const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const upstream = await fetch(twilioUrl, { headers: { Authorization: authHeader } });

  if (!upstream.ok) {
    return new NextResponse('Recording not found', { status: upstream.status === 404 ? 404 : 502 });
  }

  const contentType = upstream.headers.get('Content-Type') || 'audio/mpeg';
  const contentLength = upstream.headers.get('Content-Length');

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Cache-Control': 'private, max-age=3600',
    'Accept-Ranges': 'bytes',
  };
  if (contentLength) headers['Content-Length'] = contentLength;

  return new NextResponse(upstream.body, { status: 200, headers });
}
