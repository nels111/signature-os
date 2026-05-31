/**
 * Cold Calling — Zod validators for API payloads
 */

import { z } from 'zod';

export const StartCallSchema = z.object({
  leadId: z.string().min(1),
});

export const AttachTwilioSchema = z.object({
  twilioCallSid: z.string().min(1),
  status: z.enum(['ringing', 'in_progress']).optional(),
  startedAt: z.string().datetime().optional(),
});

export const OutcomeSchema = z.object({
  outcome: z.enum([
    'no_answer',
    'voicemail_left',
    'gatekeeper',
    'callback_booked',
    'decision_maker_spoke',
    'site_visit_booked',
    'contract_renewal_date',
    'not_interested',
    'bad_data',
  ]),
  notes: z.string().optional(),

  // Gatekeeper
  gatekeeperName: z.string().optional(),

  // Decision maker
  decisionMakerName: z.string().optional(),
  decisionMakerTitle: z.string().optional(),
  directNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  bestTimeToCall: z.string().optional(),
  decisionMakerSubOutcome: z.enum(['send_info', 'follow_up_1_week', 'follow_up_1_month']).optional(),

  // Callback
  callbackAt: z.string().datetime().optional(),

  // Site visit
  siteVisitAt: z.string().datetime().optional(),
  siteVisitAddress: z.string().optional(),
  siteVisitContact: z.string().optional(),

  // Contract renewal
  contractRenewalDate: z.string().datetime().optional(),
  currentSupplier: z.string().optional(),

  // Not interested
  notInterestedReason: z.enum([
    'happy_with_supplier',
    'in_house_team',
    'no_budget',
    'not_responsible',
    'never_outsource',
    'other',
  ]).optional(),

  estimatedSiteSize: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.outcome === 'callback_booked' && !data.callbackAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'callbackAt is required for callback_booked', path: ['callbackAt'] });
  }
  if (data.outcome === 'site_visit_booked' && !data.siteVisitAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'siteVisitAt is required for site_visit_booked', path: ['siteVisitAt'] });
  }
  if (data.outcome === 'contract_renewal_date' && !data.contractRenewalDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'contractRenewalDate is required for contract_renewal_date', path: ['contractRenewalDate'] });
  }
});

export type OutcomeInput = z.infer<typeof OutcomeSchema>;
