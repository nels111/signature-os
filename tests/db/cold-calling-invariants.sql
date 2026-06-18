-- Cold-calling v2 data invariants. Each query MUST return zero rows.
-- Run against any DB after backfill (candidate, then prod at cutover).
-- The runner prints the count for each; non-zero => the build is NOT safe to ship.

-- 1. No active lead left without a callStatus (would be lost entirely).
SELECT 'null_callstatus' AS invariant, id
FROM leads
WHERE "deletedAt" IS NULL AND "callStatus" IS NULL;

-- 2. No callable, non-'new' lead missing a due time (would be invisible to the queue).
SELECT 'callable_without_due' AS invariant, id
FROM leads
WHERE "deletedAt" IS NULL
  AND "callStatus" IN ('retry','callback','nurturing','renewal','dormant')
  AND "nextCallAt" IS NULL;

-- 3. No terminal lead with a future call time (booked/dead must not resurface).
SELECT 'terminal_with_due' AS invariant, id
FROM leads
WHERE "deletedAt" IS NULL
  AND "callStatus" IN ('booked','dead')
  AND "nextCallAt" IS NOT NULL;
