import { describe, test, expect } from 'vitest';
import { addDays, isDue } from '@/lib/cold-calling/time';

describe('time helpers', () => {
  test('addDays adds whole days in a TZ-stable (duration) way', () => {
    const base = new Date('2026-06-18T12:00:00.000Z');
    expect(addDays(base, 1).toISOString()).toBe('2026-06-19T12:00:00.000Z');
  });

  test('addDays supports fractional days (4h)', () => {
    const base = new Date('2026-06-18T12:00:00.000Z');
    expect(addDays(base, 0.1667).getTime()).toBe(base.getTime() + Math.round(0.1667 * 86_400_000));
  });

  test('addDays supports negative days (lead time before a date)', () => {
    const base = new Date('2026-09-01T00:00:00.000Z');
    expect(addDays(base, -7).toISOString()).toBe('2026-08-25T00:00:00.000Z');
  });

  test('isDue: null nextCallAt is always due', () => {
    expect(isDue(null, new Date())).toBe(true);
  });

  test('isDue: past is due, exact now is due, future is not', () => {
    const now = new Date('2026-06-18T12:00:00Z');
    expect(isDue(new Date('2026-06-18T11:00:00Z'), now)).toBe(true);
    expect(isDue(new Date('2026-06-18T12:00:00Z'), now)).toBe(true);
    expect(isDue(new Date('2026-06-18T13:00:00Z'), now)).toBe(false);
  });
});
