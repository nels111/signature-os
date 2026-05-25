/**
 * Dual time-clock fetcher for Signature Cleans.
 *
 * Signature Cleans uses two Connecteam time clocks:
 *   6814166  — main operatives (Femi, James, Diana, Kenneth, etc.)
 *   16824311 — Cleanz4U operatives (Maria, Tracey, etc.)
 *
 * Always query both and merge so we never miss hours.
 */

export const CT_CLOCK_MAIN = '6814166';
export const CT_CLOCK_CLEANZ4U = '16824311';
const CT_CLOCKS = [CT_CLOCK_MAIN, CT_CLOCK_CLEANZ4U];

export interface CTShift {
  start?: { timestamp: number };
  end?: { timestamp: number };
  jobId?: string | null;
  clockInTimestamp?: number;
  clockOutTimestamp?: number;
}

export interface CTUserActivity {
  userId: number;
  shifts: CTShift[];
  clockId?: string; // injected by this helper — which clock this user came from
}

/**
 * Fetch time-activities from both Connecteam time clocks and merge by userId.
 * If a userId appears in both clocks, their shifts are combined.
 */
export async function fetchDualClockActivities(
  apiKey: string,
  startDate: string,
  endDate: string,
  limit = 500,
): Promise<CTUserActivity[]> {
  const results = await Promise.allSettled(
    CT_CLOCKS.map(async (clockId) => {
      const url = `https://api.connecteam.com/time-clock/v1/time-clocks/${clockId}/time-activities?startDate=${startDate}&endDate=${endDate}&limit=${limit}`;
      const res = await fetch(url, {
        headers: { 'X-API-KEY': apiKey, 'User-Agent': 'jaz/2.0' },
      });
      if (!res.ok) {
        console.warn(`CT clock ${clockId} returned ${res.status} — skipping`);
        return [];
      }
      const json = await res.json();
      const users: CTUserActivity[] = (json.data?.timeActivitiesByUsers || []).map(
        (u: CTUserActivity) => ({ ...u, clockId }),
      );
      return users;
    }),
  );

  // Merge: combine shifts from both clocks per userId
  const merged = new Map<number, CTUserActivity>();

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const user of result.value) {
      if (merged.has(user.userId)) {
        merged.get(user.userId)!.shifts.push(...(user.shifts || []));
      } else {
        merged.set(user.userId, { ...user, shifts: [...(user.shifts || [])] });
      }
    }
  }

  return Array.from(merged.values());
}

export function loadCTKey(): string {
  const key = process.env.CONNECTEAM_API_KEY;
  if (!key) throw new Error('CONNECTEAM_API_KEY not set');
  return key;
}
