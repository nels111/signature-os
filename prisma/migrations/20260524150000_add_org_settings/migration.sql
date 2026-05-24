-- CreateTable
CREATE TABLE "org_settings" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "defaultLabourRatePerHour" DECIMAL(65,30) NOT NULL DEFAULT 17,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "org_settings_pkey" PRIMARY KEY ("id")
);

-- Seed singleton row
INSERT INTO "org_settings" ("id", "defaultLabourRatePerHour", "updatedAt", "createdAt")
VALUES ('singleton', 17, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
