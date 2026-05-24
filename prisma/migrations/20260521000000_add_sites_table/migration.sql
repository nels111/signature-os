-- CreateEnum
CREATE TYPE "CellTier" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('hourly', 'monthly_fixed');

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "connecteamJobName" TEXT,
    "cellTier" "CellTier" NOT NULL DEFAULT 'A',
    "billingType" "BillingType" NOT NULL DEFAULT 'hourly',
    "billingRatePerHour" DECIMAL(65,30),
    "monthlyBillingValue" DECIMAL(65,30),
    "labourRatePerHour" DECIMAL(65,30) NOT NULL DEFAULT 17,
    "rateConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sites_active_idx" ON "sites"("active");
