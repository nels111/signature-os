/**
 * Connecteam time-clock reader for Signature Cleans OS.
 *
 * Pulls actual clocked hours from Connecteam Time Activities API.
 * Creds from process.env (loaded by Next.js from /var/www/signature-cleans-os/.env).
 */

interface ClockEntry {
  userId: number;
  startTs: number;
  endTs: number;
  hours: number;
  jobId: string | null;
}

export interface ActualHoursData {
  weeklyActualHours: number;
  clockedShifts: number;
  uniqueOperatives: number;
  entries: ClockEntry[];
  weekStart: string;
  weekEnd: string;
  fetchedAt: string;
}

function loadConnecteamKey(): string {
  const key = process.env.CONNECTEAM_API_KEY;
  if (!key) throw new Error('CONNECTEAM_API_KEY not set in environment');
  return key;
}

export async function fetchActualHours(): Promise<ActualHoursData> {
  const apiKey = loadConnecteamKey();
  const timeClockId = '6814166';

  // This week Mon-Sun (Europe/London)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const startStr = weekStart.toISOString().split('T')[0];
  const endStr = weekEnd.toISOString().split('T')[0];

  const url = `https://api.connecteam.com/time-clock/v1/time-clocks/${timeClockId}/time-activities?startDate=${startStr}&endDate=${endStr}&limit=500`;

  const res = await fetch(url, {
    headers: {
      'X-API-KEY': apiKey,
      'User-Agent': 'jaz/2.0',
    },
  });

  if (!res.ok) {
    throw new Error(`Connecteam API error: ${res.status}`);
  }

  const json = await res.json();
  const users = json.data?.timeActivitiesByUsers || [];

  const entries: ClockEntry[] = [];
  const operativeIds = new Set<number>();

  for (const u of users) {
    const userId = u.userId;
    for (const s of u.shifts || []) {
      const startTs = s.start?.timestamp;
      const endTs = s.end?.timestamp;
      if (startTs && endTs) {
        const hours = (endTs - startTs) / 3600;
        entries.push({
          userId,
          startTs,
          endTs,
          hours,
          jobId: s.jobId || null,
        });
        operativeIds.add(userId);
      }
    }
  }

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);

  return {
    weeklyActualHours: Math.round(totalHours * 10) / 10,
    clockedShifts: entries.length,
    uniqueOperatives: operativeIds.size,
    entries,
    weekStart: startStr,
    weekEnd: endStr,
    fetchedAt: new Date().toISOString(),
  };
}
