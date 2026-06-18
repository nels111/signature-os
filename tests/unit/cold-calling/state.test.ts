import { describe, test, expect } from 'vitest';
import { resolveOutcome, CALL_PARAMS, type LeadCallState } from '@/lib/cold-calling/state';

const now = new Date('2026-06-18T12:00:00Z');
const base: LeadCallState = {
  callStatus: 'new',
  noAnswerAttempts: 0,
  voicemailAttempts: 0,
  gatekeeperAttempts: 0,
  coldCallAttempts: 0,
  hasEmail: true,
};
const DAY = 86_400_000;

describe('resolveOutcome — transition table', () => {
  test('no_answer under cap -> retry with first (4h) gap, no email, counters bumped', () => {
    const d = resolveOutcome({ ...base }, { outcome: 'no_answer', now });
    expect(d.callStatus).toBe('retry');
    expect(d.counters.noAnswerAttempts).toBe(1);
    expect(d.counters.coldCallAttempts).toBe(1);
    expect(d.email).toBeNull();
    expect(d.nextCallAt!.getTime()).toBe(now.getTime() + Math.round(0.1667 * DAY));
  });

  test('no_answer at cap -> dormant +90d', () => {
    const d = resolveOutcome({ ...base, noAnswerAttempts: CALL_PARAMS.noAnswerMax - 1 }, { outcome: 'no_answer', now });
    expect(d.callStatus).toBe('dormant');
    expect(d.nextCallAt!.getTime()).toBe(now.getTime() + 90 * DAY);
  });

  test('voicemail under cap -> retry +1d', () => {
    const d = resolveOutcome({ ...base }, { outcome: 'voicemail_left', now });
    expect(d.callStatus).toBe('retry');
    expect(d.counters.voicemailAttempts).toBe(1);
    expect(d.nextCallAt!.getTime()).toBe(now.getTime() + DAY);
  });

  test('voicemail at cap -> dormant +90d', () => {
    const d = resolveOutcome({ ...base, voicemailAttempts: CALL_PARAMS.voicemailMax - 1 }, { outcome: 'voicemail_left', now });
    expect(d.callStatus).toBe('dormant');
    expect(d.nextCallAt!.getTime()).toBe(now.getTime() + 90 * DAY);
  });

  test('gatekeeper under cap -> nurturing +3d + gatekeeper email', () => {
    const d = resolveOutcome({ ...base }, { outcome: 'gatekeeper', now });
    expect(d.callStatus).toBe('nurturing');
    expect(d.email).toBe('gatekeeper');
    expect(d.nextCallAt!.getTime()).toBe(now.getTime() + 3 * DAY);
  });

  test('gatekeeper at cap -> dormant, still sends gatekeeper email if lead has email', () => {
    const d = resolveOutcome({ ...base, gatekeeperAttempts: CALL_PARAMS.gatekeeperMax - 1 }, { outcome: 'gatekeeper', now });
    expect(d.callStatus).toBe('dormant');
    expect(d.email).toBe('gatekeeper');
  });

  test('gatekeeper with no email on lead -> no email side effect', () => {
    const d = resolveOutcome({ ...base, hasEmail: false }, { outcome: 'gatekeeper', now });
    expect(d.email).toBeNull();
  });

  test('callback_booked future -> callback at that time + callback email', () => {
    const at = new Date('2026-06-20T09:00:00Z');
    const d = resolveOutcome({ ...base }, { outcome: 'callback_booked', now, callbackAt: at });
    expect(d.callStatus).toBe('callback');
    expect(d.nextCallAt!.toISOString()).toBe(at.toISOString());
    expect(d.email).toBe('callback');
  });

  test('callback_booked in the past -> error, no state change, no counter bump', () => {
    const at = new Date('2026-06-17T09:00:00Z');
    const d = resolveOutcome({ ...base }, { outcome: 'callback_booked', now, callbackAt: at });
    expect(d.error).toBeTruthy();
    expect(d.counters.coldCallAttempts).toBe(0);
  });

  test('callback_booked missing time -> error', () => {
    const d = resolveOutcome({ ...base }, { outcome: 'callback_booked', now });
    expect(d.error).toBeTruthy();
  });

  test('decision_maker wants info -> nurturing +3d + send_info email', () => {
    const d = resolveOutcome({ ...base }, { outcome: 'decision_maker_spoke', now, decisionMakerWantsInfo: true });
    expect(d.callStatus).toBe('nurturing');
    expect(d.email).toBe('send_info');
    expect(d.nextCallAt!.getTime()).toBe(now.getTime() + 3 * DAY);
  });

  test('decision_maker no-info -> nurturing, no email', () => {
    const d = resolveOutcome({ ...base }, { outcome: 'decision_maker_spoke', now, decisionMakerWantsInfo: false });
    expect(d.callStatus).toBe('nurturing');
    expect(d.email).toBeNull();
  });

  test('site_visit future -> booked (terminal), site_visit email, nextCallAt null', () => {
    const d = resolveOutcome({ ...base }, { outcome: 'site_visit_booked', now, siteVisitAt: new Date('2026-06-25T10:00:00Z') });
    expect(d.callStatus).toBe('booked');
    expect(d.nextCallAt).toBeNull();
    expect(d.email).toBe('site_visit');
  });

  test('site_visit in the past -> error', () => {
    const d = resolveOutcome({ ...base }, { outcome: 'site_visit_booked', now, siteVisitAt: new Date('2026-06-01T10:00:00Z') });
    expect(d.error).toBeTruthy();
  });

  test('contract_renewal future -> renewal at renewal-7d, no email', () => {
    const renewal = new Date('2026-09-01T00:00:00Z');
    const d = resolveOutcome({ ...base }, { outcome: 'contract_renewal_date', now, renewalDate: renewal });
    expect(d.callStatus).toBe('renewal');
    expect(d.nextCallAt!.getTime()).toBe(renewal.getTime() - 7 * DAY);
    expect(d.email).toBeNull();
  });

  test('contract_renewal in the past -> error', () => {
    const d = resolveOutcome({ ...base }, { outcome: 'contract_renewal_date', now, renewalDate: new Date('2026-06-01T00:00:00Z') });
    expect(d.error).toBeTruthy();
  });

  test('not_interested -> dead terminal, nextCallAt null', () => {
    const d = resolveOutcome({ ...base }, { outcome: 'not_interested', now });
    expect(d.callStatus).toBe('dead');
    expect(d.nextCallAt).toBeNull();
  });

  test('not_interested_for_now -> dormant +90d (revives)', () => {
    const d = resolveOutcome({ ...base }, { outcome: 'not_interested_for_now', now });
    expect(d.callStatus).toBe('dormant');
    expect(d.nextCallAt!.getTime()).toBe(now.getTime() + 90 * DAY);
  });

  test('bad_data -> dead terminal', () => {
    const d = resolveOutcome({ ...base }, { outcome: 'bad_data', now });
    expect(d.callStatus).toBe('dead');
    expect(d.nextCallAt).toBeNull();
  });
});
