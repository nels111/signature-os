-- Align schema drift introduced via `db push` between init and 15 May 2026.
-- Adds: QuoteStatus.viewed/superseded, Quote.viewedAt, Quote.supersededById self-FK,
--       Quote.trackingId UNIQUE/INDEX, Email @@unique([messageId, mailbox]),
--       EmailAttachment table with FK + index.
-- All DDL is idempotent so prod DBs that already contain these objects (applied by
-- earlier `db push`) will not error when this migration is replayed.

-- ============ QuoteStatus enum: add viewed + superseded ============

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'viewed'
      AND enumtypid = '"QuoteStatus"'::regtype
  ) THEN
    ALTER TYPE "QuoteStatus" ADD VALUE 'viewed';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'superseded'
      AND enumtypid = '"QuoteStatus"'::regtype
  ) THEN
    ALTER TYPE "QuoteStatus" ADD VALUE 'superseded';
  END IF;
END$$;

-- ============ Drop old single-column messageId unique index if present ============

DROP INDEX IF EXISTS "emails_messageId_key";

-- ============ Quote: add viewedAt + supersededById ============

ALTER TABLE "quotes"
  ADD COLUMN IF NOT EXISTS "viewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "supersededById" TEXT;

-- ============ EmailAttachment table ============

CREATE TABLE IF NOT EXISTS "email_attachments" (
    "id" TEXT NOT NULL,
    "email_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "size" INTEGER NOT NULL DEFAULT 0,
    "content" BYTEA NOT NULL DEFAULT E'\\x',
    "content_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_attachments_pkey" PRIMARY KEY ("id")
);

-- ============ Indexes ============

CREATE INDEX IF NOT EXISTS "email_attachments_email_id_idx"
  ON "email_attachments"("email_id");

CREATE UNIQUE INDEX IF NOT EXISTS "emails_messageId_mailbox_key"
  ON "emails"("messageId", "mailbox");

CREATE UNIQUE INDEX IF NOT EXISTS "quotes_trackingId_key"
  ON "quotes"("trackingId");

CREATE INDEX IF NOT EXISTS "quotes_trackingId_idx"
  ON "quotes"("trackingId");

-- ============ Foreign keys ============

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_attachments_email_id_fkey'
  ) THEN
    ALTER TABLE "email_attachments"
      ADD CONSTRAINT "email_attachments_email_id_fkey"
      FOREIGN KEY ("email_id") REFERENCES "emails"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quotes_supersededById_fkey'
  ) THEN
    ALTER TABLE "quotes"
      ADD CONSTRAINT "quotes_supersededById_fkey"
      FOREIGN KEY ("supersededById") REFERENCES "quotes"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- ============ Strip legacy defaults on email_attachments (schema is source of truth) ============

ALTER TABLE "email_attachments"
  ALTER COLUMN "content_type" DROP DEFAULT,
  ALTER COLUMN "content" DROP DEFAULT;
