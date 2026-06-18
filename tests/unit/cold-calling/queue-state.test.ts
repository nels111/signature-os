import { describe, test, expect } from 'vitest';
import { classify, bucketCounts, nextInQueue, type QueueRow } from '@/lib/cold-calling/queue-state';

const now = new Date('2026-06-18T12:00:00Z');
const past = new Date('2026-06-18T11:00:00Z');
const future = new Date('2026-06-18T13:00:00Z');

describe('queue classify', () => {
  test('terminal statuses never classify', () => {
    expect(classify({ id: 'a', callStatus: 'booked', nextCallAt: null }, now)).toBeNull();
    expect(classify({ id: 'b', callStatus: 'dead', nextCallAt: null }, now)).toBeNull();
  });

  test('a new lead (null nextCallAt) is in the "new" bucket', () => {
    expect(classify({ id: 'c', callStatus: 'new', nextCallAt: null }, now)).toBe('new');
  });

  test('a callback due now is in "callback"; a future callback is not yet due', () => {
    expect(classify({ id: 'd', callStatus: 'callback', nextCallAt: past }, now)).toBe('callback');
    expect(classify({ id: 'e', callStatus: 'callback', nextCallAt: future }, now)).toBeNull();
  });

  test('bucket name equals callStatus for due callable leads', () => {
    for (const s of ['retry', 'nurturing', 'renewal', 'dormant'] as const) {
      expect(classify({ id: s, callStatus: s, nextCallAt: past }, now)).toBe(s);
    }
  });
});

describe('counts derive from the same predicate as the list', () => {
  const rows: QueueRow[] = [
    { id: '1', callStatus: 'new', nextCallAt: null },
    { id: '2', callStatus: 'callback', nextCallAt: past },
    { id: '3', callStatus: 'callback', nextCallAt: future }, // not due
    { id: '4', callStatus: 'retry', nextCallAt: past },
    { id: '5', callStatus: 'booked', nextCallAt: null }, // terminal
    { id: '6', callStatus: 'dead', nextCallAt: null }, // terminal
    { id: '7', callStatus: 'dormant', nextCallAt: past },
  ];

  test('bucketCounts only counts due, non-terminal leads', () => {
    const c = bucketCounts(rows, now);
    expect(c.new).toBe(1);
    expect(c.callback).toBe(1); // the future one excluded
    expect(c.retry).toBe(1);
    expect(c.dormant).toBe(1);
    expect(c.nurturing).toBe(0);
    expect(c.renewal).toBe(0);
  });

  test('nextInQueue picks callback (highest priority) before new', () => {
    const next = nextInQueue(rows, now);
    expect(next?.id).toBe('2');
  });

  test('nextInQueue returns null when nothing is due', () => {
    const noneDue: QueueRow[] = [
      { id: 'x', callStatus: 'callback', nextCallAt: future },
      { id: 'y', callStatus: 'dead', nextCallAt: null },
    ];
    expect(nextInQueue(noneDue, now)).toBeNull();
  });
});
