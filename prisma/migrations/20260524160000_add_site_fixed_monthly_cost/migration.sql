-- Add fixedMonthlyCost to sites for subcontractor flat-fee contracts (Cleanz4U / Lisa).
-- When set, weekly cost = fixedMonthlyCost / 4.33 instead of hours × labourRatePerHour.
ALTER TABLE "sites" ADD COLUMN "fixedMonthlyCost" DECIMAL(65,30);
