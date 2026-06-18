import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { mapLegacyToCallStatus, type LegacyLeadRow } from '@/lib/cold-calling/migrate-callstatus';
import {
  CALLABLE_STATUSES,
  TERMINAL_STATUSES,
  isTerminalStatus,
} from '@/lib/cold-calling/state';

const now = new Date('2026-06-18T12:00:00Z');
const DAY = 86_400_000;

function legacy(partial: Partial<LegacyLeadRow>): LegacyLeadRow {
  return {
    stage: 'cold_call',
    queueType: null,
    firstCalledAt: null,
    nextCallAt: null,
    siteVisitAt: null,
    dormantUntil: null,
    phone: '07123456789',
    noAnswerAttempts: 0,
    voicemailAttempts: 0,
    gatekeeperAttempts: 0,
    ...partial,
  };
}

describe('mapLegacyToCallStatus — real legacy stages', () => {
  test('never-called new_lead with phone -> new', () => {
    expect(mapLegacyToCallStatus(legacy({ stage: 'new_lead' }), now)).toEqual({ callStatus: 'new', nextCallAt: null });
  });

  test('never-called cold_call with phone -> new', () => {
    expect(mapLegacyToCallStatus(legacy({ stage: 'cold_call' }), now)).toEqual({ callStatus: 'new', nextCallAt: null });
  });

  test('called cold_call (recycle) -> retry at its nextCallAt', () => {
    const next = new Date(now.getTime() + 5 * DAY);
    const m = mapLegacyToCallStatus(legacy({ stage: 'cold_call', firstCalledAt: now, queueType: 'recycle', nextCallAt: next }), now);
    expect(m.callStatus).toBe('retry');
    expect(m.nextCallAt).toEqual(next);
  });

  test('called cold_call with no nextCallAt -> retry due now (never invisible)', () => {
    const m = mapLegacyToCallStatus(legacy({ stage: 'cold_call', firstCalledAt: now, nextCallAt: null }), now);
    expect(m.callStatus).toBe('retry');
    expect(m.nextCallAt).toEqual(now);
  });

  test('contacted -> nurturing', () => {
    expect(mapLegacyToCallStatus(legacy({ stage: 'contacted', firstCalledAt: now }), now).callStatus).toBe('nurturing');
  });

  test('follow_up_sequence -> nurturing', () => {
    expect(mapLegacyToCallStatus(legacy({ stage: 'follow_up_sequence', firstCalledAt: now }), now).callStatus).toBe('nurturing');
  });

  test('foad -> dead (terminal, nextCallAt null)', () => {
    expect(mapLegacyToCallStatus(legacy({ stage: 'foad' }), now)).toEqual({ callStatus: 'dead', nextCallAt: null });
  });

  test('bad_data -> dead', () => {
    expect(mapLegacyToCallStatus(legacy({ stage: 'bad_data' }), now).callStatus).toBe('dead');
  });

  test('meeting_scheduled -> booked (terminal, nextCallAt null)', () => {
    expect(mapLegacyToCallStatus(legacy({ stage: 'meeting_scheduled', firstCalledAt: now }), now)).toEqual({ callStatus: 'booked', nextCallAt: null });
  });

  test('any stage with a siteVisitAt -> booked', () => {
    expect(mapLegacyToCallStatus(legacy({ stage: 'cold_call', siteVisitAt: now }), now).callStatus).toBe('booked');
  });

  test('contact_when_contract_up -> renewal', () => {
    const next = new Date(now.getTime() + 30 * DAY);
    expect(mapLegacyToCallStatus(legacy({ stage: 'contact_when_contract_up', nextCallAt: next }), now)).toEqual({ callStatus: 'renewal', nextCallAt: next });
  });

  test('dormantUntil set -> dormant at that date', () => {
    const revive = new Date(now.getTime() + 90 * DAY);
    expect(mapLegacyToCallStatus(legacy({ stage: 'cold_call', firstCalledAt: now, dormantUntil: revive }), now)).toEqual({ callStatus: 'dormant', nextCallAt: revive });
  });

  test('not_interested_for_now -> dormant', () => {
    expect(mapLegacyToCallStatus(legacy({ stage: 'not_interested_for_now' }), now).callStatus).toBe('dormant');
  });

  test('exhausted (5 no-answers) called lead -> dormant', () => {
    expect(mapLegacyToCallStatus(legacy({ stage: 'cold_call', firstCalledAt: now, noAnswerAttempts: 5 }), now).callStatus).toBe('dormant');
  });
});

describe('property: every legacy row maps to exactly one valid state, never lost', () => {
  const STAGES = [
    'new_lead', 'contacted', 'meeting_scheduled', 'meeting_attended', 'quote_delivered',
    'negotiating', 'won', 'not_interested_for_now', 'contact_when_contract_up', 'foad',
    'cold_call', 'cold_email', 'linkedin', 'follow_up_sequence', 'dormant', 'bad_data', 'archived',
  ];
  test('valid status; terminal => null nextCallAt; callable non-new => non-null nextCallAt', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STAGES),
        fc.constantFrom(null, 'recycle', 'follow_up', 'callback', 'fresh', 'dormant'),
        fc.option(fc.date({ min: new Date('2026-01-01'), max: new Date('2027-06-01') }), { nil: null }),
        fc.option(fc.date(), { nil: null }), // firstCalledAt
        fc.option(fc.date(), { nil: null }), // siteVisitAt
        fc.option(fc.date(), { nil: null }), // dormantUntil
        fc.option(fc.constantFrom('07123456789', ''), { nil: null }), // phone
        fc.nat({ max: 10 }),
        (stage, queueType, nextCallAt, firstCalledAt, siteVisitAt, dormantUntil, phone, attempts) => {
          const row: LegacyLeadRow = {
            stage, queueType, nextCallAt, firstCalledAt, siteVisitAt, dormantUntil, phone,
            noAnswerAttempts: attempts, voicemailAttempts: attempts, gatekeeperAttempts: attempts,
          };
          const m = mapLegacyToCallStatus(row, now);
          const valid = [...CALLABLE_STATUSES, ...TERMINAL_STATUSES];
          expect(valid).toContain(m.callStatus);
          if (isTerminalStatus(m.callStatus)) {
            expect(m.nextCallAt).toBeNull();
          } else if (m.callStatus !== 'new') {
            expect(m.nextCallAt).not.toBeNull();
          }
        },
      ),
      { numRuns: 2000 },
    );
  });
});
