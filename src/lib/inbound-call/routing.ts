/**
 * Pure smart-routing logic for inbound answering-service calls.
 *
 * Nelson's rule (verbatim intent): an inbound call is NOT a cold-calling-queue
 * entry. If we already know the number/email (existing lead, client, or
 * contact) we FLAG it only — never create a duplicate lead. Only a genuinely
 * new enquiry creates a Lead in the LEADS module.
 *
 * This module is the pure decision + phone-normalisation core; the DB lookups
 * live in the route handler.
 */

export type InboundRoute =
  | 'existing_lead'
  | 'existing_client'
  | 'existing_contact'
  | 'new_enquiry';

export interface MatchFlags {
  leadId?: string | null;
  clientAccountId?: string | null;
  contactId?: string | null;
}

/**
 * Decide what to do with an inbound caller given which existing records matched.
 * Priority: an existing lead wins (avoid dup leads — the explicit instruction),
 * then a known client, then a known contact, otherwise it's a new enquiry.
 */
export function decideRoute(m: MatchFlags): InboundRoute {
  if (m.leadId) return 'existing_lead';
  if (m.clientAccountId) return 'existing_client';
  if (m.contactId) return 'existing_contact';
  return 'new_enquiry';
}

/**
 * Reduce a phone string to its significant digits (last 10) so numbers in
 * mixed formats (+447…, 07…, spaces/brackets) compare equal. Returns '' when
 * there is nothing usable.
 */
export function phoneDigits(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/\D/g, '').slice(-10);
}

/** Normalise an email for case-insensitive matching. '' when empty. */
export function normEmail(s: string | null | undefined): string {
  if (!s) return '';
  return s.trim().toLowerCase();
}
