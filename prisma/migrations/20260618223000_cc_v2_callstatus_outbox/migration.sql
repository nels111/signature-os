-- Cold-calling redesign v2 — ADDITIVE ONLY (no drops, no data loss).
-- expand phase of expand-and-contract. The QueueType/legacy columns are left
-- intact and are dropped in a later, separately-approved migration after soak.

-- CreateEnum
CREATE TYPE "LeadCallStatus" AS ENUM ('new', 'retry', 'callback', 'nurturing', 'booked', 'renewal', 'dormant', 'dead');

-- AlterTable (nullable -> safe, backfilled by script)
ALTER TABLE "leads" ADD COLUMN "callStatus" "LeadCallStatus";

-- CreateIndex
CREATE INDEX "leads_callStatus_nextCallAt_idx" ON "leads"("callStatus", "nextCallAt");

-- CreateTable
CREATE TABLE "email_outbox" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "template" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_outbox_status_createdAt_idx" ON "email_outbox"("status", "createdAt");
CREATE INDEX "email_outbox_leadId_idx" ON "email_outbox"("leadId");
