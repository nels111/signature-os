/**
 * Cold Calling — shared TypeScript types
 * Single source of truth for the entire module.
 */

// ── Enums (mirrored from Prisma) ─────────────────────────────────────────────

export type ColdCallOutcome =
  | 'no_answer'
  | 'voicemail_left'
  | 'gatekeeper'
  | 'callback_booked'
  | 'decision_maker_spoke'
  | 'site_visit_booked'
  | 'contract_renewal_date'
  | 'not_interested'
  | 'bad_data';

export type QueueType = 'callback' | 'fresh' | 'follow_up' | 'recycle' | 'dormant';

export type DecisionMakerSubOutcome = 'send_info' | 'follow_up_1_week' | 'follow_up_1_month';

export type NotInterestedReason =
  | 'happy_with_supplier'
  | 'in_house_team'
  | 'no_budget'
  | 'not_responsible'
  | 'never_outsource'
  | 'other';

export type DiallerState =
  | 'loading'
  | 'ready'
  | 'dialling'
  | 'ringing'
  | 'in_call'
  | 'ended'
  | 'saving_outcome'
  | 'advancing'
  | 'error';

// ── Lead shape returned by queue queries ─────────────────────────────────────

export interface ColdCallingLead {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  stage: string;
  queueType: QueueType | null;
  nextCallAt: string | null;
  lastCalledAt: string | null;
  firstCalledAt: string | null;
  coldCallAttempts: number;
  noAnswerAttempts: number;
  voicemailAttempts: number;
  gatekeeperAttempts: number;
  isCallable: boolean;
  dormantUntil: string | null;
  decisionMakerName: string | null;
  decisionMakerTitle: string | null;
  directNumber: string | null;
  bestTimeToCall: string | null;
  gatekeeperName: string | null;
  currentSupplier: string | null;
  contractRenewalDate: string | null;
  estimatedSiteSize: string | null;
  coldCallNotes: string | null;
  siteVisitAt: string | null;
  siteVisitAddress: string | null;
  siteVisitContact: string | null;
  recentAttempts: ColdCallAttemptSummary[];
}

export interface ColdCallAttemptSummary {
  id: string;
  outcome: ColdCallOutcome | null;
  durationSeconds: number | null;
  notes: string | null;
  createdAt: string;
  userName: string;
}

// ── Queue response shape ─────────────────────────────────────────────────────

export interface QueueResponse {
  activeLead: ColdCallingLead | null;
  queues: {
    callbacks: ColdCallingLead[];
    fresh: ColdCallingLead[];
    followUps: ColdCallingLead[];
    recycle: ColdCallingLead[];
  };
  counts: {
    callbacks: number;
    fresh: number;
    followUps: number;
    recycle: number;
    dormant: number;
  };
}

// ── Outcome payload ──────────────────────────────────────────────────────────

export interface OutcomePayload {
  outcome: ColdCallOutcome;
  notes?: string;

  // Gatekeeper fields
  gatekeeperName?: string;

  // Decision maker fields
  decisionMakerName?: string;
  decisionMakerTitle?: string;
  directNumber?: string;
  email?: string;
  bestTimeToCall?: string;

  // Decision maker sub-outcome
  decisionMakerSubOutcome?: DecisionMakerSubOutcome;

  // Callback
  callbackAt?: string; // ISO datetime

  // Site visit
  siteVisitAt?: string; // ISO datetime
  siteVisitAddress?: string;
  siteVisitContact?: string;

  // Contract renewal
  contractRenewalDate?: string; // ISO datetime
  currentSupplier?: string;

  // Not interested
  notInterestedReason?: NotInterestedReason;

  // Additional
  estimatedSiteSize?: string;
}

// ── Stats shape ──────────────────────────────────────────────────────────────

export interface ColdCallingStats {
  callsMade: number;
  decisionMakerConversations: number;
  callbacksBooked: number;
  siteVisitsBooked: number;
  contractRenewalOpportunities: number;
  outcomes: Record<string, number>;
  callsToday: number;
  callsWeek: number;
  openCallbacks: number;
  queueDepth: {
    callbacks: number;
    fresh: number;
    followUps: number;
    recycle: number;
    dormant: number;
  };
}

// ── Call session state ───────────────────────────────────────────────────────

export interface CallSession {
  state: DiallerState;
  activeLead: ColdCallingLead | null;
  attemptId: string | null;
  twilioCallSid: string | null;
  selectedOutcome: ColdCallOutcome | null;
  startedAt: Date | null;
  endedAt: Date | null;
  durationSeconds: number;
  error?: string;
}
