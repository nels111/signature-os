import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
  resolveOutcome,
  CALLABLE_STATUSES,
  TERMINAL_STATUSES,
  isTerminalStatus,
  type LeadCallState,
  type OutcomeName,
} from '@/lib/cold-calling/state';

const OUTCOMES: OutcomeName[] = [
  'no_answer',
  'voicemail_left',
  'gatekeeper',
  'callback_booked',
  'decision_maker_spoke',
  'site_visit_booked',
  'contract_renewal_date',
  'not_interested',
  'not_interested_for_now',
  'bad_data',
];

const VALID = [...CALLABLE_STATUSES, ...TERMINAL_STATUSES];

describe('property: no lead is ever lost', () => {
  test('any sequence of outcomes leaves the lead in exactly one valid state; callable (non-new) always has a due time; terminal never does', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...OUTCOMES), { maxLength: 40 }), (seq) => {
        const now = new Date('2026-06-18T12:00:00Z');
        let lead: LeadCallState = {
          callStatus: 'new',
          noAnswerAttempts: 0,
          voicemailAttempts: 0,
          gatekeeperAttempts: 0,
          coldCallAttempts: 0,
          hasEmail: true,
        };

        for (const outcome of seq) {
          const d = resolveOutcome(lead, {
            outcome,
            now,
            // always-valid future dates so date-bearing outcomes can apply
            callbackAt: new Date(now.getTime() + 1 * 86_400_000),
            siteVisitAt: new Date(now.getTime() + 5 * 86_400_000),
            renewalDate: new Date(now.getTime() + 60 * 86_400_000),
            decisionMakerWantsInfo: true,
          });

          // Invalid input must never mutate state.
          if (d.error) continue;

          // The lead always lands in exactly one valid status.
          expect(VALID).toContain(d.callStatus);

          if (isTerminalStatus(d.callStatus)) {
            expect(d.nextCallAt).toBeNull();
          } else if (d.callStatus !== 'new') {
            // Every callable non-new lead has a concrete next-due time, so it
            // can never become invisible.
            expect(d.nextCallAt).not.toBeNull();
          }

          lead = {
            ...lead,
            callStatus: d.callStatus,
            noAnswerAttempts: d.counters.noAnswerAttempts,
            voicemailAttempts: d.counters.voicemailAttempts,
            gatekeeperAttempts: d.counters.gatekeeperAttempts,
            coldCallAttempts: d.counters.coldCallAttempts,
          };
        }
      }),
      { numRuns: 1000 },
    );
  });
});
