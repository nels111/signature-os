# Cold-Calling Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the SigOS cold-calling module on a single source-of-truth state model (`callStatus` + `nextCallAt`) so no lead is ever lost, counts are trustworthy, and outcomes are captured reliably — built and verified to the new SigOS build/test/deploy standard, then swapped onto live with zero data loss.

**Architecture:** A pure, deterministic core (`resolveOutcome` and `queueState`) decides every state transition and which queue a lead belongs to, with zero I/O so it can be exhaustively property-tested. A thin persistence layer applies that decision inside one transaction (idempotent via an `attemptId` unique key, lead claimed via row lock), then fires all side-effects (emails via an observable outbox) only after commit. The legacy `stage`/`queueType`/task-driven-queue smear is replaced; existing data is migrated by an expand-and-contract backfill.

**Tech Stack:** Next.js 15 (App Router, Server Actions), TypeScript, Prisma 7 + PostgreSQL, Vitest + fast-check (new), Playwright (existing). Build on a candidate (isolated worktree, port 3201), atomic swap to live (`signature-os`, port 3200).

**Source spec:** research #80. **Problem inventory:** research #79. **Build standard:** `playbooks/sigos-build-test-deploy-framework.md`.

---

## Ground truth (verified in code 18 Jun 2026)

- Engine: `src/lib/cold-calling/outcome-rules.ts` — `applyColdCallOutcome({leadId, attemptId, userId, payload})`. 9-case switch builds `leadUpdate`, runs one `$transaction` (lead update + attempt update + `call` activity + tasks + optional `email_sent` activity), then fires `sideEffects[]` post-commit. BUGS confirmed: gatekeeper email fires **inside** the switch pre-commit (line ~201); every email is `.catch(console.error)` fire-and-forget; `Math.random()`/`randomBetween` make it non-deterministic; `addDays`/`addMonths` use server-local time.
- Queue: `src/lib/cold-calling/queue.ts` — `getNextLead()` (no lock) + computed queues keyed off Task rows + stage lists + dates, NOT `lead.queueType`.
- Types: `src/lib/cold-calling/types.ts` (`OutcomePayload`, `ColdCallingLead`). Stats: `src/lib/cold-calling/stats.ts`. Emails: `send-emails.ts`, `email-templates.ts`. Validators: `validators.ts`.
- API: `src/app/api/cold-calling/{next,queue,feed,stats}/route.ts`, `calls/start`, `calls/[attemptId]/outcome`, `calls/[attemptId]/twilio`, `tasks/due`, `tasks/[taskId]/complete`.
- UI: `src/app/dashboard/cold-calling/` — `page.tsx`, `components/*` incl. `BrowserDiallerPanel.tsx` (to remove), `OutcomePanel.tsx`, `QueueSidebar.tsx`, `AdminStatsPanel.tsx`, 9 `forms/*`.
- Prisma `Lead` already has: `stage`, `queueType`, `nextCallAt`, `lastCalledAt`, `firstCalledAt`, `coldCallAttempts`, `noAnswerAttempts`, `voicemailAttempts`, `gatekeeperAttempts`, `isCallable`, `removedFromQueueAt`, `dormantUntil`, intelligence fields, `siteVisitAt/Address/Contact`, relation `callAttempts ColdCallAttempt[]`. Enums: `LeadStage`, `QueueType`, `ColdCallOutcome`.
- No Vitest/fast-check installed. Playwright ^1.60.0 present, `tests/e2e/smoke.spec.ts` exists. `package.json` scripts: dev/build/start/lint only.

---

## New model (the contract every task builds toward)

```typescript
// src/lib/cold-calling/state.ts  (NEW — pure, no imports from prisma/db)

/** The ONE source of truth for where a lead sits in the calling funnel. */
export type CallStatus =
  | 'new'        // never called, has phone -> due now
  | 'retry'      // attempted, no contact yet -> due at nextCallAt
  | 'callback'   // promised callback at a set time -> due at nextCallAt
  | 'nurturing'  // info sent (gatekeeper or DM) -> due at nextCallAt
  | 'booked'     // site visit booked -> TERMINAL for calling (handed to ops)
  | 'renewal'    // contract renewal captured -> due at nextCallAt
  | 'dormant'    // exhausted / not-now -> revives at nextCallAt (never lost)
  | 'dead';      // hard no / bad data -> TERMINAL

export const CALLABLE_STATUSES: readonly CallStatus[] =
  ['new', 'retry', 'callback', 'nurturing', 'renewal', 'dormant'] as const;
export const TERMINAL_STATUSES: readonly CallStatus[] = ['booked', 'dead'] as const;

/** Tunable parameters (research #80 §8). Single source so tests + engine agree. */
export const CALL_PARAMS = {
  noAnswerMax: 5,
  voicemailMax: 3,
  gatekeeperMax: 3,
  noAnswerGapsDays: [0.1667, 1, 2, 3, 5], // 4h, then 1d,2d,3d,5d (index by attempt-1)
  voicemailGapDays: 1,
  nurturingGapDays: 3,
  dormantRevivalDays: 90,
  renewalLeadDays: 7,
} as const;
```

The persisted shape: add **one** column `callStatus CallStatus` to `Lead`. Reuse existing `nextCallAt` and the counter fields. `queueType` is frozen (stop writing it; drop in the contract phase). `stage` keeps being maintained for the wider pipeline but is NO LONGER read by cold-calling queues.

---

## File structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/lib/cold-calling/state.ts` | Pure types, params, `resolveOutcome()` transition fn | **Create** |
| `src/lib/cold-calling/queue-state.ts` | Pure queue classification + ordering from `(callStatus, nextCallAt, now)` | **Create** |
| `src/lib/cold-calling/time.ts` | UK-tz date helpers (`addDays`, `startOfDayUK`, `isDue`) deterministic, `now` injected | **Create** |
| `src/lib/cold-calling/outcome-rules.ts` | Persistence: idempotent apply of `resolveOutcome` in one tx + post-commit effects | **Rewrite** |
| `src/lib/cold-calling/queue.ts` | `getNextLead()` with row lock + queue/count derivation via `queue-state` | **Rewrite** |
| `src/lib/cold-calling/email-outbox.ts` | Enqueue/send/retry; activity only on success | **Create** |
| `src/lib/cold-calling/stats.ts` | Uniform stats shape, VA-scoped, single derivation | **Rewrite** |
| `src/lib/cold-calling/migrate-callstatus.ts` | Pure mapping `(legacy fields) -> CallStatus + nextCallAt` | **Create** |
| `prisma/schema.prisma` | Add `CallStatus` enum + `Lead.callStatus`; later drop `QueueType` | **Modify** |
| `src/app/api/cold-calling/calls/[attemptId]/twilio/route.ts` | Twilio dialler endpoint | **Delete** |
| `src/app/dashboard/cold-calling/components/BrowserDiallerPanel.tsx` | In-app dialler UI | **Delete** |
| `tests/unit/cold-calling/*.test.ts` | Vitest unit + property tests | **Create** |
| `tests/db/cold-calling-invariants.sql` | No-orphan / no-lost-lead SQL assertions | **Create** |
| `tests/e2e/cold-calling.spec.ts` | Playwright VA flow on candidate port | **Create** |
| `scripts/sigos/*` | migration-safety check, candidate build/swap, db-invariants runner | **Create** |
| `src/app/api/_health/route.ts` | Health endpoint for post-swap verify | **Create** |

---

## Phase 0 — Test infra + safety scaffolding (the new standard's first install)

### Task 0.1: Add Vitest + fast-check

**Files:** Modify `package.json`; Create `vitest.config.ts`.

- [ ] **Step 1:** Install dev deps (in the candidate worktree only).
```bash
npm i -D vitest@^2 fast-check@^3 @vitest/coverage-v8@^2
```
- [ ] **Step 2:** Create `vitest.config.ts`.
```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    globals: true,
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```
- [ ] **Step 3:** Add scripts to `package.json`.
```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit",
"verify": "npm run typecheck && npm run test && npm run lint"
```
- [ ] **Step 4:** Create `tests/unit/sanity.test.ts` with `expect(1+1).toBe(2)`; run `npm test`; expect PASS.
- [ ] **Step 5:** Commit `chore(test): add vitest + fast-check harness`.

### Task 0.2: Migration-safety guard

**Files:** Create `scripts/sigos/check-migration-safety.mjs`.

- [ ] **Step 1:** Script scans new files under `prisma/migrations/**` for `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE FROM` (case-insensitive) and exits 1 listing offenders unless the migration filename contains `.approved-destructive.`.
- [ ] **Step 2:** Test: a temp SQL with `DROP COLUMN` → exit 1; clean SQL → exit 0.
- [ ] **Step 3:** Commit `chore(safety): block destructive migrations by default`.

### Task 0.3: Health endpoint

**Files:** Create `src/app/api/_health/route.ts`.

- [ ] **Step 1:**
```typescript
import { prisma } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { await prisma.$queryRaw`SELECT 1`; }
  catch { return Response.json({ ok: false }, { status: 503 }); }
  return Response.json({ ok: true, ts: new Date().toISOString() });
}
```
- [ ] **Step 2:** Commit `feat(ops): /api/_health readiness endpoint`.

---

## Phase 1 — Schema: add CallStatus (additive, safe)

### Task 1.1: Add enum + column

**Files:** Modify `prisma/schema.prisma`.

- [ ] **Step 1:** Add enum and field (nullable first, so migration is non-destructive):
```prisma
enum CallStatus {
  new
  retry
  callback
  nurturing
  booked
  renewal
  dormant
  dead
}
// in model Lead:
  callStatus CallStatus?
// new index:
  @@index([callStatus, nextCallAt])
```
- [ ] **Step 2:** `npx prisma migrate dev --name add_call_status` (creates additive migration).
- [ ] **Step 3:** Run `node scripts/sigos/check-migration-safety.mjs` → expect exit 0 (additive only).
- [ ] **Step 4:** `npx prisma generate`; `npm run typecheck` → PASS.
- [ ] **Step 5:** Commit `feat(db): add CallStatus enum + Lead.callStatus (additive)`.

---

## Phase 2 — Pure core: the transition engine (the heart, fully TDD)

### Task 2.1: UK-time helpers

**Files:** Create `src/lib/cold-calling/time.ts`; Test `tests/unit/cold-calling/time.test.ts`.

- [ ] **Step 1 (failing test):**
```typescript
import { addDays, isDue } from '@/lib/cold-calling/time';
test('addDays adds whole and fractional days in UTC-stable way', () => {
  const base = new Date('2026-06-18T12:00:00.000Z');
  expect(addDays(base, 1).toISOString()).toBe('2026-06-19T12:00:00.000Z');
  expect(addDays(base, 0.1667).getTime()).toBe(base.getTime() + Math.round(0.1667*86400000));
});
test('isDue: null nextCallAt is always due', () => {
  expect(isDue(null, new Date())).toBe(true);
});
test('isDue: past is due, future is not', () => {
  const now = new Date('2026-06-18T12:00:00Z');
  expect(isDue(new Date('2026-06-18T11:00:00Z'), now)).toBe(true);
  expect(isDue(new Date('2026-06-18T13:00:00Z'), now)).toBe(false);
});
```
- [ ] **Step 2:** Run → FAIL (module missing).
- [ ] **Step 3:** Implement `time.ts`:
```typescript
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + Math.round(days * 86_400_000));
}
/** A lead with no scheduled time is due immediately; otherwise due once reached. */
export function isDue(nextCallAt: Date | null, now: Date): boolean {
  return nextCallAt === null || nextCallAt.getTime() <= now.getTime();
}
```
(Note: day math is duration-based and TZ-agnostic; "today/this week" *bucketing* for stats lives in stats.ts using a UK-tz formatter, Task 6.x.)
- [ ] **Step 4:** Run → PASS. **Step 5:** Commit `feat(cc): deterministic time helpers`.

### Task 2.2: `resolveOutcome` transition table

**Files:** Create `src/lib/cold-calling/state.ts`; Test `tests/unit/cold-calling/state.test.ts`.

The function signature (pure, deterministic, `now` injected):
```typescript
export interface LeadCallState {
  callStatus: CallStatus | null;
  noAnswerAttempts: number;
  voicemailAttempts: number;
  gatekeeperAttempts: number;
  coldCallAttempts: number;
  hasEmail: boolean;
}
export type OutcomeName =
  | 'no_answer' | 'voicemail_left' | 'gatekeeper' | 'callback_booked'
  | 'decision_maker_spoke' | 'site_visit_booked' | 'contract_renewal_date'
  | 'not_interested' | 'not_interested_for_now' | 'bad_data';
export interface OutcomeInput {
  outcome: OutcomeName;
  now: Date;
  callbackAt?: Date | null;
  siteVisitAt?: Date | null;
  renewalDate?: Date | null;
  decisionMakerWantsInfo?: boolean;
}
export interface OutcomeDecision {
  callStatus: CallStatus;
  nextCallAt: Date | null;
  counters: Partial<Pick<LeadCallState,'noAnswerAttempts'|'voicemailAttempts'|'gatekeeperAttempts'|'coldCallAttempts'>>;
  email: 'gatekeeper' | 'callback' | 'send_info' | 'site_visit' | null;
  error?: string; // set when input invalid (e.g. past callback); caller returns 400
}
export function resolveOutcome(lead: LeadCallState, input: OutcomeInput): OutcomeDecision;
```

- [ ] **Step 1 (failing tests — the full table, one assert per row):**
```typescript
import { resolveOutcome } from '@/lib/cold-calling/state';
const now = new Date('2026-06-18T12:00:00Z');
const base = { callStatus:'new', noAnswerAttempts:0, voicemailAttempts:0, gatekeeperAttempts:0, coldCallAttempts:0, hasEmail:true } as const;

test('no_answer under cap -> retry with first gap, no email', () => {
  const d = resolveOutcome({...base}, { outcome:'no_answer', now });
  expect(d.callStatus).toBe('retry');
  expect(d.counters.noAnswerAttempts).toBe(1);
  expect(d.email).toBeNull();
  expect(d.nextCallAt!.getTime()).toBe(now.getTime() + Math.round(0.1667*86400000));
});
test('no_answer at cap -> dormant +90d', () => {
  const d = resolveOutcome({...base, noAnswerAttempts:4}, { outcome:'no_answer', now });
  expect(d.callStatus).toBe('dormant');
  expect(d.nextCallAt!.getTime()).toBe(now.getTime() + 90*86400000);
});
test('gatekeeper under cap -> nurturing +3d + gatekeeper email', () => {
  const d = resolveOutcome({...base}, { outcome:'gatekeeper', now });
  expect(d.callStatus).toBe('nurturing'); expect(d.email).toBe('gatekeeper');
  expect(d.nextCallAt!.getTime()).toBe(now.getTime()+3*86400000);
});
test('gatekeeper with no email on lead -> no email side effect', () => {
  const d = resolveOutcome({...base, hasEmail:false}, { outcome:'gatekeeper', now });
  expect(d.email).toBeNull();
});
test('callback_booked future -> callback at that time + callback email', () => {
  const at = new Date('2026-06-20T09:00:00Z');
  const d = resolveOutcome({...base}, { outcome:'callback_booked', now, callbackAt: at });
  expect(d.callStatus).toBe('callback'); expect(d.nextCallAt!.toISOString()).toBe(at.toISOString());
  expect(d.email).toBe('callback');
});
test('callback_booked in the past -> error, no transition', () => {
  const at = new Date('2026-06-17T09:00:00Z');
  const d = resolveOutcome({...base}, { outcome:'callback_booked', now, callbackAt: at });
  expect(d.error).toBeTruthy();
});
test('decision_maker wants info -> nurturing +3d + send_info email', () => {
  const d = resolveOutcome({...base}, { outcome:'decision_maker_spoke', now, decisionMakerWantsInfo:true });
  expect(d.callStatus).toBe('nurturing'); expect(d.email).toBe('send_info');
});
test('site_visit future -> booked (terminal), site_visit email, nextCallAt null', () => {
  const d = resolveOutcome({...base}, { outcome:'site_visit_booked', now, siteVisitAt:new Date('2026-06-25T10:00:00Z') });
  expect(d.callStatus).toBe('booked'); expect(d.nextCallAt).toBeNull(); expect(d.email).toBe('site_visit');
});
test('contract_renewal future -> renewal at renewal-7d, no email', () => {
  const d = resolveOutcome({...base}, { outcome:'contract_renewal_date', now, renewalDate:new Date('2026-09-01T00:00:00Z') });
  expect(d.callStatus).toBe('renewal');
  expect(d.nextCallAt!.getTime()).toBe(new Date('2026-09-01T00:00:00Z').getTime() - 7*86400000);
});
test('contract_renewal in the past -> error', () => {
  const d = resolveOutcome({...base}, { outcome:'contract_renewal_date', now, renewalDate:new Date('2026-06-01T00:00:00Z') });
  expect(d.error).toBeTruthy();
});
test('not_interested -> dead terminal', () => {
  expect(resolveOutcome({...base}, { outcome:'not_interested', now }).callStatus).toBe('dead');
});
test('not_interested_for_now -> dormant +90d', () => {
  const d = resolveOutcome({...base}, { outcome:'not_interested_for_now', now });
  expect(d.callStatus).toBe('dormant'); expect(d.nextCallAt!.getTime()).toBe(now.getTime()+90*86400000);
});
test('bad_data -> dead terminal', () => {
  expect(resolveOutcome({...base}, { outcome:'bad_data', now }).callStatus).toBe('dead');
});
```
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement `state.ts` per the table (use `CALL_PARAMS`; counters incremented; cap → dormant; invalid dates → `error` set, no transition). **Step 4:** Run → PASS. **Step 5:** Commit `feat(cc): pure resolveOutcome transition engine`.

### Task 2.3: Property test — no lead is ever lost

**Files:** Test `tests/unit/cold-calling/no-lost-lead.property.test.ts`.

- [ ] **Step 1:** fast-check property: apply a RANDOM sequence of outcomes; assert the resulting `callStatus` is always one valid value, and any callable status that isn't `new` has a non-null `nextCallAt`, and terminal statuses have `nextCallAt === null`.
```typescript
import fc from 'fast-check';
import { resolveOutcome, CALLABLE_STATUSES, TERMINAL_STATUSES } from '@/lib/cold-calling/state';
const outcomes = ['no_answer','voicemail_left','gatekeeper','callback_booked','decision_maker_spoke','contract_renewal_date','not_interested','not_interested_for_now','bad_data'] as const;
test('lead always lands in exactly one valid state; callable (non-new) always has a due time', () => {
  fc.assert(fc.property(fc.array(fc.constantFrom(...outcomes), {maxLength:30}), (seq) => {
    let lead = { callStatus:'new', noAnswerAttempts:0, voicemailAttempts:0, gatekeeperAttempts:0, coldCallAttempts:0, hasEmail:true } as any;
    const now = new Date('2026-06-18T12:00:00Z');
    for (const o of seq) {
      const d = resolveOutcome(lead, { outcome:o as any, now,
        callbackAt: new Date(now.getTime()+86400000),
        siteVisitAt: new Date(now.getTime()+5*86400000),
        renewalDate: new Date(now.getTime()+60*86400000),
        decisionMakerWantsInfo:true });
      if (d.error) continue; // invalid input never mutates state
      lead = { ...lead, callStatus:d.callStatus, ...d.counters };
      const valid = [...CALLABLE_STATUSES, ...TERMINAL_STATUSES];
      expect(valid).toContain(d.callStatus);
      if (TERMINAL_STATUSES.includes(d.callStatus)) expect(d.nextCallAt).toBeNull();
      else if (d.callStatus !== 'new') expect(d.nextCallAt).not.toBeNull();
    }
  }), { numRuns: 1000 });
});
```
- [ ] **Step 2:** Run → PASS (fix `state.ts` if any case violates). **Step 3:** Commit `test(cc): property — no lead ever lost`.

---

## Phase 3 — Pure queue classification

### Task 3.1: `queueState` (classify + order)

**Files:** Create `src/lib/cold-calling/queue-state.ts`; Test `tests/unit/cold-calling/queue-state.test.ts`.

```typescript
export type QueueBucket = 'callback'|'renewal'|'retry'|'nurturing'|'new'|'dormant';
export interface QueueRow { id: string; callStatus: CallStatus; nextCallAt: Date | null; }
/** Returns the single bucket a lead belongs to right now, or null if not due / terminal. */
export function classify(row: QueueRow, now: Date): QueueBucket | null;
/** Priority order for the VA's "who next". */
export const BUCKET_PRIORITY: QueueBucket[] = ['callback','renewal','retry','nurturing','new','dormant'];
/** Sort comparator: by bucket priority, then soonest nextCallAt (null = now). */
export function compareForQueue(a: QueueRow, b: QueueRow, now: Date): number;
```

- [ ] **Step 1 (failing tests):** a `booked`/`dead` row → `classify` null; a `callback` due now → `'callback'`; a `callback` in the future → null (not due); a `new` row (null nextCallAt) → `'new'`; counts derived from `classify` over a set never double-count (a row maps to ≤1 bucket); ordering puts a due callback before a due `new`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement: map `callStatus`→bucket, gate on `isDue(nextCallAt, now)`, terminal→null. **Step 4:** PASS. **Step 5:** Commit `feat(cc): pure queue classification + ordering`.

### Task 3.2: Property — a lead is in at most one queue

**Files:** Test `tests/unit/cold-calling/queue-exclusive.property.test.ts`.

- [ ] **Step 1:** fast-check over random `(callStatus, nextCallAt)` rows: `classify` returns null or exactly one bucket; the bucket is always one in which `isDue` holds; terminal statuses always null. → PASS. **Step 2:** Commit `test(cc): property — queue exclusivity`.

---

## Phase 4 — Persistence: idempotent apply + lock + post-commit effects

### Task 4.1: Idempotency key

**Files:** Modify `prisma/schema.prisma` (`ColdCallAttempt`); migration.

- [ ] **Step 1:** Ensure each attempt row carries the client `attemptId` as the PK (already the `[attemptId]` route param) OR add `@@unique([leadId, idempotencyKey])`. Add `idempotencyKey String?` + unique index if not equivalent. Additive migration; run safety check → exit 0.
- [ ] **Step 2:** Commit `feat(db): idempotency key on cold-call attempts`.

### Task 4.2: Rewrite `applyColdCallOutcome`

**Files:** Rewrite `src/lib/cold-calling/outcome-rules.ts`; Test `tests/unit/cold-calling/apply-outcome.test.ts` (with a mocked `tx`).

- [ ] **Step 1 (failing tests, mock prisma tx):** (a) calls `resolveOutcome` and writes the returned `callStatus`/`nextCallAt`/counters; (b) when the attempt already has an outcome (idempotent replay) → no second activity/email, returns prior result; (c) NO email function is called before `tx` resolves (assert ordering via a spy that records call timestamps relative to commit); (d) `d.error` set → throws a typed `OutcomeValidationError`, no writes.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement: load lead `callStatus`+counters → `resolveOutcome` → if `error` throw → `$transaction`(update lead {callStatus,nextCallAt,counters,lastCalledAt,firstCalledAt}, update attempt {outcome,status:completed}, create `call` activity) with a tx-level re-check of attempt.outcome for idempotency → after commit, enqueue email via `email-outbox` and fire push. STOP writing `queueType`. **Step 4:** PASS. **Step 5:** Commit `refactor(cc): idempotent outcome apply on new state model`.

### Task 4.3: `getNextLead` with row lock

**Files:** Rewrite `src/lib/cold-calling/queue.ts`; Test (integration, Task 8 covers live DB) — unit-test the SQL builder shape here.

- [ ] **Step 1:** Implement claim:
```typescript
// Postgres advisory/row lock so two callers never get the same lead.
const rows = await prisma.$queryRaw<{ id: string }[]>`
  SELECT id FROM leads
  WHERE "deletedAt" IS NULL AND phone IS NOT NULL
    AND "callStatus" IN ('new','retry','callback','nurturing','renewal','dormant')
    AND ("nextCallAt" IS NULL OR "nextCallAt" <= now())
  ORDER BY
    CASE "callStatus" WHEN 'callback' THEN 0 WHEN 'renewal' THEN 1 WHEN 'retry' THEN 2
                      WHEN 'nurturing' THEN 3 WHEN 'new' THEN 4 ELSE 5 END,
    "nextCallAt" NULLS FIRST
  FOR UPDATE SKIP LOCKED
  LIMIT 1`;
```
Wrap selection + claim marker in a tx. Queue counts use the SAME predicate via a grouped query so badge == list.
- [ ] **Step 2:** Commit `refactor(cc): locked getNextLead + single-source counts`.

---

## Phase 5 — Observable email outbox

### Task 5.1: Outbox table + enqueue/send/retry

**Files:** Create `src/lib/cold-calling/email-outbox.ts`; Modify `prisma/schema.prisma` (new `EmailOutbox` model: id, leadId, template, to, status[queued|sent|failed], attempts, lastError, createdAt, sentAt); migration (additive); Test `tests/unit/cold-calling/email-outbox.test.ts`.

- [ ] **Step 1 (failing tests, mocked sender):** enqueue creates a `queued` row; successful send → `sent` + writes ONE `email_sent` activity; failing send → `failed` row, attempts++, NO `email_sent` activity; retry of a `failed` row re-attempts.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; map `OutcomeDecision.email` → template via `email-templates.ts`. **Step 4:** PASS. **Step 5:** Commit `feat(cc): observable email outbox (no false sent records)`.

### Task 5.2: Admin visibility of failed emails

**Files:** Modify `src/app/dashboard/cold-calling/components/AdminStatsPanel.tsx` (or a small `EmailOutboxPanel`).

- [ ] **Step 1:** Surface count of `failed` outbox rows with a Retry action hitting a new `POST /api/cold-calling/outbox/[id]/retry`. **Step 2:** Commit `feat(cc): failed-email visibility + retry`.

---

## Phase 6 — Stats: uniform shape, VA-scoped, single derivation

### Task 6.1: Rewrite stats

**Files:** Rewrite `src/lib/cold-calling/stats.ts`; Test `tests/unit/cold-calling/stats.test.ts`.

- [ ] **Step 1 (failing tests):** VA stats and admin stats return the SAME keys (incl. `queueDepth`), only scope differs; "today" buckets use a Europe/London day boundary (inject a fixed `now`, assert a 23:30 UTC call counts on the correct UK day); outcome tallies keyed by stable names.
- [ ] **Step 2:** Implement with `Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London'})` for bucketing; queue depths via `queue-state.classify`. **Step 3:** PASS. **Step 4:** Commit `refactor(cc): uniform VA/admin stats, UK-tz buckets`.

---

## Phase 7 — Migration/backfill + API/UI

### Task 7.1: Pure legacy→callStatus mapping

**Files:** Create `src/lib/cold-calling/migrate-callstatus.ts`; Test `tests/unit/cold-calling/migrate-callstatus.test.ts`.

- [ ] **Step 1 (failing tests):** map representative legacy rows → exactly one valid `callStatus`+`nextCallAt`:
  - `stage in (cold_call, new_lead, contacted)` & never called & has phone → `new` (nextCallAt null).
  - `queueType='callback'` or has future `nextCallAt` from a callback → `callback`.
  - `stage='dormant'` or `dormantUntil` set → `dormant`, nextCallAt = `dormantUntil ?? now+90d`.
  - `stage='meeting_scheduled'`/`siteVisitAt` set → `booked`.
  - `stage in (archived, bad_data, foad)` → `dead`.
  - `stage in (follow_up_sequence, contact_when_contract_up)` → `nurturing`/`renewal` per fields.
  - any callable-but-unclassified → `new` (caught, never lost) + log.
- [ ] **Step 2:** Implement pure mapper. **Step 3:** PASS. **Step 4:** Commit `feat(cc): pure legacy→callStatus mapper`.

### Task 7.2: Backfill script + conservation test

**Files:** Create `scripts/sigos/backfill-callstatus.mjs`; Test `tests/unit/cold-calling/backfill-conservation.test.ts` (pure: over a generated set, every input row yields exactly one valid state; no row dropped).

- [ ] **Step 1:** Script: batch over leads, apply mapper, update `callStatus`+`nextCallAt`. Dry-run mode prints a from→to histogram and asserts `count(out)==count(in)`. **Step 2:** Property/conservation test PASS. **Step 3:** Commit `feat(cc): callStatus backfill (dry-run + conservation)`.

### Task 7.3: Remove the in-app dialler

**Files:** Delete `src/app/api/cold-calling/calls/[attemptId]/twilio/route.ts`; Delete `BrowserDiallerPanel.tsx`; Modify `OutcomePanel.tsx`/`ColdCallingWorkspace.tsx` to drop dialler wiring (VA sees the number + an outcome form only).

- [ ] **Step 1:** Remove imports/usages; ensure `calls/start` still creates the attempt row (the VA taps "Start call" → logs outcome). **Step 2:** `npm run typecheck` PASS. **Step 3:** Commit `refactor(cc): drop in-app dialler (VA calls on own phone)`.

### Task 7.4: Wire API + UI to new model

**Files:** Modify `src/app/api/cold-calling/{next,queue,stats,feed}/route.ts`, `calls/[attemptId]/outcome/route.ts`; queue UI components; `forms/*` (add explicit "Not interested for now" vs hard "Not interested").

- [ ] **Step 1:** `outcome` route validates payload (Zod), passes `attemptId` as idempotency key, returns `ActionResult<{ callStatus, nextCallAt, nextLead }>`. Queue/stats read new derivations. Split the not-interested form into two outcomes. **Step 2:** `typecheck` + unit PASS. **Step 3:** Commit `feat(cc): API/UI on new state model`.

---

## Phase 8 — Verify on candidate, DB invariants, cutover

### Task 8.1: DB invariant SQL

**Files:** Create `tests/db/cold-calling-invariants.sql`; runner `scripts/sigos/run-db-invariants.mjs`.

- [ ] **Step 1:** Assertions (each must return 0 rows):
```sql
-- callable, not 'new', but no due time -> would be invisible
SELECT id FROM leads WHERE "deletedAt" IS NULL
  AND "callStatus" IN ('retry','callback','nurturing','renewal','dormant')
  AND "nextCallAt" IS NULL;
-- any lead with NULL callStatus after backfill
SELECT id FROM leads WHERE "deletedAt" IS NULL AND "callStatus" IS NULL;
-- terminal but still has a future call time
SELECT id FROM leads WHERE "callStatus" IN ('booked','dead') AND "nextCallAt" IS NOT NULL;
```
- [ ] **Step 2:** Runner exits 1 if any returns rows. **Step 3:** Commit `test(cc): DB no-lost-lead invariants`.

### Task 8.2: Playwright VA flow (candidate port)

**Files:** Create `tests/e2e/cold-calling.spec.ts`.

- [ ] **Step 1:** Against `BASE_URL` (candidate 3201), authenticated as the VA: load cold-calling → "who's next" shows a lead → Start call → submit each outcome form → assert queue advances, the right email is enqueued (assert via `/api/cold-calling/outbox` count), and a double-submit doesn't double-count. **Step 2:** Run on candidate → PASS. **Step 3:** Commit `test(cc): Playwright VA outcome flow`.

### Task 8.3: Candidate build + swap

**Files:** Use `scripts/sigos/` candidate build/swap (formalize the worktree method).

- [ ] **Step 1:** Build candidate in the worktree; run `npm run verify` + db-invariants (on a clone of prod data) + Playwright on 3201 → all green.
- [ ] **Step 2:** Run backfill **dry-run** against prod DB; review from→to histogram; confirm conservation.
- [ ] **Step 3:** Apply additive migrations to prod (safety check passes); run backfill for real; run db-invariants on prod → 0 rows.
- [ ] **Step 4:** Atomic swap `.next` (or nginx flip), `pm2 restart signature-os`, curl `/api/_health` → ok. Keep previous release for rollback.
- [ ] **Step 5:** Commit + tag `cc-rebuild-live`. Tell Nelson with evidence (test output + invariant 0-rows + health ok).

### Task 8.4: Contract phase (later, separate window)

- [ ] Stop-write `queueType` confirmed in code → drop `QueueType` column via `.approved-destructive.` migration after a soak period. NOT bundled with cutover.

---

## Self-review (spec coverage)

- No lead lost → Tasks 2.3, 3.2, 8.1 (property + DB invariant). ✓
- Single source of truth (callStatus) → Phase 1–4; queueType stop-write 4.2, drop 8.4. ✓
- Outcome→transition+email table → 2.2. All four emails kept → outbox 5.1 maps gatekeeper/callback/send_info/site_visit. ✓
- Idempotency → 4.1/4.2; lock → 4.3. ✓
- Observable emails (no false sent) → 5.1; visibility → 5.2. ✓
- UK-tz + future-validation → 2.1/2.2/6.1. ✓
- Migration no data loss → 7.1/7.2 + conservation test + 8.1 invariants. ✓
- Drop dialler → 7.3. VA scoping uniform → 6.1/7.4. ✓
- Built via candidate + swap, evidence before done → Phase 0 + 8.3. ✓
- Booked = terminal, handed to ops → 2.2 (callStatus booked, nextCallAt null, push to Nick retained in 4.2 post-commit). ✓

## Execution

Subagent-driven: fresh subagent per task in the candidate worktree, `npm run verify` green + commit between tasks, I review each diff. NOTHING swapped to live until Phase 8 all-green with evidence. Plan-gate already passed (Nelson approved spec #80 + said build).
