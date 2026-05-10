import { prisma } from '@/lib/db';

const FIREFLIES_API_URL = 'https://api.fireflies.ai/graphql';

interface FirefliesTranscriptRaw {
  id: string;
  title: string;
  date: number; // unix ms
  participants: string[];
  summary?: { overview?: string };
  sentences?: { text: string; speaker_name: string }[];
}

async function firefliesRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const apiKey = process.env.FIREFLIES_API_KEY;
  if (!apiKey) {
    throw new Error('FIREFLIES_API_KEY is not configured');
  }

  const res = await fetch(FIREFLIES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Fireflies API error: ${res.status}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Fireflies GraphQL error: ${json.errors[0].message}`);
  }

  return json.data;
}

/**
 * Fetch recent transcripts from Fireflies API.
 */
export async function fetchRecentTranscripts(since?: Date): Promise<FirefliesTranscriptRaw[]> {
  const query = `
    query RecentTranscripts($limit: Int) {
      transcripts(limit: $limit, mine: true) {
        id
        title
        date
        participants
        summary {
          overview
        }
      }
    }
  `;

  const data = await firefliesRequest<{ transcripts: FirefliesTranscriptRaw[] }>(query, {
    limit: 50,
  });

  const transcripts = data.transcripts || [];

  if (since) {
    const sinceMs = since.getTime();
    return transcripts.filter((t) => t.date >= sinceMs);
  }

  return transcripts;
}

/**
 * Fetch full transcript detail including summary and sentences.
 */
export async function fetchTranscriptDetail(id: string): Promise<FirefliesTranscriptRaw | null> {
  const query = `
    query TranscriptDetail($id: String!) {
      transcript(id: $id) {
        id
        title
        date
        participants
        summary {
          overview
        }
        sentences {
          text
          speaker_name
        }
      }
    }
  `;

  const data = await firefliesRequest<{ transcript: FirefliesTranscriptRaw | null }>(query, {
    id,
  });

  return data.transcript || null;
}

/**
 * Sync transcripts from Fireflies API into the database.
 * Auto-matches participants to existing Leads, Contacts, and Deals.
 */
export async function syncTranscripts(): Promise<{ synced: number; matched: number }> {
  // Get the most recent transcript date in DB to avoid re-fetching everything
  const latest = await prisma.firefliesTranscript.findFirst({
    orderBy: { date: 'desc' },
    select: { date: true },
  });

  const since = latest?.date ?? undefined;
  const transcripts = await fetchRecentTranscripts(since);

  let synced = 0;
  let matched = 0;

  for (const t of transcripts) {
    const summary = t.summary?.overview ?? null;
    const participants = t.participants ?? [];
    const date = new Date(t.date);

    // Auto-match by participant name/email against Contacts, Leads, Deals
    const matchResult = await autoMatchParticipants(participants);

    // Upsert to avoid race conditions on concurrent syncs
    const result = await prisma.firefliesTranscript.upsert({
      where: { firefliesId: t.id },
      create: {
        firefliesId: t.id,
        title: t.title,
        date,
        summary,
        participants,
        linkedLeadId: matchResult.linkedLeadId,
        linkedDealId: matchResult.linkedDealId,
        linkedContactId: matchResult.linkedContactId,
      },
      update: {
        title: t.title,
        date,
        summary,
        participants,
        // Only set linked IDs if not already set (don't overwrite manual links)
        ...(matchResult.linkedLeadId ? { linkedLeadId: matchResult.linkedLeadId } : {}),
        ...(matchResult.linkedDealId ? { linkedDealId: matchResult.linkedDealId } : {}),
        ...(matchResult.linkedContactId ? { linkedContactId: matchResult.linkedContactId } : {}),
      },
      select: { createdAt: true },
    });

    // Count as synced if just created (createdAt is very recent)
    const justCreated = (Date.now() - result.createdAt.getTime()) < 5000;
    if (justCreated) {
      synced++;
      if (matchResult.linkedLeadId || matchResult.linkedDealId || matchResult.linkedContactId) {
        matched++;
      }
    }
  }

  return { synced, matched };
}

interface MatchResult {
  linkedLeadId: string | null;
  linkedDealId: string | null;
  linkedContactId: string | null;
}

/**
 * Try to match participant names/emails against existing CRM entities.
 */
async function autoMatchParticipants(participants: string[]): Promise<MatchResult> {
  const result: MatchResult = {
    linkedLeadId: null,
    linkedDealId: null,
    linkedContactId: null,
  };

  if (!participants.length) return result;

  // Build search conditions from participant strings (could be names or emails)
  const orConditions = participants.flatMap((p) => {
    const trimmed = p.trim().toLowerCase();
    if (!trimmed) return [];
    return [
      { email: { equals: trimmed, mode: 'insensitive' as const } },
      { firstName: { equals: trimmed, mode: 'insensitive' as const } },
      { lastName: { equals: trimmed, mode: 'insensitive' as const } },
    ];
  });

  if (orConditions.length === 0) return result;

  // Match Contact
  const contact = await prisma.contact.findFirst({
    where: {
      deletedAt: null,
      OR: orConditions,
    },
    select: { id: true },
  });

  if (contact) {
    result.linkedContactId = contact.id;
  }

  // Match Lead by contactName or email
  const leadOrConditions = participants.flatMap((p) => {
    const trimmed = p.trim().toLowerCase();
    if (!trimmed) return [];
    return [
      { email: { equals: trimmed, mode: 'insensitive' as const } },
      { contactName: { contains: trimmed, mode: 'insensitive' as const } },
      { companyName: { contains: trimmed, mode: 'insensitive' as const } },
    ];
  });

  if (leadOrConditions.length > 0) {
    const lead = await prisma.lead.findFirst({
      where: {
        deletedAt: null,
        OR: leadOrConditions,
      },
      select: { id: true },
    });

    if (lead) {
      result.linkedLeadId = lead.id;
    }
  }

  // Match Deal by name
  const dealOrConditions = participants.flatMap((p) => {
    const trimmed = p.trim().toLowerCase();
    if (!trimmed) return [];
    return [{ name: { contains: trimmed, mode: 'insensitive' as const } }];
  });

  if (dealOrConditions.length > 0) {
    const deal = await prisma.deal.findFirst({
      where: {
        deletedAt: null,
        OR: dealOrConditions,
      },
      select: { id: true },
    });

    if (deal) {
      result.linkedDealId = deal.id;
    }
  }

  return result;
}
