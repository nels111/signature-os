-- Migration: add_undeclared_models_and_align_types
-- Generated: 2026-05-26
-- Status: REVIEW-ONLY — DO NOT apply to production without Nelson approval
-- See: /home/dorabot/.dorabot/workspace/audits/sigos-2026-05-25/fixer-output/data.md
--
-- This migration reconciles schema drift between schema.prisma and the live DB.
-- Sections marked [RISKY] need explicit sign-off before execution.

-- ============================================================
-- SECTION 1: Register FK for time_sessions (no prior FK in DB)
-- ============================================================
-- The live DB has no FK from time_sessions.user_id to users.id.
-- Adding RESTRICT (matches NOT NULL constraint on user_id column).
-- [RISKY if any orphaned user_id values exist — validate first:]
--   SELECT COUNT(*) FROM time_sessions ts LEFT JOIN users u ON u.id=ts.user_id WHERE u.id IS NULL;

ALTER TABLE "time_sessions" ADD CONSTRAINT "time_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- SECTION 2: Align decimal precision on money/rate fields
-- ============================================================
-- These are safe ALTER TYPE changes (widening precision).
-- No data truncation risk: current columns are numeric(65,30).

ALTER TABLE "deals"
  ALTER COLUMN "value" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "weeklyHours" SET DATA TYPE DECIMAL(10,4);

ALTER TABLE "quotes"
  ALTER COLUMN "weeklyHours" SET DATA TYPE DECIMAL(10,4),
  ALTER COLUMN "sellRate" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "labourRate" SET DATA TYPE DECIMAL(10,4),
  ALTER COLUMN "weeksPerMonth" SET DATA TYPE DECIMAL(10,4),
  ALTER COLUMN "pilotDiscount" SET DATA TYPE DECIMAL(10,4),
  ALTER COLUMN "monthlyTotal" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "annualTotal" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "margin" SET DATA TYPE DECIMAL(10,4),
  ALTER COLUMN "hoursPerDay" SET DATA TYPE DECIMAL(10,4),
  ALTER COLUMN "overheadCost" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "productCost" SET DATA TYPE DECIMAL(12,2);

ALTER TABLE "regular_hours_sheet_rows"
  ALTER COLUMN "avgWeeklyEarnings" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "avgMonthlyEarnings" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "annualValue" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "avgWeeklyHours" SET DATA TYPE DECIMAL(10,4),
  ALTER COLUMN "hoursPerVisit" SET DATA TYPE DECIMAL(10,4),
  ALTER COLUMN "frequencyPerWeek" SET DATA TYPE DECIMAL(10,4);

ALTER TABLE "org_settings"
  ALTER COLUMN "defaultLabourRatePerHour" SET DATA TYPE DECIMAL(10,4);

-- Sites: billingRatePerHour already DECIMAL(10,2) in DB — confirming fixedMonthlyCost and monthlyBillingValue
ALTER TABLE "sites"
  ALTER COLUMN "monthlyBillingValue" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "labourRatePerHour" SET DATA TYPE DECIMAL(10,4),
  ALTER COLUMN "fixedMonthlyCost" SET DATA TYPE DECIMAL(12,2);

-- ============================================================
-- SECTION 3: Re-register FK constraints with correct cascade rules
-- ============================================================
-- [RISKY] The live DB has slightly different FK definitions (UPDATE NO ACTION vs CASCADE).
-- Dropping and re-adding to align with Prisma's defaults.
-- Validate no in-flight transactions before running in prod.

-- email_attachments: live FK uses ON UPDATE NO ACTION, Prisma wants CASCADE
ALTER TABLE "email_attachments" DROP CONSTRAINT IF EXISTS "email_attachments_email_id_fkey";
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_email_id_fkey"
  FOREIGN KEY ("email_id") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- quotes self-referential FK: live uses lowercase supersededbyid name
ALTER TABLE "quotes" DROP CONSTRAINT IF EXISTS "quotes_supersededbyid_fkey";
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_supersededById_fkey"
  FOREIGN KEY ("supersededById") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- calendar_external_invites: re-register under Prisma-standard name
ALTER TABLE "calendar_external_invites" DROP CONSTRAINT IF EXISTS "calendar_external_invites_eventId_fkey";
ALTER TABLE "calendar_external_invites" ADD CONSTRAINT "calendar_external_invites_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- push_subscriptions: live FK uses ON UPDATE NO ACTION, Prisma wants CASCADE
ALTER TABLE "push_subscriptions" DROP CONSTRAINT IF EXISTS "push_subscriptions_user_id_fkey";
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- SECTION 4: Index alignment
-- ============================================================
-- [RISKY] Renames existing live indexes to match Prisma-generated names.
-- Application code or monitoring may reference the old index names.
-- Check for any monitoring/EXPLAIN queries using old names before applying.

-- calendar_external_invites
ALTER INDEX IF EXISTS "calendar_external_invites_event_idx" RENAME TO "calendar_external_invites_eventId_idx";

-- email_attachments
ALTER INDEX IF EXISTS "idx_email_attachments_email_id" RENAME TO "email_attachments_email_id_idx";

-- emails
ALTER INDEX IF EXISTS "emails_messageid_mailbox_key" RENAME TO "emails_messageId_mailbox_key";

-- push_subscriptions
ALTER INDEX IF EXISTS "idx_push_subscriptions_user_id" RENAME TO "push_subscriptions_user_id_idx";

-- quotes
ALTER INDEX IF EXISTS "quotes_trackingid_key" RENAME TO "quotes_trackingId_key";

-- time_sessions
ALTER INDEX IF EXISTS "idx_time_sessions_clocked_in" RENAME TO "time_sessions_clocked_in_at_idx";
ALTER INDEX IF EXISTS "idx_time_sessions_user_id" RENAME TO "time_sessions_user_id_idx";

-- ============================================================
-- SECTION 5: [DEFERRED — needs Nelson decision]
-- ============================================================
-- The following changes were detected by prisma migrate diff but are NOT included
-- here because they are potentially destructive and need explicit sign-off:
--
-- 1. sites.id: Live DB uses VARCHAR with gen_random_uuid() default. Prisma schema uses
--    TEXT with cuid() default. The diff wants to: DROP PK, change type to TEXT, drop
--    default, re-add PK. This would break any VARCHAR FK references. DEFER.
--
-- 2. sites.name / sites.connecteamJobName: Live uses VARCHAR, schema uses TEXT.
--    PostgreSQL TEXT and VARCHAR are storage-equivalent but the type change requires
--    a full table rewrite. Low risk but needs maintenance window.
--
-- 3. sites.createdAt / updatedAt: Live uses TIMESTAMPTZ(6), schema.prisma uses
--    TIMESTAMP(3) (no timezone). Changing this loses timezone info. DEFER until
--    timezone strategy is confirmed.
--
-- 4. email_attachments.created_at: Live uses TIMESTAMPTZ(6), diff wants TIMESTAMP(3).
--    Same timezone concern. DEFER.
--
-- 5. time_sessions.clocked_in_at: Diff wants to DROP DEFAULT (now()). The default is
--    useful for manual inserts. DEFER.
--
-- 6. SetNull on time_sessions.user_id: Requested by task spec but column is NOT NULL
--    in live DB. To use SetNull: first ALTER COLUMN user_id DROP NOT NULL, then update
--    the FK. Schema.prisma currently uses RESTRICT to match live constraint. Nelson
--    must decide: (a) keep RESTRICT, (b) make nullable + SetNull, (c) Cascade delete.
