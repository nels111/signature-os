-- No lost lead, ongoing: any newly created lead enters the calling funnel as
-- 'new' (never called) instead of NULL (invisible to the queue). ADDITIVE —
-- affects future inserts only, touches no existing rows.
ALTER TABLE "leads" ALTER COLUMN "callStatus" SET DEFAULT 'new';
