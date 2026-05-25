import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendPushToAdminAndSales } from '@/lib/push';

export const runtime = 'nodejs';

const VALID_ENTITY_TYPES = ['lead', 'deal', 'contact', 'account'];
const VALID_ACTIVITY_TYPES = ['note', 'call', 'email', 'meeting', 'status_change'];

// GET /api/activities - List activities (filtered by entity)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1') || 1;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20') || 20, 100);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    const where: Record<string, unknown> = {};

    if (entityType) {
      if (!VALID_ENTITY_TYPES.includes(entityType)) {
        return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 });
      }
      where.entityType = entityType;
    }
    if (entityId) where.entityId = entityId;

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          activityType: true,
          description: true,
          metadata: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
        },
      }),
      prisma.activity.count({ where }),
    ]);

    return NextResponse.json({ activities, total, page, limit });
  } catch (error) {
    console.error('Activities list error:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}

// POST /api/activities - Create activity
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
    const { activityType, description, metadata, entityType, entityId } = body;

    if (!activityType || !description) {
      return NextResponse.json({ error: 'activityType and description are required' }, { status: 400 });
    }

    if (typeof description !== 'string' || description.length > 5000) {
      return NextResponse.json({ error: 'description must be a string under 5000 chars' }, { status: 400 });
    }

    if (metadata && JSON.stringify(metadata).length > 10000) {
      return NextResponse.json({ error: 'metadata too large' }, { status: 400 });
    }

    if (!VALID_ACTIVITY_TYPES.includes(activityType)) {
      return NextResponse.json({ error: 'Invalid activityType' }, { status: 400 });
    }

    if (entityType && !VALID_ENTITY_TYPES.includes(entityType)) {
      return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 });
    }

    const activity = await prisma.activity.create({
      data: {
        activityType,
        description,
        metadata: metadata ?? undefined,
        entityType: entityType ?? undefined,
        entityId: entityId ?? undefined,
        userId: session.user.id,
      },
      select: {
        id: true,
        activityType: true,
        description: true,
        metadata: true,
        entityType: true,
        entityId: true,
        createdAt: true,
      },
    });

    // Auto-advance lead stage when a call is logged
    if (activityType === 'call' && entityType === 'lead' && entityId && metadata?.callOutcome) {
      try {
        const callOutcome = metadata.callOutcome as string;
        const currentLead = await prisma.lead.findUnique({
          where: { id: entityId },
          select: { stage: true },
        });

        if (currentLead) {
          const STAGE_ORDER = ['new_lead', 'cold_call', 'follow_up_sequence', 'meeting_scheduled', 'meeting_attended', 'quote_delivered'];
          const stageRank = (s: string) => { const i = STAGE_ORDER.indexOf(s); return i === -1 ? 999 : i; };
          const currentRank = stageRank(currentLead.stage);

          let newStage: string | null = null;

          if (callOutcome === 'not_interested') {
            // Terminal — remove from queue entirely
            newStage = 'foad';
          } else if (callOutcome === 'site_visit_booked') {
            // Interested in a visit — move to follow_up_sequence until Nick confirms and books it
            if (currentRank < stageRank('follow_up_sequence')) {
              newStage = 'follow_up_sequence';
            }
          } else if (callOutcome === 'answered' || callOutcome === 'callback_needed') {
            // Spoken to or scheduled — advance to follow_up if not already further along
            if (currentRank < stageRank('follow_up_sequence')) {
              newStage = 'follow_up_sequence';
            }
          } else if (['no_answer', 'voicemail', 'gatekeeper'].includes(callOutcome)) {
            // Attempted but didn't reach DM — advance from new_lead to cold_call minimum
            if (currentLead.stage === 'new_lead') {
              newStage = 'cold_call';
            }
          }

          if (newStage) {
            await prisma.lead.update({
              where: { id: entityId },
              data: { stage: newStage as never, stageChangedAt: new Date() },
            });
          }
        }
      } catch (e) {
        // Don't fail the activity creation if stage update errors
        console.error('Stage advancement error:', e);
      }

      // Site visit requested: create a task for Nick + push Nelson and Nick
      if (metadata?.callOutcome === 'site_visit_booked') {
        createSiteVisitTask(
          entityId,
          session.user.id,
          metadata.visitCallbackTime as string | undefined,
        ).catch(err => console.error('Site visit task creation failed:', err));
      }
    }

    // If it's a call activity with a callSid, fetch the recording from Twilio now.
    // The recording webhook fires before this activity exists, so we can't rely on it.
    // Pulling directly from the Twilio API at log-time is reliable.
    if (activityType === 'call' && metadata?.callSid) {
      attachRecordingAsync(activity.id, metadata.callSid as string).catch(err => {
        console.error('Recording attach error:', err);
      });
    }

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error('Activity create error:', error);
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
  }
}

// Fetches the recording for a completed call from Twilio and attaches it to the activity.
// Runs async after the activity is created so the API response isn't delayed.
async function attachRecordingAsync(activityId: string, callSid: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return;

  const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  // Twilio recordings may take a few seconds to be ready — retry up to 5× with 3s gaps
  let recordings: Array<{ sid: string; duration: string }> = [];
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 3000));

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}/Recordings.json`,
      { headers: { Authorization: authHeader } },
    );
    if (!res.ok) {
      console.warn(`Twilio recordings fetch attempt ${attempt + 1} failed:`, res.status);
      continue;
    }
    const data = await res.json() as { recordings: Array<{ sid: string; duration: string }> };
    if (data.recordings?.length > 0) {
      recordings = data.recordings;
      break;
    }
  }

  if (recordings.length === 0) {
    console.warn('attachRecording: no recordings found for callSid', callSid);
    return;
  }

  const rec = recordings[0];
  const playbackUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${rec.sid}.mp3`;

  const latest = await prisma.activity.findUnique({ where: { id: activityId }, select: { metadata: true } });
  const latestMeta = (latest?.metadata as Record<string, unknown>) ?? {};

  await prisma.activity.update({
    where: { id: activityId },
    data: {
      metadata: {
        ...latestMeta,
        recordingUrl: playbackUrl,
        recordingSid: rec.sid,
        recordingDuration: parseInt(rec.duration) || null,
      },
    },
  });

  // Transcribe with ElevenLabs if key is available
  const elKey = process.env.ELEVENLABS_API_KEY;
  if (elKey) {
    transcribeRecording(activityId, playbackUrl, authHeader, elKey).catch(err => {
      console.error('ElevenLabs transcription failed:', err);
    });
  }
}

async function transcribeRecording(
  activityId: string,
  audioUrl: string,
  twilioAuthHeader: string,
  elKey: string,
): Promise<void> {
  const audioRes = await fetch(audioUrl, { headers: { Authorization: twilioAuthHeader } });
  if (!audioRes.ok) throw new Error(`Failed to download recording: ${audioRes.status}`);
  const audioBuffer = await audioRes.arrayBuffer();

  const form = new FormData();
  form.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'recording.mp3');
  form.append('model_id', 'scribe_v1');
  form.append('language_code', 'en');
  form.append('diarize', 'false');

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': elKey },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs STT error ${res.status}: ${err}`);
  }

  const data = await res.json() as { text?: string };
  const transcriptText = data.text?.trim() || '';
  if (!transcriptText) return;

  const latest = await prisma.activity.findUnique({ where: { id: activityId }, select: { metadata: true } });
  const latestMeta = (latest?.metadata as Record<string, unknown>) ?? {};

  await prisma.activity.update({
    where: { id: activityId },
    data: { metadata: { ...latestMeta, transcriptText, transcriptStatus: 'completed' } },
  });

}

// Creates a task assigned to Nick (sales user) when the VA flags a site visit request.
// Also fires a push notification to all admin + sales users.
async function createSiteVisitTask(
  leadId: string,
  actorUserId: string,
  callbackTime: string | undefined,
): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { companyName: true, contactName: true, phone: true },
  });
  if (!lead) return;

  // Find Nick (sales role)
  const nick = await prisma.user.findFirst({
    where: { role: 'sales' },
    select: { id: true, name: true },
  });
  const owner = nick ?? await prisma.user.findFirst({
    where: { role: 'admin' },
    select: { id: true, name: true },
  });
  if (!owner) return;

  const callbackNote = callbackTime ? ` Best time to call: ${callbackTime}.` : '';
  const taskTitle = `Call ${lead.companyName} to arrange site visit`;
  const notes = `Lead expressed interest in a site visit during cold call.${callbackNote}\n\nContact: ${lead.contactName}${lead.phone ? ` · ${lead.phone}` : ''}\n\nLead: ${process.env.NEXTAUTH_URL}/dashboard/leads/${leadId}`;

  // Due tomorrow at 9am
  const dueTomorrow = new Date();
  dueTomorrow.setDate(dueTomorrow.getDate() + 1);
  dueTomorrow.setHours(9, 0, 0, 0);

  await prisma.task.create({
    data: {
      subject: taskTitle,
      description: notes,
      status: 'not_started',
      priority: 'high',
      dueDate: dueTomorrow,
      ownerId: owner.id,
      linkedLeadId: leadId,
    },
  });

  // Push notification to Nelson + Nick
  sendPushToAdminAndSales({
    title: 'Site Visit Requested',
    body: `${lead.companyName}${callbackTime ? ` — best time: ${callbackTime}` : ''}`,
    icon: '/icon-192.png',
    url: `/dashboard/leads/${leadId}`,
    tag: `site-visit-req-${leadId}`,
  }).catch(err => console.error('Site visit push failed:', err));
}
