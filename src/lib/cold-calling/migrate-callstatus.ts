/**
 * Pure mapping from the legacy lead shape (stage / queueType / dates / counters)
 * to the v2 `callStatus` + `nextCallAt`. Used by the one-time backfill.
 *
 * Guarantees, enforced by tests:
 *  - every input row maps to exactly one valid LeadCallStatus (never null/lost);
 *  - terminal statuses (booked/dead) always get nextCallAt = null;
 *  - callable non-`new` statuses always get a concrete nextCallAt (never invisible).
 *
 * Pure: `now` is injected. No I/O.
 */

import { addDays } from './time';
import { CALL_PARAMS, type LeadCallStatus } from './state';

export interface LegacyLeadRow {
  stage: string;
  queueType: string | null;
  firstCalledAt: Date | null;
  nextCallAt: Date | null;
  siteVisitAt: Date | null;
  dormantUntil: Date | null;
  phone: string | null;
  noAnswerAttempts: number;
  voicemailAttempts: number;
  gatekeeperAttempts: number;
}

export interface MappedState {
  callStatus: LeadCallStatus;
  nextCallAt: Date | null;
  /** True when no specific rule matched and we defaulted to `new` (logged by the backfill). */
  fellThrough?: boolean;
}

// Legacy LeadStage values grouped by destination.
const DEAD_STAGES = new Set(['bad_data', 'archived', 'foad']);
const BOOKED_STAGES = new Set([
  'meeting_scheduled',
  'meeting_attended',
  'quote_delivered',
  'negotiating',
  'won',
]);
const NURTURING_STAGES = new Set(['contacted', 'follow_up_sequence']);

function hasPhone(row: LegacyLeadRow): boolean {
  return row.phone != null && row.phone.trim() !== '';
}

function exhausted(row: LegacyLeadRow): boolean {
  return (
    row.noAnswerAttempts >= CALL_PARAMS.noAnswerMax ||
    row.voicemailAttempts >= CALL_PARAMS.voicemailMax ||
    row.gatekeeperAttempts >= CALL_PARAMS.gatekeeperMax
  );
}

/** Pick a concrete due time for a callable (non-new) lead; never null. */
function dueOrNow(row: LegacyLeadRow, now: Date): Date {
  return row.nextCallAt ?? now;
}

export function mapLegacyToCallStatus(row: LegacyLeadRow, now: Date): MappedState {
  // 1. Terminal: dead (hard no / bad data).
  if (DEAD_STAGES.has(row.stage)) {
    return { callStatus: 'dead', nextCallAt: null };
  }

  // 2. Terminal for calling: booked / won / further down the pipeline, or a
  //    site visit on record. Handed to ops, out of the calling queue.
  if (BOOKED_STAGES.has(row.stage) || row.siteVisitAt != null) {
    return { callStatus: 'booked', nextCallAt: null };
  }

  // 3. Contract renewal watch.
  if (row.stage === 'contact_when_contract_up') {
    return { callStatus: 'renewal', nextCallAt: dueOrNow(row, now) };
  }

  // 4. Dormant: explicit dormant stage, a parked revival date, or "not now".
  if (row.stage === 'dormant' || row.dormantUntil != null || row.stage === 'not_interested_for_now') {
    return {
      callStatus: 'dormant',
      nextCallAt: row.dormantUntil ?? row.nextCallAt ?? addDays(now, CALL_PARAMS.dormantRevivalDays),
    };
  }

  // 5. Warm: contacted / in a follow-up sequence.
  if (NURTURING_STAGES.has(row.stage) || row.queueType === 'follow_up') {
    return { callStatus: 'nurturing', nextCallAt: dueOrNow(row, now) };
  }

  // 6. Never called yet -> fresh. (Phoneless leads still map to `new`; the queue
  //    query excludes them via its phone filter, so they never wrongly surface.)
  if (row.firstCalledAt == null) {
    return { callStatus: 'new', nextCallAt: null };
  }

  // 7. Has been called and is still in motion (cold_call/new_lead/recycle).
  if (exhausted(row)) {
    return {
      callStatus: 'dormant',
      nextCallAt: row.nextCallAt ?? addDays(now, CALL_PARAMS.dormantRevivalDays),
    };
  }
  return { callStatus: 'retry', nextCallAt: dueOrNow(row, now) };

  // (No path returns null — rule 6/7 catch everything callable.)
}
