-- Add Negotiating + On-hold to the deal pipeline (post-quote model, per 15 Jun decision).
-- Additive enum values; existing deals unaffected.
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'negotiating';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'on_hold';
