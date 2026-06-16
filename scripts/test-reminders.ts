/* Lightweight assertion test for src/lib/reminders.ts (no test framework in repo). */
import {
  parseReminder,
  effectiveReminderMinutes,
  reminderFiresInWindow,
  reminderLeadLabel,
  LEGACY_EVENT_DEFAULT_MINUTES,
  MAX_REMINDER_MINUTES,
} from '../src/lib/reminders';

let pass = 0;
let fail = 0;
function eq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; }
  else { fail++; console.error(`FAIL ${msg}\n  expected ${e}\n  got      ${a}`); }
}

// parseReminder
eq(parseReminder(null), { kind: 'default', minutesBefore: null }, 'null -> default');
eq(parseReminder(undefined), { kind: 'default', minutesBefore: null }, 'undefined -> default');
eq(parseReminder({ minutesBefore: null }), { kind: 'none', minutesBefore: null }, 'explicit none');
eq(parseReminder({ minutesBefore: 30 }), { kind: 'set', minutesBefore: 30 }, 'set 30');
eq(parseReminder({ minutesBefore: 0 }), { kind: 'set', minutesBefore: 0 }, 'set 0 (at time)');
eq(parseReminder({ minutesBefore: 99999 }), { kind: 'set', minutesBefore: MAX_REMINDER_MINUTES }, 'clamp to max');
eq(parseReminder({ minutesBefore: -5 }), { kind: 'default', minutesBefore: null }, 'negative -> default');
eq(parseReminder('garbage'), { kind: 'default', minutesBefore: null }, 'string -> default');
eq(parseReminder({}), { kind: 'default', minutesBefore: null }, 'empty obj -> default');

// effectiveReminderMinutes
eq(effectiveReminderMinutes(null, LEGACY_EVENT_DEFAULT_MINUTES), 30, 'event null -> legacy 30');
eq(effectiveReminderMinutes(null, null), null, 'task null -> null (no reminder)');
eq(effectiveReminderMinutes({ minutesBefore: null }, 30), null, 'explicit none -> null');
eq(effectiveReminderMinutes({ minutesBefore: 60 }, 30), 60, 'set 60 overrides default');
eq(effectiveReminderMinutes({ minutesBefore: 0 }, 30), 0, 'set 0 overrides default');

// reminderFiresInWindow
const now = new Date('2026-06-16T12:00:00Z');
const wEnd = new Date('2026-06-16T12:06:00Z'); // 6-min window
// Event at 12:30, 30 min before -> notify at 12:00 -> in [12:00,12:06] YES
eq(reminderFiresInWindow(new Date('2026-06-16T12:30:00Z'), 30, now, wEnd), true, 'fires at window start');
// Event at 12:35, 30 min before -> notify 12:05 -> YES
eq(reminderFiresInWindow(new Date('2026-06-16T12:35:00Z'), 30, now, wEnd), true, 'fires mid-window');
// Event at 12:40, 30 min before -> notify 12:10 -> outside -> NO
eq(reminderFiresInWindow(new Date('2026-06-16T12:40:00Z'), 30, now, wEnd), false, 'too far -> no');
// Event at 12:29, 30 min before -> notify 11:59 -> before window -> NO
eq(reminderFiresInWindow(new Date('2026-06-16T12:29:00Z'), 30, now, wEnd), false, 'already passed -> no');
// 1 day before: event tomorrow 12:03, 1440 before -> notify today 12:03 -> YES
eq(reminderFiresInWindow(new Date('2026-06-17T12:03:00Z'), 1440, now, wEnd), true, '1-day-before fires');
// At time (0): event at 12:04 -> notify 12:04 -> YES
eq(reminderFiresInWindow(new Date('2026-06-16T12:04:00Z'), 0, now, wEnd), true, 'at-time fires');

// reminderLeadLabel
eq(reminderLeadLabel(0), 'starting now', 'label 0 event');
eq(reminderLeadLabel(0, true), 'now due', 'label 0 task');
eq(reminderLeadLabel(10), 'in 10 min', 'label 10');
eq(reminderLeadLabel(60), 'in 1 hour', 'label 60');
eq(reminderLeadLabel(120), 'in 2 hours', 'label 120');
eq(reminderLeadLabel(1440), 'in 1 day', 'label 1440');

console.log(`\nreminders.ts: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
