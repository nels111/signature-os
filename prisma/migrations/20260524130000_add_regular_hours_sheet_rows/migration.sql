-- Minimal migration: add RegularHoursSheetRow + Site FK only.
-- All other schema drift is left untouched (handled by earlier align_schema_drift migrations).

-- CreateEnum
CREATE TYPE "HoursSheetRowStatus" AS ENUM ('active', 'pipeline');

-- CreateTable
CREATE TABLE "regular_hours_sheet_rows" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "cleanType" TEXT,
    "hoursPerVisit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "frequencyPerWeek" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "avgWeeklyHours" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "avgWeeklyEarnings" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "avgMonthlyEarnings" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "signedTerms" BOOLEAN NOT NULL DEFAULT false,
    "annualValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "firstAuditDate" TIMESTAMP(3),
    "status" "HoursSheetRowStatus" NOT NULL DEFAULT 'active',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regular_hours_sheet_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "regular_hours_sheet_rows_businessName_key" ON "regular_hours_sheet_rows"("businessName");

-- CreateIndex
CREATE INDEX "regular_hours_sheet_rows_status_idx" ON "regular_hours_sheet_rows"("status");

-- CreateIndex
CREATE INDEX "regular_hours_sheet_rows_syncedAt_idx" ON "regular_hours_sheet_rows"("syncedAt");

-- AlterTable: add Site FK column
ALTER TABLE "sites" ADD COLUMN "regularHoursSheetRowId" TEXT;

-- CreateIndex
CREATE INDEX "sites_regularHoursSheetRowId_idx" ON "sites"("regularHoursSheetRowId");

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_regularHoursSheetRowId_fkey" FOREIGN KEY ("regularHoursSheetRowId") REFERENCES "regular_hours_sheet_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
