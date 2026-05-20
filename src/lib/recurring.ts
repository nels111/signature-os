/**
 * Shared recurring event expansion logic.
 * Used by both the calendar GET API and the notification scheduler.
 */

export interface RepeatConfig {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  endDate?: string | null;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
export function addMonths(d: Date, n: number): Date {
  const r = new Date(d); r.setMonth(r.getMonth() + n); return r;
}
export function addYears(d: Date, n: number): Date {
  const r = new Date(d); r.setFullYear(r.getFullYear() + n); return r;
}

/**
 * Expands a recurring event into all occurrences that overlap [rangeStart, rangeEnd].
 * Returns a copy of the event for each occurrence with adjusted startDate/endDate.
 * Safety cap: 2000 iterations max.
 */
export function expandRecurringEvent<T extends { id: string; startDate: Date; endDate: Date; repeat: unknown }>(
  event: T,
  rangeStart: Date,
  rangeEnd: Date,
): T[] {
  const cfg = event.repeat as RepeatConfig;
  if (!cfg?.freq) return [];
  const interval = Math.max(1, cfg.interval ?? 1);
  const repeatEnd = cfg.endDate ? new Date(cfg.endDate) : null;
  const duration = event.endDate.getTime() - event.startDate.getTime();
  const results: T[] = [];
  let current = new Date(event.startDate);
  let safety = 0;

  while (safety++ < 2000) {
    if (current > rangeEnd) break;
    if (repeatEnd && current > repeatEnd) break;
    const occEnd = new Date(current.getTime() + duration);
    if (occEnd >= rangeStart) {
      results.push({ ...event, startDate: new Date(current), endDate: occEnd });
    }
    switch (cfg.freq) {
      case 'daily':   current = addDays(current, interval); break;
      case 'weekly':  current = addDays(current, 7 * interval); break;
      case 'monthly': current = addMonths(current, interval); break;
      case 'yearly':  current = addYears(current, interval); break;
      default: return results;
    }
  }
  return results;
}
