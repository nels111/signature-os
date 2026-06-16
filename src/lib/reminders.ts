/**
 * Shared reminder/alert logic for calendar events and tasks.
 *
 * Storage shape (both Task.reminder and CalendarEvent.alerts are Json?):
 *   - null                       -> field never set. Events fall back to the
 *                                   legacy 30-min default so pre-feature events
 *                                   keep getting a heads-up. Tasks get nothing
 *                                   (they still receive the daily due/overdue digest).
 *   - { minutesBefore: number }  -> fire a single reminder N minutes before the
 *                                   event start / task due date (0 = at the time).
 *   - { minutesBefore: null }    -> user explicitly chose "No reminder" -> skip.
 *
 * A single offset (not an array) is intentional: it keeps the scheduler dedup
 * trivial (one fire per entity) and matches how a reminder is actually set in
 * the UI. The window/offset model mirrors event_reminder so tasks and events
 * behave identically.
 */

/** Maximum supported lead time. Bounds the scheduler's candidate fetch. */
export const MAX_REMINDER_MINUTES = 1440; // 1 day

/** Legacy default applied to events whose alerts field was never set. */
export const LEGACY_EVENT_DEFAULT_MINUTES = 30;

export interface ReminderOffsetResult {
  /** 'default' = use caller's fallback; 'none' = skip; number = minutes before. */
  kind: 'default' | 'none' | 'set';
  minutesBefore: number | null;
}

/**
 * Options offered in the form pickers. Value is minutes before; null = no reminder.
 */
export const REMINDER_PRESETS: Array<{ value: number | null; label: string; atLabel?: string }> = [
  { value: null, label: 'No reminder' },
  { value: 0, label: 'At time of event', atLabel: 'When due' },
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
];

/**
 * Parse a stored reminder/alerts JSON value into a normalized result.
 * Defensive: tolerates legacy/garbage shapes without throwing.
 */
export function parseReminder(raw: unknown): ReminderOffsetResult {
  if (raw === null || raw === undefined) {
    return { kind: 'default', minutesBefore: null };
  }
  if (typeof raw !== 'object') {
    return { kind: 'default', minutesBefore: null };
  }
  const obj = raw as Record<string, unknown>;
  if (!('minutesBefore' in obj)) {
    return { kind: 'default', minutesBefore: null };
  }
  const v = obj.minutesBefore;
  if (v === null) {
    return { kind: 'none', minutesBefore: null };
  }
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
    const clamped = Math.min(Math.round(v), MAX_REMINDER_MINUTES);
    return { kind: 'set', minutesBefore: clamped };
  }
  // Unrecognized -> treat as default so we never silently drop a heads-up.
  return { kind: 'default', minutesBefore: null };
}

/**
 * Resolve the effective lead time in minutes, or null to skip entirely.
 *
 * @param raw           stored JSON
 * @param defaultMinutes fallback applied when the field was never set
 *                       (events pass LEGACY_EVENT_DEFAULT_MINUTES; tasks pass null)
 */
export function effectiveReminderMinutes(raw: unknown, defaultMinutes: number | null): number | null {
  const parsed = parseReminder(raw);
  if (parsed.kind === 'none') return null;
  if (parsed.kind === 'set') return parsed.minutesBefore;
  // kind === 'default'
  return defaultMinutes;
}

/**
 * Does a reminder for an event/task occurring at `targetTime` with the given
 * `minutesBefore` lead time fire within the window [windowStart, windowEnd]?
 *
 * notifyTime = targetTime - minutesBefore. True when notifyTime is in the window.
 */
export function reminderFiresInWindow(
  targetTime: Date,
  minutesBefore: number,
  windowStart: Date,
  windowEnd: Date,
): boolean {
  const notifyMs = targetTime.getTime() - minutesBefore * 60_000;
  return notifyMs >= windowStart.getTime() && notifyMs <= windowEnd.getTime();
}

/** Human label for a lead time, used in notification copy. */
export function reminderLeadLabel(minutesBefore: number, due = false): string {
  if (minutesBefore <= 0) return due ? 'now due' : 'starting now';
  if (minutesBefore < 60) return `in ${minutesBefore} min`;
  if (minutesBefore < 1440) {
    const h = Math.round(minutesBefore / 60);
    return `in ${h} hour${h === 1 ? '' : 's'}`;
  }
  const d = Math.round(minutesBefore / 1440);
  return `in ${d} day${d === 1 ? '' : 's'}`;
}
