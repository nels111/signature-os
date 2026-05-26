-- Migration: add_undeclared_models_and_align_types
-- Rewrote 2026-05-25 to be shadow-DB safe: tables created with IF NOT EXISTS
-- so Prisma's shadow database can apply this cleanly from a blank slate.
-- Live DB: tables already exist — IF NOT EXISTS guards are no-ops there.

-- ============================================================
-- SECTION 0: Create undeclared live tables (if they don't exist)
-- These were created outside Prisma originally; safe IF NOT EXISTS here.
-- ============================================================

-- calendar_external_invites
CREATE TABLE IF NOT EXISTS "calendar_external_invites" (
  "id"          TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "eventId"     TEXT NOT NULL,
  "email"       TEXT NOT NULL,
  "name"        TEXT,
  "status"      TEXT NOT NULL DEFAULT 'pending',
  "sentAt"      TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "calendar_external_invites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_external_invites_eventId_email_key"
  ON "calendar_external_invites"("eventId", "email");
CREATE INDEX IF NOT EXISTS "calendar_external_invites_email_idx"
  ON "calendar_external_invites"("email");
CREATE INDEX IF NOT EXISTS "calendar_external_invites_eventId_idx"
  ON "calendar_external_invites"("eventId");
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'calendar_external_invites_eventId_fkey'
  ) THEN
    ALTER TABLE "calendar_external_invites"
      ADD CONSTRAINT "calendar_external_invites_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- push_subscriptions
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id"         TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "user_id"    TEXT NOT NULL,
  "endpoint"   TEXT NOT NULL,
  "p256dh"     TEXT NOT NULL,
  "auth"       TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) DEFAULT now(),
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_user_id_endpoint_key"
  ON "push_subscriptions"("user_id", "endpoint");
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx"
  ON "push_subscriptions"("user_id");
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'push_subscriptions_user_id_fkey'
  ) THEN
    ALTER TABLE "push_subscriptions"
      ADD CONSTRAINT "push_subscriptions_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- time_sessions
CREATE TABLE IF NOT EXISTS "time_sessions" (
  "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"          VARCHAR(255) NOT NULL,
  "clocked_in_at"    TIMESTAMPTZ(6) NOT NULL,
  "clocked_out_at"   TIMESTAMPTZ(6),
  "duration_minutes" INTEGER,
  "notes"            TEXT,
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "time_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "time_sessions_user_id_idx"
  ON "time_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "time_sessions_clocked_in_at_idx"
  ON "time_sessions"("clocked_in_at");
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'time_sessions_user_id_fkey'
  ) THEN
    ALTER TABLE "time_sessions"
      ADD CONSTRAINT "time_sessions_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

-- ============================================================
-- SECTION 1: Align decimal precision on money/rate fields (idempotent via SET DATA TYPE)
-- ============================================================
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

ALTER TABLE "sites"
  ALTER COLUMN "monthlyBillingValue" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "labourRatePerHour" SET DATA TYPE DECIMAL(10,4),
  ALTER COLUMN "fixedMonthlyCost" SET DATA TYPE DECIMAL(12,2);

-- ============================================================
-- SECTION 2: FK and index alignment (safe, live DB already has these)
-- ============================================================
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'email_attachments_email_id_fkey'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE "email_attachments"
      ADD CONSTRAINT "email_attachments_email_id_fkey"
      FOREIGN KEY ("email_id") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
