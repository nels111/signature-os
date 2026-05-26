export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateTwilioSignature } from '@/lib/twilio-verify';

// Only allow transcription downloads from the canonical Twilio recording host.
// Without this an attacker can craft a RecordingUrl to anywhere and we'll
// dutifully send TWILIO_AUTH_TOKEN over the wire as Basic auth.
const TWILIO_RECORDING_HOST = 'api.twilio.com';

// POST /api/webhooks/twilio/recording
// Called by Twilio when a call recording is complete.
// Attaches the recording URL to the matching activity (looked up by callSid).
// Transcription is handled separately after recording is attached.
export async function POST(request: NextRequest) {
  try {
    const skipValidation = process.env.TWILIO_SKIP_SIGNATURE_VALIDATION === 'true';
    if (!skipValidation) {
      const valid = await validateTwilioSignature(request);
      if (!valid) {
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    const formData = await request.formData();

    const callSid = formData.get('CallSid') as string | null;
    const recordingUrl = formData.get('RecordingUrl') as string | null;
    const recordingDuration = formData.get('RecordingDuration') as string | null;
    const recordingSid = formData.get('RecordingSid') as string | null;
    // "To" = the lead's phone number (normalised E.164 by Twilio)
    const toNumber = formData.get('To') as string | null;

    // Hard-validate the recording URL hostname before we ever touch it.
    if (recordingUrl) {
      try {
        const u = new URL(recordingUrl);
        if (u.hostname !== TWILIO_RECORDING_HOST) {
          console.warn('[twilio recording] rejecting non-Twilio host:', u.hostname);
          return new NextResponse('OK', { status: 200 });
        }
      } catch {
        return new NextResponse('OK', { status: 200 });
      }
    }

    if (!callSid || !recordingUrl) {
      return new NextResponse('OK', { status: 200 });
    }

    // Append .mp3 for direct browser playback
    const playbackUrl = recordingUrl + '.mp3';

    // Strategy 1: match by callSid stored in activity metadata (set when browser SDK exposes it)
    let activities = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM activities
      WHERE metadata->>'callSid' = ${callSid}
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;

    // Strategy 2: match by lead phone number + recency (fallback when callSid wasn't stored)
    // The Twilio SDK doesn't expose CallSid for outbound calls via call.parameters,
    // so activities may not have it. Use phone number + the most recent unrecorded call activity.
    if (activities.length === 0 && toNumber) {
      // Normalise: Twilio sends +447xxx, leads may have 07xxx or +447xxx
      const normalised = toNumber.startsWith('+44') ? '0' + toNumber.slice(3) : toNumber;
      activities = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT a.id FROM activities a
        JOIN leads l ON l.id = a."entityId"
        WHERE a."activityType" = 'call'
          AND a."entityType" = 'lead'
          AND (l.phone = ${toNumber} OR l.phone = ${normalised})
          AND (a.metadata->>'recordingUrl') IS NULL
          AND a."createdAt" >= NOW() - INTERVAL '2 hours'
        ORDER BY a."createdAt" DESC
        LIMIT 1
      `;
    }

    if (activities.length === 0) {
      return new NextResponse('OK', { status: 200 });
    }

    const activityId = activities[0].id;

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { metadata: true },
    });
    const currentMeta = (activity?.metadata as Record<string, unknown>) || {};

    await prisma.activity.update({
      where: { id: activityId },
      data: {
        metadata: {
          ...currentMeta,
          recordingUrl: playbackUrl,
          recordingSid,
          recordingDuration: recordingDuration ? parseInt(recordingDuration) : null,
        },
      },
    });

    // Kick off transcription asynchronously if ElevenLabs key is available
    const elKey = process.env.ELEVENLABS_API_KEY;
    if (elKey) {
      transcribeWithElevenLabs(activityId, playbackUrl, currentMeta, elKey).catch(err => {
        console.error('ElevenLabs transcription failed:', err);
      });
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('Twilio recording webhook error:', error);
    return new NextResponse('OK', { status: 200 });
  }
}

async function transcribeWithElevenLabs(
  activityId: string,
  audioUrl: string,
  currentMeta: Record<string, unknown>,
  apiKey: string,
): Promise<void> {
  // Defence-in-depth: validate the URL host one more time before sending Basic auth.
  // If anything ever bypasses the route handler check, this is the last line.
  try {
    const u = new URL(audioUrl);
    if (u.hostname !== TWILIO_RECORDING_HOST) {
      console.error('[transcribe] refusing to fetch non-Twilio URL:', u.hostname);
      return;
    }
  } catch {
    return;
  }

  // Download the recording (Twilio auth required)
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const audioRes = await fetch(audioUrl, { headers: { Authorization: authHeader } });
  if (!audioRes.ok) throw new Error(`Failed to download recording: ${audioRes.status}`);
  const audioBuffer = await audioRes.arrayBuffer();

  // Upload to ElevenLabs Speech-to-Text (Scribe)
  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'recording.mp3');
  formData.append('model_id', 'scribe_v1');
  formData.append('language_code', 'en');
  formData.append('diarize', 'false');

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs STT error ${res.status}: ${err}`);
  }

  const data = await res.json() as { text?: string };
  const transcriptText = data.text?.trim() || '';

  if (!transcriptText) return;

  // Re-fetch metadata in case it changed while we were transcribing
  const latest = await prisma.activity.findUnique({ where: { id: activityId }, select: { metadata: true } });
  const latestMeta = (latest?.metadata as Record<string, unknown>) || currentMeta;

  await prisma.activity.update({
    where: { id: activityId },
    data: { metadata: { ...latestMeta, transcriptText, transcriptStatus: 'completed' } },
  });

}
