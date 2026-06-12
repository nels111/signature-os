export const runtime = 'nodejs';

/**
 * POST /api/agent/chat
 *
 * Public website AI agent. GPT-4o with tool calling.
 * Handles visitor conversations: qualifies leads, checks calendar availability,
 * books site visits, creates leads in SigOS, fires WA to Nelson + Nick.
 *
 * Auth: none (public). Rate-limited by IP via middleware.
 * Body: { sessionId?: string, message: string, history?: Message[] }
 * Returns: { reply: string, sessionId: string, action?: string }
 */

import OpenAI from 'openai';
import { prisma } from '@/lib/db';
import { sendTwilioWhatsapp } from '@/lib/twilio-wa';
import { notify } from '@/lib/notifications';
import { sendPushToUser } from '@/lib/push';
import { addDays, format } from 'date-fns';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Nelson's user ID (SigOS owner for new leads)
const NELSON_USER_ID = 'e916185f-2a4f-4e71-a8c1-695cb365912e';
const NICK_USER_ID   = 'a808f34f-39a3-4c67-af83-682bb6c964d5';
const NELSON_WA = '+447901260244';
const NICK_WA = process.env.NICK_WA_NUMBER || '+447890266882';

// ── System prompt ──────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a member of the Signature Cleans team having a real conversation. Not a chatbot. Not an assistant. A person.

Your name is Jaz. You work for Signature Cleans — a commercial cleaning company based in Exeter covering Devon, Cornwall and Somerset. Your job in this conversation is to understand what the person needs, build a bit of rapport, and where it makes sense, get them to book a free site assessment.

THE CONVERSATION FLOW — follow this like a sales script, adapted to the conversation

Stage 1 — Open naturally
When someone reaches out, open with one short warm line and ask ONE question to understand their situation. Never announce what you can do like a menu. Just respond like a human would.
- If they say "hey" or "hi": "Hey! What brings you to Signature Cleans?" or "Hey, what's on your mind?"
- If they ask a direct question, just answer it then follow up with one question.
- NEVER say: "How can I assist you today?" — banned.
- NEVER say: "I'm the operations intelligence and client-facing representative" — sounds like a robot.
- If asked who you are: "I'm Jaz, part of the Signature Cleans team. What can I help with?"

Stage 2 — Understand their situation
Ask ONE follow-up to understand their context. Not all at once. Naturally.
Key things to find out (weave into conversation, don't interview them):
- What type of site? (office, warehouse, school, showroom, healthcare, etc.)
- Are they currently with a cleaning company or is this new?
- If switching: what's the problem with their current cleaner? (this is GOLD — use it)
- Rough size and frequency?

Stage 3 — Position Signature Cleans
Once you understand their situation, connect what you know about SC to their specific pain.
- If they've had bad experiences with cleaning companies (very common): "That's exactly why clients come to us. Every contract we run has a scored audit — you get a report after every visit, so there's no guessing whether the standard's being hit."
- If they care about consistency: "Same people every week. Vetted, DBS checked where needed. Your site manager knows who's walking in."
- If they're a regulated/secure site: "We're SSIP accredited, CQMS verified. The paperwork is up to date and available — some clients need that for compliance."
- Don't list everything at once. Pick the 1-2 things most relevant to what they've said.

Stage 4 — Move toward the site visit
When the moment is right (usually after 3-4 back-and-forths):
"Honestly the best way to give you an accurate picture is a quick site visit — we come to you, take a proper look, and give you a quote that actually means something. Takes about 30 minutes, completely free. What does your diary look like?"
If they push back on time: "Even a call with one of our directors first if that's easier — but the visit is worth it."

Stage 5 — Book it
Once they agree, collect name, company, phone or email, preferred date/time. Then use book_site_visit. Confirm back: "Brilliant. [Name], I've got that booked in for [date/time]. Nelson our MD will be in touch to confirm. You'll hear from us within the hour."

THE COMPANY (know this cold)
Signature Cleans is NOT a generic cleaning company. Key differentiators to use naturally:
- Audit reports after every clean — scored, documented. Most cleaners just show up and leave.
- Same operatives every week — consistency and security
- SSIP, CQMS, PQS accredited. £10M public liability. Real paperwork.
- Regional (Devon/Cornwall/Somerset) — not faceless national
- Director-level response within one working hour
- Tagline: Peace of Mind, Every Time — this is what they're buying, not just cleaning

SERVICES: Contract cleaning (regular), Deep cleaning (one-off intensive), Specialist (builders clean, sparkle clean, floor treatments)

PRICING GUIDE (ranges only — always steer to site visit for accuracy)
Small offices <2k sqft: from ~£250–400/month | Medium 2–10k sqft: £400–1,200/month | Large (schools/warehouses): £1,000–3,000+/month | One-off deep clean: £150–£800+

COVERAGE: Exeter, Plymouth, Taunton, Truro, Barnstaple, Torquay, Newton Abbot, Yeovil, Bridgwater, Exmouth, Teignmouth, Honiton, Tavistock, Totnes, Paignton, Falmouth, Newquay, Penzance, Launceston, and wider Devon/Cornwall/Somerset.

LANGUAGE RULES — READ THESE AND FOLLOW THEM
BANNED phrases (say these and you've failed):
- "How can I assist you today?"
- "Certainly!" / "Absolutely!" / "Of course!"
- "Great question!"
- "I'd be happy to help"
- "As a virtual assistant..."
- "I'm the operations intelligence..." — just say "I'm Jaz, from the Signature Cleans team"
- Bullet-pointing your services at someone who just said hi
- Starting a reply with "I" — vary your openers

WRITE LIKE A PERSON:
- Short messages. Real people don't send essays.
- One question at a time. Never five questions in a row.
- Contractions: "we're", "that's", "you'll" — not "we are", "that is"
- If someone is short with you, be short back. Match their energy.
- If they're frustrated, acknowledge it before pivoting: "Yeah, that's a really common problem..."
- Never repeat back what they just said to you.

HARD RULES
- Never mention hours per visit, headcount, or subcontracting
- If asked about staff: "Vetted, trained, DBS checked where needed. Same faces every week."
- Never commit to a specific price — always ranges + site visit
- If someone's clearly just price-shopping with no real intent: "Are you looking to make a switch, or just benchmarking at this stage?"
- When you don't know something: "Let me get one of the team to follow up on that — what's the best number or email?"
- You are a person. Act like one.`;

// ── Tool definitions ───────────────────────────────────────────────────────────
const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'check_calendar_availability',
      description: 'Check available slots for a site visit in the next 2 weeks. Returns available date/time options.',
      parameters: {
        type: 'object',
        properties: {
          preferred_week: {
            type: 'string',
            description: 'Preferred week as ISO date string (Monday of that week, e.g. "2026-06-15"). If not specified, use next week.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_site_visit',
      description: 'Book a free site assessment. Creates a calendar event in SigOS, creates a lead, and notifies Nelson and Nick.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: "Visitor's full name" },
          company: { type: 'string', description: 'Company name' },
          email: { type: 'string', description: 'Email address (optional if phone provided)' },
          phone: { type: 'string', description: 'Phone number (optional if email provided)' },
          datetime: { type: 'string', description: 'Booking date and time as ISO string, e.g. "2026-06-16T10:00:00"' },
          service_interest: { type: 'string', description: 'Type of service they are interested in' },
          notes: { type: 'string', description: 'Any additional context about their site or requirements' },
        },
        required: ['name', 'company', 'datetime'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_service_coverage',
      description: 'Check if Signature Cleans covers a specific town or postcode area.',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'Town name or postcode to check' },
        },
        required: ['location'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_lead',
      description: 'Create a lead in SigOS for an enquiry that does not result in a booking yet.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          company: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          service_interest: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['name', 'company'],
      },
    },
  },
];

// ── Tool implementations ────────────────────────────────────────────────────────
async function checkCalendarAvailability(preferredWeek?: string): Promise<string> {
  const start = preferredWeek ? new Date(preferredWeek) : addDays(new Date(), 3);
  const end = addDays(start, 14);

  const events = await prisma.calendarEvent.findMany({
    where: {
      startDate: { gte: start, lte: end },
      deletedAt: null,
    },
    select: { startDate: true, endDate: true, title: true },
  });

  // Build busy blocks
  const busyTimes = events.map(e => ({
    start: new Date(e.startDate).getTime(),
    end: new Date(e.endDate).getTime(),
  }));

  // Generate available morning slots (9am–12pm) and afternoon slots (1pm–4pm)
  const slots: string[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);

  for (let d = 0; d < 14 && slots.length < 6; d++) {
    const day = new Date(current);
    day.setDate(current.getDate() + d);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends

    for (const hour of [9, 11, 14]) {
      const slotStart = new Date(day);
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setHours(hour + 1, 30, 0, 0);

      const busy = busyTimes.some(b => slotStart.getTime() < b.end && slotEnd.getTime() > b.start);
      if (!busy) {
        slots.push(format(slotStart, "EEEE d MMMM 'at' h:mm a"));
        if (slots.length >= 6) break;
      }
    }
  }

  if (slots.length === 0) return 'No availability found in the next 2 weeks. Please suggest a specific date and we can check manually.';
  return `Available slots:\n${slots.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
}

async function bookSiteVisit(params: {
  name: string; company: string; email?: string; phone?: string;
  datetime: string; service_interest?: string; notes?: string;
}): Promise<string> {
  const startDate = new Date(params.datetime);
  const endDate = new Date(startDate);
  endDate.setHours(startDate.getHours() + 1, 30);

  // Create calendar event (shared, owned by Nelson — shows on both calendars via invite)
  const event = await prisma.calendarEvent.create({
    data: {
      title: `Site assessment — ${params.company}`,
      startDate,
      endDate,
      notes: ['Contact: ' + params.name, params.email, params.phone, params.notes].filter(Boolean).join(' · '),
      ownerId: NELSON_USER_ID,
      calendarType: 'shared',
      eventType: 'meeting',
      // Add Nick as a participant so it shows on his calendar too
      invites: {
        create: [{ inviteeId: NICK_USER_ID, status: 'accepted' }],
      },
    },
  });

  // Create lead in SigOS
  const lead = await prisma.lead.create({
    data: {
      companyName: params.company,
      contactName: params.name,
      email: params.email || null,
      phone: params.phone || null,
      source: 'website',
      stage: 'meeting_scheduled',
      ownerId: NELSON_USER_ID,
      notes: `Booked via website agent. Service interest: ${params.service_interest || 'TBC'}. ${params.notes || ''}`,
    },
  });

  // Notify Nelson + Nick (SigOS push + in-app)
  const bookingMsg = `${params.company} — ${format(startDate, 'd MMM, h:mm a')}`;
  await notify({ userId: NELSON_USER_ID, type: 'lead_assigned', title: 'Site visit booked via website', message: bookingMsg, entityId: lead.id }).catch(() => {});
  await notify({ userId: NICK_USER_ID,   type: 'lead_assigned', title: 'Site visit booked via website', message: bookingMsg, entityId: lead.id }).catch(() => {});
  await sendPushToUser(NELSON_USER_ID, { title: 'Site visit booked', body: bookingMsg }).catch(() => {});
  await sendPushToUser(NICK_USER_ID,   { title: 'Site visit booked', body: bookingMsg }).catch(() => {});

  // WA to Nelson + Nick
  const waMsg = `🗓 *Site visit booked via website*\n*${params.company}* — ${format(startDate, 'EEEE d MMM, h:mm a')}\nContact: ${params.name}${params.phone ? ` · ${params.phone}` : ''}${params.email ? ` · ${params.email}` : ''}\nService: ${params.service_interest || 'TBC'}`;
  await sendTwilioWhatsapp(NELSON_WA, waMsg).catch(() => {});
  if (NICK_WA) await sendTwilioWhatsapp(NICK_WA, waMsg).catch(() => {});

  return `Confirmed. Site assessment booked for ${format(startDate, "EEEE d MMMM 'at' h:mm a")}. Reference ID: ${event.id.slice(0, 8).toUpperCase()}`;
}

function checkServiceCoverage(location: string): string {
  const covered = ['devon', 'cornwall', 'somerset', 'exeter', 'plymouth', 'taunton', 'truro', 'barnstaple', 'torquay', 'newton abbot', 'yeovil', 'bridgwater', 'teignmouth', 'dawlish', 'exmouth', 'sidmouth', 'honiton', 'okehampton', 'tavistock', 'totnes', 'paignton', 'brixham', 'falmouth', 'newquay', 'penzance', 'camborne', 'redruth', 'bodmin', 'launceston', 'saltash', 'liskeard', 'weston-super-mare', 'bath', 'glastonbury', 'frome', 'shepton mallet', 'chard', 'ilminster', 'ex', 'pl', 'ta', 'tr', 'ba'];
  const loc = location.toLowerCase().trim();
  const isCovered = covered.some(area => loc.includes(area));
  if (isCovered) return `Yes, we cover ${location}. We serve Devon, Cornwall and Somerset.`;
  return `We currently cover Devon, Cornwall and Somerset. ${location} may be outside our current area — drop us a message and we can confirm if we can reach you.`;
}

async function createLead(params: { name: string; company: string; email?: string; phone?: string; service_interest?: string; notes?: string; }): Promise<string> {
  const lead = await prisma.lead.create({
    data: {
      companyName: params.company,
      contactName: params.name,
      email: params.email || null,
      phone: params.phone || null,
      source: 'website',
      stage: 'new_lead',
      ownerId: NELSON_USER_ID,
      notes: `Website agent enquiry. Service: ${params.service_interest || 'TBC'}. ${params.notes || ''}`,
    },
  });

  await notify({ userId: NELSON_USER_ID, type: 'lead_assigned', title: 'New website enquiry', message: `${params.company} via website agent`, entityId: lead.id }).catch(() => {});
  await sendPushToUser(NELSON_USER_ID, { title: 'New enquiry', body: `${params.company} — ${params.name}` }).catch(() => {});

  const waMsg = `💬 *New website enquiry*\n*${params.company}* — ${params.name}${params.phone ? `\n📞 ${params.phone}` : ''}${params.email ? `\n✉️ ${params.email}` : ''}\nService: ${params.service_interest || 'TBC'}`;
  await sendTwilioWhatsapp(NELSON_WA, waMsg).catch(() => {});
  if (NICK_WA) await sendTwilioWhatsapp(NICK_WA, waMsg).catch(() => {});

  return `Noted. Your enquiry has been passed to the Signature Cleans team and someone will be in touch shortly.`;
}

// ── Main handler ────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  // CORS for cross-origin WP requests
  const origin = request.headers.get('origin') || '';
  const headers: HeadersInit = {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  let body: { message?: string; history?: OpenAI.Chat.ChatCompletionMessageParam[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const userMessage = (body.message || '').trim();
  if (!userMessage) return new Response(JSON.stringify({ error: 'message required' }), { status: 400, headers });

  const history: OpenAI.Chat.ChatCompletionMessageParam[] = Array.isArray(body.history) ? body.history.slice(-20) : [];

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userMessage },
  ];

  try {
    // Agentic loop: allow up to 5 tool call rounds
    for (let round = 0; round < 5; round++) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 600,
      });

      const choice = response.choices[0];
      messages.push(choice.message);

      if (choice.finish_reason === 'stop' || !choice.message.tool_calls?.length) {
        return new Response(JSON.stringify({ reply: choice.message.content || '' }), { status: 200, headers });
      }

      // Execute tool calls
      for (const tc of choice.message.tool_calls) {
        let result: string;
        // OpenAI SDK v6: tool_call has .function (ChatCompletionMessageToolCall)
        const fn = (tc as unknown as { function: { name: string; arguments: string } }).function;
        const args = JSON.parse(fn.arguments || '{}');

        switch (fn.name) {
          case 'check_calendar_availability':
            result = await checkCalendarAvailability(args.preferred_week);
            break;
          case 'book_site_visit':
            result = await bookSiteVisit(args);
            break;
          case 'check_service_coverage':
            result = checkServiceCoverage(args.location);
            break;
          case 'create_lead':
            result = await createLead(args);
            break;
          default:
            result = 'Tool not found.';
        }

        messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }
    }

    return new Response(JSON.stringify({ reply: 'Something went wrong. Please try again or call us on 01392 931035.' }), { status: 200, headers });
  } catch (err) {
    console.error('[agent/chat]', err);
    return new Response(JSON.stringify({ reply: 'I\'m having a technical issue right now. Please call us on 01392 931035 or use the contact form.' }), { status: 200, headers });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
