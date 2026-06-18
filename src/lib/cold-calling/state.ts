/**
 * Cold-calling state engine — the single source of truth for where a lead sits
 * in the calling funnel and what happens on each outcome.
 *
 * `resolveOutcome` is PURE and DETERMINISTIC: given a lead's current call state
 * and an outcome (with `now` injected), it returns the next state, the next-due
 * time, the counter changes, and which email (if any) to send. No I/O, no
 * Math.random, no server-local time. This is what makes the "no lead is ever
 * lost" guarantee property-testable.
 */

import { addDays } from './time';

/** The ONE field that decides which queue a lead is in. */
export type LeadCallStatus =
  | 'new' // never called, has phone -> due now
  | 'retry' // attempted, no contact yet -> due at nextCallAt
  | 'callback' // promised callback at a set time -> due at nextCallAt
  | 'nurturing' // info sent (gatekeeper or DM) -> due at nextCallAt
  | 'booked' // site visit booked -> TERMINAL for calling (handed to ops)
  | 'renewal' // contract renewal captured -> due at nextCallAt
  | 'dormant' // exhausted / not-now -> revives at nextCallAt (never lost)
  | 'dead'; // hard no / bad data -> TERMINAL

export const CALLABLE_STATUSES = [
  'new',
  'retry',
  'callback',
  'nurturing',
  'renewal',
  'dormant',
] as const satisfies readonly LeadCallStatus[];

export const TERMINAL_STATUSES = ['booked', 'dead'] as const satisfies readonly LeadCallStatus[];

export function isCallableStatus(s: LeadCallStatus): boolean {
  return (CALLABLE_STATUSES as readonly LeadCallStatus[]).includes(s);
}
export function isTerminalStatus(s: LeadCallStatus): boolean {
  return (TERMINAL_STATUSES as readonly LeadCallStatus[]).includes(s);
}

/**
 * Tunable parameters (research #80 §8). Single source so engine and tests agree.
 */
export const CALL_PARAMS = {
  noAnswerMax: 5,
  voicemailMax: 3,
  gatekeeperMax: 3,
  /** Gap before each no-answer retry, indexed by (attempt-1). 4h, then 1d,2d,3d,5d. */
  noAnswerGapsDays: [0.1667, 1, 2, 3, 5],
  voicemailGapDays: 1,
  nurturingGapDays: 3,
  dormantRevivalDays: 90,
  renewalLeadDays: 7,
} as const;

/** Minimal current state the engine needs (a slice of the Lead row). */
export interface LeadCallState {
  callStatus: LeadCallStatus | null;
  noAnswerAttempts: number;
  voicemailAttempts: number;
  gatekeeperAttempts: number;
  coldCallAttempts: number;
  hasEmail: boolean;
}

export type OutcomeName =
  | 'no_answer'
  | 'voicemail_left'
  | 'gatekeeper'
  | 'callback_booked'
  | 'decision_maker_spoke'
  | 'site_visit_booked'
  | 'contract_renewal_date'
  | 'not_interested'
  | 'not_interested_for_now'
  | 'bad_data';

export interface OutcomeInput {
  outcome: OutcomeName;
  now: Date;
  callbackAt?: Date | null;
  siteVisitAt?: Date | null;
  renewalDate?: Date | null;
  decisionMakerWantsInfo?: boolean;
}

export type OutcomeEmail = 'gatekeeper' | 'callback' | 'send_info' | 'site_visit' | null;

export interface OutcomeDecision {
  callStatus: LeadCallStatus;
  nextCallAt: Date | null;
  /** Absolute new counter values (not deltas). */
  counters: {
    noAnswerAttempts: number;
    voicemailAttempts: number;
    gatekeeperAttempts: number;
    coldCallAttempts: number;
  };
  email: OutcomeEmail;
  /** Set when the input is invalid (e.g. a past callback). Caller returns 400, no writes. */
  error?: string;
}

function baseCounters(lead: LeadCallState): OutcomeDecision['counters'] {
  return {
    noAnswerAttempts: lead.noAnswerAttempts,
    voicemailAttempts: lead.voicemailAttempts,
    gatekeeperAttempts: lead.gatekeeperAttempts,
    // Every logged outcome is one dialled call.
    coldCallAttempts: lead.coldCallAttempts + 1,
  };
}

function invalid(lead: LeadCallState, message: string): OutcomeDecision {
  return {
    callStatus: (lead.callStatus ?? 'new'),
    nextCallAt: null,
    counters: {
      noAnswerAttempts: lead.noAnswerAttempts,
      voicemailAttempts: lead.voicemailAttempts,
      gatekeeperAttempts: lead.gatekeeperAttempts,
      coldCallAttempts: lead.coldCallAttempts, // no increment on invalid input
    },
    email: null,
    error: message,
  };
}

/**
 * The transition table. Pure: same inputs -> same decision, always.
 */
export function resolveOutcome(lead: LeadCallState, input: OutcomeInput): OutcomeDecision {
  const { now } = input;
  const counters = baseCounters(lead);

  switch (input.outcome) {
    case 'no_answer': {
      const attempts = lead.noAnswerAttempts + 1;
      counters.noAnswerAttempts = attempts;
      if (attempts >= CALL_PARAMS.noAnswerMax) {
        return { callStatus: 'dormant', nextCallAt: addDays(now, CALL_PARAMS.dormantRevivalDays), counters, email: null };
      }
      const gap = CALL_PARAMS.noAnswerGapsDays[Math.min(attempts - 1, CALL_PARAMS.noAnswerGapsDays.length - 1)];
      return { callStatus: 'retry', nextCallAt: addDays(now, gap), counters, email: null };
    }

    case 'voicemail_left': {
      const attempts = lead.voicemailAttempts + 1;
      counters.voicemailAttempts = attempts;
      if (attempts >= CALL_PARAMS.voicemailMax) {
        return { callStatus: 'dormant', nextCallAt: addDays(now, CALL_PARAMS.dormantRevivalDays), counters, email: null };
      }
      return { callStatus: 'retry', nextCallAt: addDays(now, CALL_PARAMS.voicemailGapDays), counters, email: null };
    }

    case 'gatekeeper': {
      const attempts = lead.gatekeeperAttempts + 1;
      counters.gatekeeperAttempts = attempts;
      // We send the info to the gatekeeper on every such interaction (if we have an email).
      const email: OutcomeEmail = lead.hasEmail ? 'gatekeeper' : null;
      if (attempts >= CALL_PARAMS.gatekeeperMax) {
        return { callStatus: 'dormant', nextCallAt: addDays(now, CALL_PARAMS.dormantRevivalDays), counters, email };
      }
      return { callStatus: 'nurturing', nextCallAt: addDays(now, CALL_PARAMS.nurturingGapDays), counters, email };
    }

    case 'callback_booked': {
      if (!input.callbackAt) return invalid(lead, 'callbackAt is required for callback_booked');
      if (input.callbackAt.getTime() <= now.getTime()) return invalid(lead, 'callback time must be in the future');
      return {
        callStatus: 'callback',
        nextCallAt: input.callbackAt,
        counters,
        email: lead.hasEmail ? 'callback' : null,
      };
    }

    case 'decision_maker_spoke': {
      return {
        callStatus: 'nurturing',
        nextCallAt: addDays(now, CALL_PARAMS.nurturingGapDays),
        counters,
        email: input.decisionMakerWantsInfo && lead.hasEmail ? 'send_info' : null,
      };
    }

    case 'site_visit_booked': {
      if (!input.siteVisitAt) return invalid(lead, 'siteVisitAt is required for site_visit_booked');
      if (input.siteVisitAt.getTime() <= now.getTime()) return invalid(lead, 'site visit time must be in the future');
      return {
        callStatus: 'booked',
        nextCallAt: null, // terminal for calling — handed to ops
        counters,
        email: lead.hasEmail ? 'site_visit' : null,
      };
    }

    case 'contract_renewal_date': {
      if (!input.renewalDate) return invalid(lead, 'renewalDate is required for contract_renewal_date');
      if (input.renewalDate.getTime() <= now.getTime()) return invalid(lead, 'renewal date must be in the future');
      return {
        callStatus: 'renewal',
        nextCallAt: addDays(input.renewalDate, -CALL_PARAMS.renewalLeadDays),
        counters,
        email: null,
      };
    }

    case 'not_interested':
      return { callStatus: 'dead', nextCallAt: null, counters, email: null };

    case 'not_interested_for_now':
      return { callStatus: 'dormant', nextCallAt: addDays(now, CALL_PARAMS.dormantRevivalDays), counters, email: null };

    case 'bad_data':
      return { callStatus: 'dead', nextCallAt: null, counters, email: null };

    default: {
      // Exhaustiveness guard — a new outcome must be handled explicitly.
      const _never: never = input.outcome;
      return invalid(lead, `unhandled outcome: ${String(_never)}`);
    }
  }
}
