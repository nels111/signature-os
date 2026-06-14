import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/**
 * GET /api/places/autocomplete?q=<text>
 * Server-side proxy for Google Places Autocomplete (New). Keeps GOOGLE_PLACES_API_KEY
 * off the browser. Auth-gated + rate-limited. Returns { predictions: [{ description, placeId }] }.
 * Used by the calendar Location field for type-ahead place suggestions.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit per user (type-ahead is debounced client-side; this is a backstop)
  const key = `places-ac:${session.user.id}:${getClientIp(request.headers)}`;
  const rl = checkRateLimit(key, RATE_LIMITS.api);
  if (rl.limited) {
    return NextResponse.json({ predictions: [] }, { status: 429 });
  }

  const q = (request.nextUrl.searchParams.get('q') || '').trim();
  if (q.length < 3) {
    return NextResponse.json({ predictions: [] });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('[places/autocomplete] GOOGLE_PLACES_API_KEY not set');
    return NextResponse.json({ predictions: [] }, { status: 503 });
  }

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({ input: q, regionCode: 'GB' }),
      // Don't hang the UI on a slow upstream
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      console.error('[places/autocomplete] upstream', res.status);
      return NextResponse.json({ predictions: [] }, { status: 502 });
    }

    const data = await res.json();
    const predictions = (data.suggestions || [])
      .map((s: { placePrediction?: { text?: { text?: string }; placeId?: string } }) => s.placePrediction)
      .filter(Boolean)
      .map((p: { text?: { text?: string }; placeId?: string }) => ({
        description: p.text?.text ?? '',
        placeId: p.placeId ?? '',
      }))
      .filter((p: { description: string }) => p.description);

    return NextResponse.json({ predictions });
  } catch (err) {
    console.error('[places/autocomplete] error', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ predictions: [] }, { status: 502 });
  }
}
