/**
 * Cold-calling time helpers — pure and deterministic.
 *
 * Day math is duration-based (milliseconds), NOT calendar-field mutation, so it
 * is timezone-agnostic and stable across DST. The previous engine used
 * `Date.setDate()` / `Date.setMonth()` (server-local) which drifted at UK day
 * boundaries. "Today / this week" *bucketing* for stats is a separate concern
 * and lives in stats.ts using an explicit Europe/London formatter.
 *
 * `now` is always injected by the caller so every consumer is testable.
 */

const MS_PER_DAY = 86_400_000;

/** Add `days` (may be fractional, e.g. 0.1667 = 4h) to a date, in pure ms. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + Math.round(days * MS_PER_DAY));
}

/**
 * Is a lead with this `nextCallAt` due to be called at `now`?
 * A null `nextCallAt` means "never scheduled" → due immediately (a brand-new
 * lead). Otherwise due once the scheduled moment has arrived or passed.
 */
export function isDue(nextCallAt: Date | null, now: Date): boolean {
  return nextCallAt === null || nextCallAt.getTime() <= now.getTime();
}
