-- Compliance Tracker — Task #28 (G3: Zero-input ops intelligence)
-- Apply with: psql $DATABASE_URL -f scripts/migrations/compliance-tracker.sql
-- Additive only. No existing data is modified.
-- Written by Jaz, 26 May 2026.

-- ── Enums ──────────────────────────────────────────────────────────────────────

CREATE TYPE "ComplianceStatus" AS ENUM (
  'valid',
  'expiring_soon',
  'expired',
  'missing'
);

CREATE TYPE "RtwType" AS ENUM (
  'uk_passport',
  'uk_birth_certificate',
  'share_code',
  'brp',
  'settled_status',
  'pre_settled_status',
  'other'
);

-- ── Operatives ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS operatives (
  id             TEXT        NOT NULL,
  "connecteamId" BIGINT      NOT NULL,
  "fullName"     TEXT        NOT NULL,
  entity         TEXT        NOT NULL,
  role           TEXT,
  phone          TEXT,
  "startDate"    TIMESTAMP(3),
  archived       BOOLEAN     NOT NULL DEFAULT false,
  notes          TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT operatives_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS operatives_connecteamId_key
  ON operatives ("connecteamId");

CREATE INDEX IF NOT EXISTS operatives_entity_idx
  ON operatives (entity);

CREATE INDEX IF NOT EXISTS operatives_archived_idx
  ON operatives (archived);

-- ── Compliance records ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_records (
  id             TEXT NOT NULL,
  "operativeId"  TEXT NOT NULL,

  -- DBS
  "dbsIssued"            TIMESTAMP(3),
  "dbsExpiry"            TIMESTAMP(3),
  "dbsCertificateNumber" TEXT,
  "dbsUpdateService"     BOOLEAN NOT NULL DEFAULT false,
  "dbsStatus"            "ComplianceStatus" NOT NULL DEFAULT 'missing',

  -- Insurance
  "insuranceProvider"     TEXT,
  "insuranceExpiry"       TIMESTAMP(3),
  "insurancePolicyNumber" TEXT,
  "insuranceStatus"       "ComplianceStatus" NOT NULL DEFAULT 'missing',

  -- Right to Work
  "rtwType"      "RtwType",
  "rtwExpiry"    TIMESTAMP(3),
  "rtwShareCode" TEXT,
  "rtwStatus"    "ComplianceStatus" NOT NULL DEFAULT 'missing',

  -- Overall
  "overallStatus" "ComplianceStatus" NOT NULL DEFAULT 'missing',

  "lastReviewedAt" TIMESTAMP(3),
  "lastReviewedBy" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT compliance_records_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS compliance_records_operativeId_key
  ON compliance_records ("operativeId");

CREATE INDEX IF NOT EXISTS compliance_records_dbsExpiry_idx
  ON compliance_records ("dbsExpiry");

CREATE INDEX IF NOT EXISTS compliance_records_insuranceExpiry_idx
  ON compliance_records ("insuranceExpiry");

CREATE INDEX IF NOT EXISTS compliance_records_rtwExpiry_idx
  ON compliance_records ("rtwExpiry");

CREATE INDEX IF NOT EXISTS compliance_records_overallStatus_idx
  ON compliance_records ("overallStatus");

-- FK
ALTER TABLE compliance_records
  ADD CONSTRAINT compliance_records_operativeId_fkey
  FOREIGN KEY ("operativeId")
  REFERENCES operatives(id)
  ON DELETE CASCADE;
