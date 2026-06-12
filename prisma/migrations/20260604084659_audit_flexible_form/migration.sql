-- Flexible audit form (Connecteam Small/Large site audits parity)
ALTER TABLE "audits" ADD COLUMN "formType" TEXT NOT NULL DEFAULT 'large';
ALTER TABLE "audits" ADD COLUMN "siteVariant" TEXT;
ALTER TABLE "audits" ADD COLUMN "categories" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "audits" ADD COLUMN "rawScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "audits" ADD COLUMN "maxScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "audits" ADD COLUMN "binsEmptied" BOOLEAN;
ALTER TABLE "audits" ADD COLUMN "issuesSpotted" TEXT;
ALTER TABLE "audits" ADD COLUMN "needsReview" TEXT;
ALTER TABLE "audits" ADD COLUMN "signatureData" TEXT;

-- overallScore keeps existing values; give it a default for new flexible inserts
ALTER TABLE "audits" ALTER COLUMN "overallScore" SET DEFAULT 0;

-- Legacy 5-category columns become optional (superseded by categories JSON)
ALTER TABLE "audits" ALTER COLUMN "scorePresentation" DROP NOT NULL;
ALTER TABLE "audits" ALTER COLUMN "scoreCleanliness" DROP NOT NULL;
ALTER TABLE "audits" ALTER COLUMN "scoreCompliance" DROP NOT NULL;
ALTER TABLE "audits" ALTER COLUMN "scoreEquipment" DROP NOT NULL;
ALTER TABLE "audits" ALTER COLUMN "scoreTeamConduct" DROP NOT NULL;
