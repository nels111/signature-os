/**
 * Owner / notification identities, resolved from environment.
 *
 * Moved out of source per JAZ-HANDOFF.md sec 3 (no hardcoded UUIDs or personal
 * phone numbers in the repo, and resilient to DB reseeds). Set these in .env:
 *   AGENT_OWNER_USER_ID      - primary owner (Nelson) user id for new leads/events
 *   AGENT_SECONDARY_USER_ID  - secondary owner (Nick) user id for invites/notifications
 *   NELSON_WA_NUMBER         - primary WhatsApp number for booking/enquiry alerts
 *   NICK_WA_NUMBER           - secondary WhatsApp number
 *
 * These are validated at boot by src/lib/env.ts. Empty fallbacks here keep the
 * build type-safe; a missing value surfaces loudly rather than silently writing
 * to a non-existent owner.
 */
export const OWNER_USER_ID = process.env.AGENT_OWNER_USER_ID || '';
export const SECONDARY_USER_ID = process.env.AGENT_SECONDARY_USER_ID || '';
export const OWNER_WA_NUMBER = process.env.NELSON_WA_NUMBER || '';
export const SECONDARY_WA_NUMBER = process.env.NICK_WA_NUMBER || '';
