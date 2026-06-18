import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { classify, BUCKET_PRIORITY, type QueueRow } from '@/lib/cold-calling/queue-state';
import { CALLABLE_STATUSES, TERMINAL_STATUSES, isTerminalStatus, type LeadCallStatus } from '@/lib/cold-calling/state';
import { isDue } from '@/lib/cold-calling/time';

const ALL_STATUSES: LeadCallStatus[] = [...CALLABLE_STATUSES, ...TERMINAL_STATUSES];

describe('property: a lead is in at most one queue, always a due one', () => {
  test('classify returns null or exactly one valid bucket; terminal always null; result always due', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_STATUSES),
        fc.option(fc.date({ min: new Date('2026-01-01'), max: new Date('2027-01-01') }), { nil: null }),
        fc.date({ min: new Date('2026-01-01'), max: new Date('2027-01-01') }),
        (callStatus, nextCallAt, now) => {
          const row: QueueRow = { id: 'r', callStatus, nextCallAt };
          const bucket = classify(row, now);

          if (isTerminalStatus(callStatus)) {
            expect(bucket).toBeNull();
            return;
          }
          if (bucket === null) {
            // The only reason a callable lead is unclassified is that it isn't due yet.
            expect(isDue(nextCallAt, now)).toBe(false);
          } else {
            // Exactly one known bucket, and it must be currently due.
            expect(BUCKET_PRIORITY).toContain(bucket);
            expect(isDue(nextCallAt, now)).toBe(true);
            // bucket name mirrors the callStatus
            expect(bucket).toBe(callStatus);
          }
        },
      ),
      { numRuns: 1000 },
    );
  });
});
