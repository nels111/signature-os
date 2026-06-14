# SigOS — Production-Readiness & Build Handoff for Jaz

**Owner:** Nelson (Signature Cleans)
**Prepared:** 14 June 2026
**Audience:** Jaz (AI build agent) + any human reviewer
**Repo:** Signature Cleans OS (SigOS) — Next.js 15 / Prisma 7 / PostgreSQL / NextAuth v5
**Live:** https://os.signature-cleans.co.uk (PM2, port 3200)
**Source of requirements:** Fireflies leadership call (9 Jun 2026) + full codebase audit (14 Jun 2026)

---

## 0. How to use this document

This is the single source of truth for getting SigOS from "mostly working" to **production-ready**. It is written so Jaz can execute top-to-bottom with minimal clarification.

Conventions:
- **[P0]** = blocks production / security or data-correctness risk. Do first.
- **[P1]** = important for a trustworthy daily-driver OS.
- **[P2]** = polish / scale / nice-to-have.
- Every task has: **What**, **Why**, **Where** (real file paths), and **Acceptance criteria** (how to know it's done).
- Each `- [ ]` is a checkbox — tick as you complete.
- **Rule:** read the file before editing it. Run `npm run build` after each change. Never hard-delete data (soft-delete via `deletedAt`). Never expose internal error details to clients.

Definition of "production ready" (the bar we are aiming for):
1. Builds cleanly on the deployment Node version with zero type errors.
2. No unauthenticated money-spending or data-writing endpoints.
3. Every displayed number is provably correct and traceable to its source.
4. All secrets are in env/secret store, none in source.
5. Automated tests cover the critical money paths (auth, quotes, pipeline, cold-calling, billing/hours).
6. Errors are logged centrally and surfaced to users gracefully.
7. The features agreed in the 9 Jun call are shipped and verified.

---

## 1. System overview

### 1.1 Stack
- **Framework:** Next.js 15 (App Router), React 19, TypeScript strict.
- **DB/ORM:** PostgreSQL + Prisma 7 (`prisma/schema.prisma`, 1,201 lines).
- **Auth:** NextAuth v5 (Credentials provider, JWT strategy) — `src/lib/auth.ts`.
- **Styling:** Tailwind CSS 4 + CSS custom properties in `src/app/globals.css`.
- **Integrations:** Twilio (voice + WhatsApp), OpenAI (website agent + audit summarisation), IMAP/SMTP (IONOS email), Dropbox (hours sheet + client folders), Connecteam (time clocks/shifts), Fireflies (meeting transcripts), Web Push (VAPID).
- **Process mgr:** PM2 (`ecosystem.config.js`), nginx + Let's Encrypt in front.

### 1.2 Repo map (the parts that matter)
```
src/app/api/            88 route handlers (REST-ish)
src/app/dashboard/      28 dashboard pages/modules
src/lib/                business logic (auth, authz, cold-calling, quotes, integrations)
src/lib/schemas/        zod validation schemas
src/middleware.ts       auth + role gating + CSRF + API-key
prisma/schema.prisma    full data model
prisma/seed.ts          seed data
tests/e2e/              Playwright smoke tests
```

### 1.3 Modules present today
Dashboard, Sales/Ops drill-downs, Contacts, Accounts, Leads, Deals, Pipeline (Kanban), Tasks, Calendar, Emails (iOS-mail style), Quotes (docx→pdf), Contracts/Sites, Financials, Health (RAG), Growth tracker, Operatives, Compliance, Cold-calling (Twilio), Clients portal + Audits + Tickets + Service Requests, Hub, Settings, VA dashboard + VA-hours, Public website AI agent.

---

## 2. Environment & deployment readiness  **[P0]**

These are hard blockers. The app currently will not install/build cleanly in a fresh environment.

- [ ] **[P0] Node version mismatch breaks install/build.** Prisma 7's `@prisma/streams-local@0.1.2` requires `node >= 22`; the box is on Node 20 and `yarn install` aborts with *"The engine 'node' is incompatible."*
  - **Fix:** pin the runtime to **Node 22 LTS** everywhere (local, CI, PM2 host). Add an `.nvmrc` (`22`) and `"engines": { "node": ">=22" }` to `package.json`. Re-run a clean install and `npm run build`.
  - **Acceptance:** `node -v` ≥ 22 on the server; `npm ci && npm run build` succeeds with zero errors.

- [ ] **[P0] `.env` is missing and `.env.example` is incomplete.** Code references **35 env vars**; `.env.example` documents only ~12. Undocumented-but-required: `OPENAI_API_KEY`, all `TWILIO_*` (8 vars), `VAPID_PRIVATE_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_SUBJECT`, `SMTP_USER` / `SMTP_PASS`, `CONNECTEAM_API_KEY`, `DROPBOX_APP_KEY` / `DROPBOX_APP_SECRET` / `DROPBOX_REFRESH_TOKEN`, `ELEVENLABS_API_KEY`, `NOTIFICATION_EMAIL*`, `NICK_WA_NUMBER`, `CLIENT_PORTAL_URL` / `NEXT_PUBLIC_PORTAL_URL`, `TWILIO_SKIP_SIGNATURE_VALIDATION`.
  - **Fix:** regenerate `.env.example` to list **every** var grouped by integration with a one-line description and where to obtain it. Add a startup assertion that fails fast if a required var is missing (a small `src/lib/env.ts` that validates with zod on boot).
  - **Acceptance:** `.env.example` is a complete superset of `grep -rhoE 'process\.env\.[A-Z_0-9]+' src | sort -u`; app refuses to boot with a clear message if a required var is absent.

- [ ] **[P0] Reproducible deploy.** There is no documented one-command deploy and the `ecosystem.config.js` `cwd` is hardcoded to `/var/www/signature-cleans-os`.
  - **Fix:** document the full deploy runbook (install → `prisma migrate deploy` → `prisma generate` → `next build` → `pm2 reload`). Add a `scripts/deploy.sh`. Confirm `prisma migrate deploy` (not `db push`) is used in prod and that all migrations in `prisma/migrations/` are committed and in order.
  - **Acceptance:** a clean checkout can be deployed by running one documented script; migration state matches schema (`prisma migrate status` clean).

- [ ] **[P1] Database backups + migration safety.** Confirm automated daily Postgres backups (pg_dump to off-box storage) and a tested restore. Confirm a `SHADOW_DATABASE_URL` exists for safe `migrate dev`.
  - **Acceptance:** a documented, tested backup+restore; at least one successful restore drill recorded.

- [ ] **[P1] Health & readiness probes.** `/api/health` exists — verify it checks DB connectivity (not just returns 200) and wire PM2/uptime monitoring + alerting (e.g. email/WA on down).
  - **Acceptance:** `/api/health` returns 503 if DB is unreachable; an external monitor alerts within 5 min of downtime.

---

## 3. Security audit  **[P0/P1]**

Grounded in the actual code. These are the highest-risk items found.

- [ ] **[P0] The public AI agent endpoint is unauthenticated AND unthrottled.** `src/app/api/agent/chat/route.ts` is `/api/agent/*`, which `src/middleware.ts` (lines ~126–129) **exempts from all auth and CSRF** so the public website can call it. The route's own comment claims *"Rate-limited by IP via middleware"* — **but the middleware has no rate limiting**. The endpoint: calls OpenAI (real cost per request), creates `Lead` + `CalendarEvent` rows, and fires WhatsApp messages via Twilio (real cost). Anyone can POST in a loop to: drain the OpenAI/Twilio budget, flood the CRM with fake leads/site visits, and spam Nelson/Nick's phones. It also reflects CORS origin (`Access-Control-Allow-Origin: origin || '*'`), so it's callable from any site.
  - **Fix:** add strict per-IP rate limiting on this route (e.g. 5–10 msgs/min/IP, and a daily cap), a global daily spend ceiling, and bot mitigation (Cloudflare Turnstile/hCaptcha token verified server-side, or a signed widget token). Lock CORS to `https://signature-cleans.co.uk` (+ `www`) only, not reflected. Add input length caps and an OpenAI cost guard (max tokens already 600 — also cap conversation length, already sliced to 20). De-dupe lead creation (same phone/email within N minutes → update, not insert).
  - **Acceptance:** scripted 100 rapid requests from one IP get 429 after the limit; CORS preflight from an unknown origin is rejected; no duplicate leads created from a burst.

- [ ] **[P0] Prompt-injection / tool-abuse on the agent.** The agent has `book_site_visit` and `create_lead` tools callable purely from chat text. A malicious visitor can coerce arbitrary calendar/lead writes and WA blasts.
  - **Fix:** validate tool arguments server-side with zod (email/phone format, datetime in business hours and within N days, company/name length). Rate-limit *bookings* separately (e.g. max 2 bookings per session/IP/day). Never trust model output for anything irreversible without server validation.
  - **Acceptance:** invalid datetimes/emails are rejected before any DB write; booking spam is capped.

- [ ] **[P0] Hardcoded production identifiers & personal mobile numbers in source.** `agent/chat/route.ts` hardcodes `NELSON_USER_ID`, `NICK_USER_ID` UUIDs and `NELSON_WA = '+447901260244'` / `NICK_WA` fallback `+447890266882`. These are brittle (break on DB reseed) and leak PII into the repo/git history.
  - **Fix:** move to env (`AGENT_OWNER_USER_ID`, `NELSON_WA_NUMBER`, `NICK_WA_NUMBER`) or look up by role/email at runtime. Audit git history; rotate anything sensitive.
  - **Acceptance:** no personal phone numbers or hardcoded UUIDs in `src/`.

- [ ] **[P1] Twilio webhook signature can be globally disabled by env.** `TWILIO_SKIP_SIGNATURE_VALIDATION=true` bypasses verification in `webhooks/twilio/{voice,status,recording}`. If ever set in prod, anyone can forge call/recording webhooks.
  - **Fix:** make the skip flag a no-op when `NODE_ENV==='production'` (force validation in prod regardless of the flag). Log loudly if the flag is set in prod.
  - **Acceptance:** in production, a request without a valid `X-Twilio-Signature` is always rejected, even with the flag set.

- [ ] **[P1] In-memory rate limiter is not production-grade.** `src/lib/rate-limit.ts` is a per-process `Map`. It resets on every deploy/restart and is not shared across PM2 instances. Login throttling keys on **email only** (no IP), so an attacker can rotate emails to dodge it (`src/lib/auth.ts`).
  - **Fix:** move rate limiting to Redis (or Postgres with a TTL table) so it is shared and durable. Add IP-based throttling to login in addition to email. Consider account lockout + alert after N failures.
  - **Acceptance:** rate limits persist across restart and apply cluster-wide; brute-force from one IP across many emails is throttled.

- [ ] **[P1] CSP allows `unsafe-inline` and `unsafe-eval` for scripts.** `next.config.ts` CSP `script-src 'self' 'unsafe-eval' 'unsafe-inline'` substantially weakens XSS defence.
  - **Fix:** move to nonce/hash-based CSP and drop `unsafe-eval`/`unsafe-inline` for scripts where Next 15 allows. At minimum, document why each is needed and tighten over time.
  - **Acceptance:** CSP no longer permits arbitrary inline script, or a documented, minimal exception list exists.

- [ ] **[P1] Stored mailbox credentials / secret-at-rest.** IMAP/SMTP passwords are stored on user records (per PROGRESS.md) and used in `src/lib/imap.ts` / `src/lib/smtp.ts`. Confirm they are encrypted at rest (not plaintext columns) and access-controlled.
  - **Fix:** encrypt sensitive columns (app-level envelope encryption with a key in env, or pgcrypto). Ensure these fields are never returned by any API (`/api/users`, `/api/settings`).
  - **Acceptance:** DB dump shows ciphertext for mailbox passwords; no endpoint returns them.

- [ ] **[P1] Authorization is broad ("small-team model").** `src/lib/authz.ts` lets *any* authenticated user CRUD most CRM entities; only `ownerId` reassignment is admin-gated, and only some routes call `requireRole`. As the team grows (franchisees!) this is too loose.
  - **Fix:** define a role→capability matrix and enforce it consistently in every route (not just middleware path prefixes). Especially gate: financials, operatives, settings, user management, cross-franchise data. Add tests per role.
  - **Acceptance:** a documented permission matrix; automated tests assert each role can/can't hit each sensitive route.

- [ ] **[P1] Dependency & supply-chain scan.** `xlsx` is pulled from the SheetJS CDN tarball (the npm build had CVEs). Run a full audit.
  - **Fix:** `npm audit` / `osv-scanner`; pin and patch. Confirm the SheetJS CDN version is the patched line and document why it's not from npm.
  - **Acceptance:** no high/critical advisories unresolved; rationale documented for any exception.

- [ ] **[P2] Secret hygiene & rotation.** Establish a rotation policy for `AUTH_SECRET`, `API_KEY`, Twilio, OpenAI, Dropbox, IONOS. Confirm `.env` is gitignored (it is) and never committed historically (`git log -p -- .env`).
  - **Acceptance:** rotation runbook exists; git history clean of secrets.

---

## 4. Data accuracy & integrity  **[P0/P1]**

Trust is the product. If a number is wrong once, Nelson stops trusting the OS. The 9 Jun call explicitly flagged the **annual run rate**.

- [ ] **[P0] Verify the Annual Run Rate (ARR) shown on the dashboard.** `src/app/api/dashboard/route.ts` surfaces `hoursSheet.totals.annualValue` (from the Dropbox "Regular Hours Sheet" via `src/lib/dropbox-hours.ts`) and `monthlyEarnings`, while `src/app/api/growth/route.ts` computes its own `weeklyEarnings`/`monthlyEarnings`. **There are two independent earnings sources** (Dropbox sheet vs Prisma contracts) — they can disagree. Nelson asked to confirm the source and that it matches contract figures.
  - **Fix:** pick **one authoritative source** for revenue (recommend: the contract/site records in Postgres, since the sheet is manually maintained). Define ARR precisely: `Σ(active contract monthly value) × 12` (handle hourly vs monthly_fixed billing correctly, exclude pipeline/lost). Show the formula and "last verified" in a tooltip. Reconcile against the Dropbox sheet and list any deltas.
  - **Acceptance:** ARR on the dashboard equals the sum of active-contract values × 12, reproducible by hand from a contract export; a written note documents the definition and the source of truth.

- [ ] **[P1] Reconcile contracts ↔ hours sheet ↔ Connecteam.** Hours come from three places: Dropbox sheet (`dropbox-hours.ts`), Connecteam actuals (`connecteam-hours.ts`), and contract records. The Health/Financials/Growth pages mix these.
  - **Fix:** document the canonical pipeline (contracted hrs vs actual hrs vs billed value), and add a reconciliation view that flags mismatches > X%.
  - **Acceptance:** one page shows, per site: contracted hrs, actual hrs (Connecteam), billed value, margin — all from named sources, with discrepancy flags.

- [ ] **[P1] Money math correctness.** Audit quote pricing (`src/lib/quotes/`), margin (`/api/sites/[id]/margin`), and dashboard aggregates for rounding, currency (integer pence vs float), and monthly_fixed vs hourly handling. Floating-point money is a latent bug.
  - **Acceptance:** money stored/handled as integer minor units (pence) or `Decimal`; unit tests cover hourly + monthly_fixed + edge (zero hours, school-holiday weeks).

- [ ] **[P1] Caching staleness.** Dashboard caches hours 15 min and Connecteam 10 min in-process; growth/health have their own caches. After a deploy these reset; across instances they diverge.
  - **Fix:** show "data as of HH:MM" on every cached figure (some already do via `fetchedAt`); ensure all cached numbers display freshness; consider a shared cache.
  - **Acceptance:** every externally-sourced KPI shows its fetch timestamp.

---

## 5. Functional roadmap — from the 9 Jun leadership call  **[P1]**

These are the agreed product changes. Each is scoped with file pointers and acceptance criteria.

### 5.1 Dashboard — simplified marketing view
- [ ] **[P1] Build a simplified custom dashboard** focused on website/marketing funnel: **impressions, clicks, click-through rate, leads** (Jaz's action item from the call).
  - **Where:** new `src/app/dashboard/marketing/` page + `GET /api/marketing` route. Data source TBD — confirm whether metrics come from Google Search Console / GA4 / Meta Ads (needs API creds) or manual entry to start.
  - **Acceptance:** a clean page showing impressions, clicks, CTR, leads with a date range; numbers sourced from a named integration or a manual-entry model.
  - **Open question for Nelson:** which platform are impressions/clicks from (GSC, GA4, Google Ads, Meta)? Determines the integration.

### 5.2 Dashboard — ARR accuracy
- [ ] Covered in **§4 [P0]** above (verify annual run rate). This is the call's first dashboard action item.

### 5.3 Tasks — default to "not started"
- [ ] **[P1] Default the Tasks view to show only `not_started` tasks** so incoming work is prioritised.
  - **Where:** `src/app/dashboard/tasks/TasksPage.tsx` — `filterStatus` initialises to `''` (all). Change default to `'not_started'` and reflect it in the filter UI; keep an "All" option.
  - **Acceptance:** opening Tasks shows only not-started by default; user can switch to All/other statuses; the choice is sensible across `business`/`personal` tabs.

### 5.4 Pipeline — auto-advance stages
- [ ] **[P1] Auto-update lead/deal pipeline stages from meeting attendance and call outcomes.**
  - **Where:** lead stages live in `prisma/schema.prisma` (`LeadStage`: `new_lead → contacted → meeting_scheduled → meeting_attended → quote_delivered → negotiating → won …`). Cold-call outcomes already move stages (`src/lib/cold-calling/outcome-rules.ts`). Hook calendar attendance: when a `meeting`/site-visit event passes and is marked attended, advance the linked lead `meeting_scheduled → meeting_attended`. When a quote is sent (`/api/quotes/[id]/send`), advance to `quote_delivered`.
  - **Acceptance:** completing a call outcome, marking a meeting attended, and sending a quote each move the linked lead/deal to the correct next stage automatically, with an activity-log entry.

### 5.5 Pipeline — cold calling uses the pipelines (Sam)
- [ ] **[P1] Ensure cold-calling drives the lead/deal pipeline** (Sam updates outcomes; leads move through stages).
  - **Where:** `src/lib/cold-calling/` + `src/app/dashboard/cold-calling/`. Largely built — verify outcome→stage mapping is complete and that callbacks/follow-ups surface in the pipeline view.
  - **Acceptance:** a cold call logged by Sam updates the lead stage and appears correctly in `/dashboard/pipeline`.

### 5.6 CRM — remove/archive the "Accounts" tab
- [ ] **[P1] Temporarily remove the Accounts tab from the CRM** (archive, don't delete — pending future review).
  - **Where:** `src/components/layout/Sidebar.tsx` line ~38 (`{ href: '/dashboard/accounts', label: 'Accounts' … }`). Hide the nav item behind a feature flag (e.g. `ENABLE_ACCOUNTS=false`) rather than deleting the route/data. Keep `/api/accounts` and the table intact.
  - **Acceptance:** Accounts no longer appears in the sidebar; data and routes remain; re-enabling is a one-line flag flip.

### 5.7 Zoho → SigOS migration
- [ ] **[P1] Migrate active client contacts and the active deal pipeline from Zoho CRM**; start leads fresh.
  - **Where:** there's prior art (`scripts/zoho-to-sigos.py` referenced in PROGRESS.md, and a `/api/leads/import` route). Build/confirm a repeatable importer: contacts (active clients first), deals (active pipeline only), de-dupe on email/company, map Zoho stages → SigOS `LeadStage`/`DealStage`.
  - **Acceptance:** a dry-run import report (counts, dupes, unmapped stages) then a live import; active clients + open deals present in SigOS; no leads carried over (fresh start).
  - **Open question for Nelson:** provide the Zoho export (CSV/API token) and confirm which deals count as "active."

### 5.8 Calendar — location, notes, map links
- [ ] **[P1] Add location + notes to calendar events and tasks, with live map links.**
  - **Where:** `prisma/schema.prisma` `model CalendarEvent` has `notes` but **no `location` field** — add `location String?` (+ optional `lat/lng` or just build a Google/Apple Maps URL from the address string). Surface in calendar create/edit UI and event detail; render a "Open in Maps" link. Add the same to Tasks if a location is relevant.
  - **Acceptance:** an event can store an address; the detail view shows it with a working map link; site-visit events created by the agent include location.

### 5.9 Calendar — Calendly sync
- [ ] **[P1] Link Calendly with the OS calendar for site-visit scheduling** (block out times, two-way sync).
  - **Where:** new integration. Use Calendly API + webhooks: on `invitee.created`, create a `CalendarEvent` (type `meeting`, location from Calendly Q&A); push OS busy times to Calendly as availability blocks (or use Calendly's "add buffer/limit" + a one-way busy feed).
  - **Acceptance:** booking via Calendly creates a matching OS event with location/notes; OS-busy times prevent double-booking.
  - **Open question for Nelson:** Calendly account/API access + which event types map to site visits.

### 5.10 Email — selective thread tracking + iOS polish
- [ ] **[P1] Selective email-thread tracking linked to leads/deals** (track only relevant threads; keep general email in external clients to reduce clutter).
  - **Where:** emails already auto-link by sender (PROGRESS.md), and `/api/emails/[id]` returns linked entity data. Add a "Track this thread on [Lead/Deal]" toggle and a manual link/unlink UI (already listed as a future item). Only tracked threads show in the CRM record timeline.
  - **Acceptance:** a user can pin/track a thread to a lead/deal; the lead/deal page shows tracked threads; untracked mail doesn't clutter the CRM.
- [ ] **[P2] Continue iOS-Mail UX parity** per `IOS-MAIL-REBUILD-PLAN.md` (most done; verify swipe/threads/pull-to-refresh on real iPhone).

### 5.11 Franchisee dashboards
- [ ] **[P1] Franchisee dashboards + central oversight reporting** (each franchise sees its own performance; HQ sees all).
  - **Where:** sizeable feature. Needs a `Franchise`/`Region` entity, a `franchiseId` on users/contracts/leads/operatives, row-level scoping in every query, and a `franchisee` role. Then per-franchise dashboard + an HQ roll-up.
  - **Acceptance:** a franchisee user sees only their franchise's data; an admin sees a roll-up across franchises; data isolation is enforced and tested.
  - **Note:** this is the largest item and the strongest reason to fix authorization (§3) and tighten the data model first. Recommend a short design doc before building.

### 5.12 Non-dev items (for awareness, not Jaz)
- School of Excellence tutorial videos (cold-calling + workflows) — content task for Jazz/Nelson.
- 6 Jan→date business-performance snapshot report — can be a one-off export from the OS once ARR is verified.

---

## 6. Module-by-module gap checklist  **[P1/P2]**

Quick pass to make each module trustworthy. For each: empty states, loading states, error states, pagination, validation, mobile layout, and "no fake data."

- [ ] **Dashboard** — verify every tile's source; remove any placeholder numbers; freshness timestamps.
- [ ] **Cold-calling** — confirm queue counts, callable logic, callback scheduling, Twilio token cost caps, recording storage/retention + GDPR (call recording consent!).
- [ ] **Quotes** — docx→pdf rendering on the server (libreoffice dependency present?), tracking pixel privacy, resend/clone correctness, no hours leaked to client output (hard rule).
- [ ] **Emails** — IMAP sync resilience (reconnect/backoff), attachment handling/AV scanning, large-mailbox performance (3,600+ emails), DOMPurify on all rendered bodies (present).
- [ ] **Contracts/Sites/Health/Financials** — margin math, monthly_fixed handling, Connecteam timeouts → graceful "live data unavailable."
- [ ] **Operatives/Compliance** — DBS/insurance/right-to-work expiry tracking + reminders; ensure no PII over-exposure.
- [ ] **Client portal + Audits + Tickets + Service requests** — auth isolation (a client can only see their own data — verify `clients/[id]` ownership checks), invite flow security.
- [ ] **Calendar/Tasks** — recurring events correctness (`src/lib/recurring.ts`), timezone (Europe/London) consistency, invite notifications.
- [ ] **Notifications/Push** — VAPID keys configured, scheduler endpoint protected, no duplicate sends.
- [ ] **Settings/Users** — never return password/secret columns; admin-only; audit log of changes.

---

## 7. Code quality & hygiene  **[P1/P2]**

- [ ] **[P1] Remove committed scratch/temp scripts from the repo root.** 17 `*-tmp.mjs` / `*temp*.mjs` / `*-tmp.ts` diagnostic files are committed (e.g. `check-contracts-temp.mjs`, `diag-jobs-tmp.mjs`, `smoke-sync-tmp.mjs`, `bulk-fix-tmp.mjs`…). Also `generated-quotes/*.pdf` test artefacts.
  - **Fix:** move genuinely useful ones into `scripts/` with real names; delete the rest; gitignore `generated-quotes/`.
  - **Acceptance:** repo root has no `*-tmp.*`/`*temp*` files; build output and generated PDFs are gitignored.
- [ ] **[P1] Resolve TODO/FIXME/placeholder/mock markers.** ~97 occurrences across `src`. Triage: each is either fixed, ticketed, or deleted.
  - **Acceptance:** a tracked list; no silent mocks in production paths (especially anything returning fake KPIs).
- [ ] **[P1] Turn ESLint back on for builds.** `next.config.ts` sets `eslint: { ignoreDuringBuilds: true }`. This hides real issues.
  - **Fix:** fix lint errors and remove the ignore (or scope it). Enforce in CI.
  - **Acceptance:** `npm run lint` is clean and runs in CI on every PR.
- [ ] **[P2] TypeScript strictness.** CLAUDE.md says "no `any`" — verify with `tsc --noEmit` and a no-`any` lint rule.
- [ ] **[P2] Consolidate duplicated logic.** Multiple in-memory caches and earnings calculations are copy-pasted across routes — extract to `src/lib/`.

---

## 8. Testing strategy  **[P0/P1]**

Currently only Playwright smoke tests (`tests/e2e/`, ~34 cases). For an OS handling money and client data, this is thin.

- [ ] **[P0] Critical-path E2E coverage:** login (each role), create/convert lead→deal, generate+send quote, cold-call outcome→stage move, mark meeting attended→stage move, dashboard ARR renders correctly, client-portal isolation.
- [ ] **[P1] Unit tests for money/logic:** quote pricing, margin, ARR, hours reconciliation, cold-call queue bucketing, recurring events.
- [ ] **[P1] API contract/authz tests:** every sensitive route returns 401/403 for the wrong role; CSRF/origin checks; agent endpoint rate limit.
- [ ] **[P1] CI pipeline:** run typecheck + lint + unit + smoke on every PR; block merge on failure.
- [ ] **[P2] Seed/fixture data** for a reliable test DB; document `prisma db seed`.
  - **Acceptance:** green CI; the seven critical paths above are covered and run automatically.

---

## 9. Observability & operations  **[P1]**

- [ ] **[P1] Centralised error tracking** (Sentry or similar) on both server and client — replace bare `console.error` (used throughout) with structured capture. Currently errors only hit PM2 logs.
- [ ] **[P1] Structured request logging** with correlation IDs; redact secrets/PII.
- [ ] **[P1] Integration failure alerting:** Dropbox/Connecteam/Twilio/OpenAI/IMAP failures currently log-and-continue silently (e.g. dashboard returns `null` sections). Alert when a critical integration is down so KPIs aren't quietly stale/zero.
- [ ] **[P2] Uptime + cost dashboards** for OpenAI/Twilio spend (tie into the agent rate-limit work in §3).
  - **Acceptance:** an exception in any route surfaces in Sentry with context; a failed nightly Connecteam sync raises an alert.

---

## 10. Performance & scalability  **[P2]**

- [ ] **[P2] DB indexing review** for hot queries (leads by stage/owner, emails by mailbox/date, activities by entity). Add composite indexes; confirm `deletedAt` is indexed where filtered.
- [ ] **[P2] Pagination everywhere** (CLAUDE.md mandates it) — verify list endpoints cap page size and don't `findMany` unbounded (emails especially).
- [ ] **[P2] Shared cache** (Redis) to replace per-process in-memory caches for dashboard/growth/health and rate limiting.
- [ ] **[P2] N+1 review** on dashboard and pipeline aggregates.

---

## 11. Accessibility, UX & mobile  **[P2]**

- [ ] **[P2] Mobile QA** on real iPhone (PWA install, safe-area insets, email swipe, growth/health/pipeline layouts — several were rebuilt for mobile already; verify).
- [ ] **[P2] A11y pass:** keyboard nav on Kanban and modals, focus rings (design system has `focus-brand`), colour contrast for the brand tokens, ARIA on interactive widgets, `data-testid` coverage for test automation.
- [ ] **[P2] Loading/empty/error states** consistent across modules (some modules have skeletons, others may not).

---

## 12. Recommended execution order (sprints)

**Sprint 0 — Make it deployable & safe (P0, ~2–3 days)**
1. Node 22 + clean install + green build (§2).
2. Complete `.env.example` + boot-time env validation (§2).
3. Lock down the public agent endpoint: auth/captcha + rate limit + CORS + tool validation + de-dupe (§3).
4. Force Twilio signature validation in prod (§3).
5. Verify & fix the Annual Run Rate; pick a single revenue source of truth (§4).
6. Remove temp scripts, turn ESLint on in CI (§7).

**Sprint 1 — Trust & quick wins (P1, ~3–4 days)**
7. Tasks default → not_started (§5.3).
8. Remove/flag Accounts tab (§5.6).
9. Auto-advance pipeline stages (§5.4) + verify cold-calling pipeline (§5.5).
10. Calendar location + map links (§5.8).
11. Money-math unit tests + critical-path E2E + CI (§8).
12. Redis-backed rate limiting + IP login throttle (§3).

**Sprint 2 — Integrations & data (P1, ~1 week)**
13. Zoho migration importer + dry-run + live import (§5.7).
14. Marketing dashboard (after confirming data source) (§5.1).
15. Calendly two-way sync (§5.9).
16. Email selective thread tracking + manual link UI (§5.10).
17. Sentry + integration alerting (§9).
18. Hours/contract/Connecteam reconciliation view (§4).

**Sprint 3 — Franchise & scale (P1/P2, design-first)**
19. Franchise data model + role + row-level scoping (§5.11) — write a short design doc first.
20. Franchisee dashboards + HQ roll-up.
21. Authorization matrix hardening + per-role tests (§3).
22. Performance/indexing/caching pass (§10), a11y/mobile QA (§11).

---

## 13. "Production ready" acceptance checklist (sign-off gate)

- [ ] Builds on Node 22 with zero type/lint errors; CI green.
- [ ] No unauthenticated endpoint can spend money or write business data (agent locked down).
- [ ] Twilio webhooks always verified in prod; secrets only in env; no PII/UUIDs/phone numbers in source.
- [ ] Annual Run Rate (and all headline KPIs) provably correct from a single source of truth, with freshness timestamps.
- [ ] Rate limiting is durable + cluster-wide; login throttled by IP and email.
- [ ] Automated tests cover login (per role), lead→deal→quote, cold-call stage moves, client-portal isolation, ARR render.
- [ ] Error tracking + downtime/integration alerting live; DB backups tested with a restore drill.
- [ ] 9 Jun call items shipped: tasks default, Accounts archived, pipeline auto-advance, calendar location/maps, Zoho migration, marketing dashboard, email thread tracking. (Calendly + franchisee dashboards may be a follow-on release — agree scope with Nelson.)
- [ ] Repo clean: no temp scripts, no committed build artefacts, ESLint enforced.

---

## 14. Open questions for Nelson (unblock these for Jaz)

1. **Marketing metrics source** — Google Search Console, GA4, Google Ads, or Meta? (Determines the impressions/clicks/CTR integration.)
2. **Zoho export** — provide CSV export or API token; define "active deal."
3. **Calendly** — account/API access; which event types are site visits.
4. **Revenue source of truth** — confirm we treat Postgres contract records (not the Dropbox sheet) as canonical for ARR.
5. **Franchise model** — confirm the entity shape (region vs franchise), roles, and what HQ vs franchisee each sees, before building §5.11.
6. **Node/runtime** — confirm we can move the production host to Node 22 LTS (required by Prisma 7).

---

## 15. Blast-radius / downstream-impact analysis  **[READ BEFORE EDITING]**

This codebase is **highly coupled** (36 models/enums, 88 API routes). The single biggest risk to "production ready" is a well-intentioned edit that silently breaks something three modules away. For every change below, the table gives **what it touches** and the **safe sequence**. Jaz must run a `grep` for consumers before editing any shared file or schema field.

> **Golden rule — expand then contract.** Never remove/rename a column, enum value, or API field in the same release that changes the code using it. Add the new thing → migrate data → switch readers → deprecate → remove in a *later* release. This keeps every deploy rollback-safe.

### 15.1 Removing the "Accounts" tab (§5.6) — **schema is load-bearing**
- **Downstream:** `accountId` is a **foreign key on 4 core models** — `Contact` (schema L348), `Lead` (L385), `Deal` (L456), `Quote` (L643), each with an `@@index`. ~28 files reference Account (all CRM routes, schemas in `src/lib/schemas/*`, dashboard `totalAccounts` count, `twilio-wa.ts`, audits). `Site.clientAccountId` is a *different* relation (to `ClientAccount`) — do not confuse them.
- **Safe path:** **navigation-only change.** Hide the sidebar link + route behind `ENABLE_ACCOUNTS=false`. **Do NOT** drop the table, the `accountId` columns, or the relations — that would break Quotes, Deals, Contacts and Leads. Dashboard still counts accounts (harmless). Re-enable = flip the flag.
- **Do not:** write a migration that removes Account or `accountId`. That is irreversible against live client data.

### 15.2 Changing the ARR / revenue source (§4) — **10 readers**
- **Downstream:** earnings/`annualValue` is read by `api/dashboard`, `api/growth`, `api/sites`, `api/sites/[id]`, `api/admin/sync-regular-hours`, and UI `DashboardContent`, `GrowthTracker`, `FinancialsDashboard`, `OpsContent`, `ContractDetailPage`.
- **Safe path:** keep the **API response shape identical**; change only the *source* of the numbers behind it. If you add a new canonical figure, add it as a **new additive field** (e.g. `arrFromContracts`) and migrate readers one at a time, rather than mutating `annualValue` in place. Show both during a transition period to prove parity, then retire the old one.
- **Trap:** the Dropbox sheet and the contract records will give different totals — decide the source of truth *first* (§14 Q4), or every page will tell a different story.

### 15.3 Auto-advancing pipeline stages (§5.4) — **writes ripple into 5 systems**
- **Downstream:** writing `Lead.stage` / `Deal.stage` triggers/affects: the `Activity` log (L750) — you must emit one; `Notification` (L709); cold-calling **queue bucketing** (`src/lib/cold-calling/queue.ts` reads stage to decide Fresh/Follow-up/Recycle); the Pipeline Kanban grouping (`PipelinePage.tsx`, `KanbanCard.tsx`); and dashboard `dealsByStage`.
- **Risks & safe path:**
  - **Idempotency:** guard against double-advance (e.g. webhook retries) — only advance if `currentStage` is the expected predecessor.
  - **Respect manual overrides:** never auto-move a lead a human deliberately set to `not_interested`/`foad`/`archived`. Encode allowed transitions in one place (`src/lib/cold-calling/outcome-rules.ts` already models this — extend it, don't fork the logic).
  - **Always log + notify** so the change is auditable and visible.
  - Wrap stage change + activity + notification in a **single Prisma transaction**.

### 15.4 Editing the `LeadStage` / `DealStage` enums — **DB migration + 5 code sites**
- **Downstream:** `LeadStage` carries **legacy values** (`cold_call`, `cold_email`, `linkedin`, `follow_up_sequence`, `dormant`, `bad_data`, `archived`, `foad`) still present on live rows. Referenced by `queue.ts`, `outcome-rules.ts`, `stats.ts`, `types.ts`, pipeline UI (stage order + colours), and the import/intake mappers (`leads/import`, `leads/intake`).
- **Safe path:** **add** new enum values freely (additive, low risk). To **remove/rename** one: (1) migrate all rows off it, (2) update every code site above, (3) update Kanban column config, (4) only then drop it — in a later release. Postgres enum value removal requires a migration and fails if any row still uses it.

### 15.5 Hardcoded UUIDs & reseeds (§3) — **2 routes break on reseed**
- **Downstream:** `NELSON_USER_ID` / `NICK_USER_ID` are hardcoded in **both** `api/agent/chat` and `api/leads/intake`. If the DB is reseeded or those users are recreated, both routes write to non-existent owners (FK error or orphaned leads), and **website bookings silently fail**.
- **Safe path:** resolve owner at runtime by **role/email lookup** (cached), or move IDs to env. Verify `prisma/seed.ts` doesn't also assume fixed IDs.

### 15.6 Adding `CalendarEvent.location` (§5.8) — **18 consumers, additive = safe**
- **Downstream:** 11 calendar UI files + `api/calendar`, `api/calendar/[id]`, `api/calendar/[id]/invite`, `api/dashboard`, `api/notifications/scheduler`, `api/agent/chat` (booking), `api/leads/[id]/book-visit`.
- **Safe path:** add `location String?` (nullable, additive) — **zero breakage**. Then surface it in `CalendarForm`, `EventDetailPanel`/`CalendarEventDetail`, and have the agent + book-visit routes populate it. **Coordinate with §5.9:** both Calendly and the website agent create site-visit events — add a `source`/external-id and **de-dupe** so one booking doesn't appear twice.

### 15.7 Swapping the rate limiter to Redis (§3) — **10 import sites, keep the signature**
- **Downstream:** `checkRateLimit` is imported by `auth.ts` + 9 routes (quotes generate/send/resend/track×2, emails, twilio/token, shifts/today).
- **Safe path:** keep the **exact function signature**; only change the internals. If it becomes async (Redis), update all 10 callers to `await` (most are already in async handlers). Add a feature flag to fall back to in-memory if Redis is down (fail-open vs fail-closed — decide per endpoint; login should fail-*closed*).

### 15.8 Encrypting mailbox passwords at rest (§3)
- **Downstream:** read in `src/lib/imap.ts` + `src/lib/smtp.ts` and the background email sync job; possibly shown in Settings.
- **Safe path:** add encrypted columns alongside, backfill-encrypt existing rows in a migration script, switch readers to decrypt, then drop the plaintext column (expand-then-contract). Ensure `api/users` / `api/settings` never serialise these fields.

### 15.9 Locking down the public agent endpoint (§3) — **the live website depends on it**
- **Downstream:** the **WordPress chat widget on signature-cleans.co.uk** calls `/api/agent/chat` (cross-origin). Tightening CORS to the marketing domain + adding a captcha/widget-token means the **website widget must be updated in the same window**, or the public chatbot goes dark.
- **Safe path:** stage it — add a signed widget token the website sends, deploy website + OS together, then clamp CORS. Test the live widget immediately after deploy.

### 15.10 Franchise scoping (§5.11) — **largest blast radius in the system**
- **Downstream:** **36 `ownerId`/`userId`/`assigneeId` references** and ~10 core models would gain a `franchiseId`. Every list/aggregate query (dashboard, pipeline, leads, deals, operatives, financials, health, emails) must filter by tenant. **A single forgotten filter = a cross-franchise data leak.**
- **Safe path:** **do not** sprinkle `where: { franchiseId }` across 88 routes by hand. Enforce isolation centrally — a **Prisma client extension / middleware** that injects the tenant filter automatically, and/or **Postgres Row-Level Security (RLS)** keyed off the session's franchise. Write a short design doc first; build a leak-test that asserts franchise A can never read franchise B. This is why §3 (authorization matrix) must land before this.

---

## 16. Enterprise-grade gaps  **[P1 unless noted]**

The items below are what separates "works for a small team" from "enterprise-grade / franchise-ready." Most are absent today.

### 16.1 Multi-tenancy & data isolation  **[P0 for franchise launch]**
- [ ] Choose isolation model: shared-schema + `franchiseId` + **Postgres RLS** (recommended) vs schema-per-tenant. Enforce centrally (§15.10).
- [ ] Tenant-scoping leak tests in CI (tenant A cannot read tenant B for every entity).

### 16.2 Identity, authN & authZ
- [ ] **MFA/2FA for admin & finance roles** (TOTP). NextAuth credentials currently single-factor.
- [ ] **SSO option** (Google Workspace / Microsoft Entra) for staff — reduces password risk, eases onboarding/offboarding.
- [ ] **Password policy + breach check** (min length, HaveIBeenPwned k-anonymity check on set).
- [ ] **Session management:** short-lived JWT + refresh, server-side revocation/"log out everywhere," idle + absolute timeout. Note: JWT bakes role at login, so **role/permission changes don't take effect until re-login** — document this and/or force re-auth on role change.
- [ ] **Full RBAC capability matrix**, least privilege, server-enforced on every route (not just middleware path prefixes).
- [ ] **Offboarding runbook:** disable user → revoke sessions → reassign owned records.

### 16.3 Audit & compliance logging  **[P1]**
- [ ] There is a business `Activity` log but **no immutable security audit trail.** Add an append-only log of: logins/failures, permission/role changes, data exports, deletions, admin actions, secret access, client-portal access. Tamper-evident (no update/delete), retained per policy.
- [ ] Surface an admin "audit log" view; ship logs to external storage/SIEM.

### 16.4 Data protection / GDPR (UK GDPR + DPA 2018)  **[P0 — legal]**
- [ ] **DSAR tooling:** export + erasure ("right to be forgotten") for a contact/lead/client across all tables, including emails and call recordings.
- [ ] **Retention policy** with automated purge: call recordings, email bodies, transcripts, soft-deleted rows (currently kept forever).
- [ ] **Call-recording compliance (UK):** inform callers recording is taking place (IVR/notice); secure storage; access controls; retention limit. Verify `webhooks/twilio/recording` storage + the `recordings/[sid]` access check.
- [ ] **Processor due diligence / DPAs:** Twilio, OpenAI, Dropbox, IONOS, Connecteam, Fireflies, Calendly. Confirm **EU/UK data residency** where required (esp. OpenAI — don't send unnecessary PII; the agent should minimise).
- [ ] **Public site:** privacy policy, cookie consent, and a clear notice that the chat is AI + how data is used.
- [ ] **PII minimisation in logs:** the Twilio verify code currently logs signatures/params on mismatch; ensure no PII/secrets in logs.

### 16.5 Encryption  **[P1]**
- [ ] TLS everywhere (have it via nginx/LE) + HSTS (present). Enforce DB connections over TLS.
- [ ] **Encryption at rest:** disk-level for Postgres + **column-level** for secrets (mailbox passwords, tokens) — §15.8.
- [ ] Centralised key management (env today → move to a secret manager, see 16.9).

### 16.6 Reliability, DR & BCP  **[P0]**
- [ ] Define **RPO/RTO** (e.g. RPO ≤ 24h, RTO ≤ 4h). Automated **daily encrypted offsite backups** + **tested restore drills** (recorded).
- [ ] **Single-instance risk:** one PM2 process on one box = SPOF. Plan for redundancy (≥2 instances behind nginx, managed Postgres with PITR).
- [ ] Documented incident-response + escalation runbook.
- [ ] **Graceful degradation:** integrations already fail-soft (return null) — make that *visible* (banners) and *alerted* (16.8), not silent.

### 16.7 CI/CD & environments  **[P1]**
- [ ] **Staging environment** mirroring prod (separate DB) — currently appears to be edit-on-prod.
- [ ] **CI pipeline:** typecheck + lint + unit + E2E + `npm audit` + migration-safety check, gating merge.
- [ ] **Deploy strategy:** zero-downtime (PM2 `reload`/blue-green), automated `prisma migrate deploy`, **one-click rollback** (code + migration down-path or forward-fix).
- [ ] **Migration safety:** never `db push` in prod; review every migration for locking/long-running operations on large tables.

### 16.8 Observability & alerting  **[P1]**
- [ ] **Error tracking** (Sentry) server + client; replace bare `console.error`.
- [ ] **Metrics + dashboards** (request rate/latency/error %, queue depths, integration health) — Grafana/hosted.
- [ ] **Uptime monitoring + on-call alerting** (down, error spikes, integration failures, **OpenAI/Twilio spend thresholds**).
- [ ] **Structured logs** with correlation IDs, shipped off-box, PII-redacted.

### 16.9 Secrets management  **[P1]**
- [ ] Move from on-disk `.env` to a **secret manager** (Doppler/Vault/AWS or GCP Secret Manager) with rotation + access audit.
- [ ] Boot-time validation (§2) and rotation runbook (§3).

### 16.10 Edge security  **[P1]**
- [ ] Put **Cloudflare (or equivalent) in front:** WAF, DDoS protection, bot management, **edge rate limiting** (defence-in-depth for the agent endpoint and login).
- [ ] Periodic **dependency + container scanning** and an annual **penetration test**.

### 16.11 Background jobs & schedulers  **[P1]**
- [ ] Current background work uses **in-process `setInterval`** (rate-limit cleanup; email DB-poll/IMAP sync; notifications scheduler). These **duplicate across PM2 instances** and **die on restart**.
- [ ] Move to a real job system: **BullMQ/Redis** or external cron hitting protected endpoints, with locking (one runner), retries, and idempotency. Especially: email sync, notification scheduler, Connecteam/Dropbox refresh, cadence sends.

### 16.12 Email & messaging deliverability  **[P1]**
- [ ] **SPF, DKIM, DMARC** for all outbound domains (quote sends, notifications) — or quotes land in spam.
- [ ] **Webhook idempotency:** Twilio retries webhooks; de-dupe on `CallSid`/`MessageSid` so call records and stage moves aren't doubled.
- [ ] Bounce/complaint handling for outbound email.

### 16.13 Performance & scale  **[P2]**
- [ ] **Connection pooling** (PgBouncer or the Prisma data proxy) — serverless/multi-instance Postgres connections will exhaust otherwise.
- [ ] Index review for tenant + hot filters (16.1/§10); enforce pagination caps (esp. emails: 3,600+ rows).
- [ ] **Load test** the agent endpoint and dashboard aggregates before franchise rollout.

### 16.14 Documentation & onboarding  **[P2]**
- [ ] Architecture overview, ERD, runbooks (deploy/restore/incident), API docs (OpenAPI for the Jaz API layer), and a "new developer in 1 hour" guide.

---

## 17. Data-model integrity issues  **[P1]**

Found in `prisma/schema.prisma` during the audit.

- [ ] **Inconsistent soft-delete.** Only **12** of ~30 models have `deletedAt`. CLAUDE.md mandates "never hard delete." Decide which entities need soft-delete (anything client/financial/CRM) and apply consistently; ensure **every read filters `deletedAt: null`** (easy to forget on new queries — consider a Prisma extension that applies it by default).
- [ ] **Legacy enum cruft.** `LeadStage` mixes current and legacy values (§15.4). Plan a data migration to consolidate (e.g. map `cold_call`/`cold_email`/`linkedin` → `contacted`) and retire the dead ones via expand-then-contract.
- [ ] **Referential actions.** Audit every relation's `onDelete` behaviour — confirm no accidental cascade-deletes (a deleted Account must not nuke Quotes/Deals) and no orphan rows. Most relations are optional (`accountId String?`) which is safer but can orphan.
- [ ] **Money types.** Confirm monetary fields are `Decimal`/integer-pence, never `Float` (§4).
- [ ] **Timezones.** Store UTC; render Europe/London consistently across calendar, shifts (Connecteam grace period), and reports. Verify no naive-local-time bugs around BST transitions.
- [ ] **Uniqueness/dedupe.** Add unique constraints / dedupe keys where business identity exists (e.g. lead by email+company) to prevent the agent and importers creating duplicates (§15.3, §15.9, §5.7).

---

## 18. Change-management protocol (how Jaz must work)  **[PROCESS]**

For **every** change, follow this loop:

1. **Read** the target file(s) fully before editing.
2. **Find consumers:** `grep -rn` the symbol/field/route you're about to change; check the §15 blast-radius notes.
3. **Plan migration** (if schema): write it expand-then-contract; never remove in the same release.
4. **Feature-flag** anything risky or user-visible (env flag) so it can be toggled off without a redeploy.
5. **Preserve contracts:** keep API response shapes backward-compatible; add fields, don't repurpose them.
6. **Transactionally** wrap multi-write operations.
7. **Test:** unit + the relevant E2E path; run `npm run build` (zero type errors) and the smoke suite.
8. **Deploy to staging first**, verify, then prod with a rollback plan.
9. **Monitor** error tracking + the affected KPI for 24h after release.
10. **Update this doc** (tick the checkbox, note the date).

**Never:** hard-delete data; remove a column/enum value in the same PR as the code change; `db push` in prod; commit secrets; trust LLM/tool output for irreversible writes without server-side validation; edit a shared lib without checking its consumers.

---

## 19. Quick dependency map (cheat-sheet)

| If you touch… | It can break… |
|---|---|
| `accountId` / Account schema | Contacts, Leads, Deals, Quotes (4 FKs), dashboard counts, audits |
| `/api/dashboard` or `/api/growth` response shape | 10 dashboard/financial UI + API readers |
| `Lead.stage` / `LeadStage` enum | cold-calling queue, outcome rules, stats, pipeline Kanban, importers, activity log, notifications |
| `checkRateLimit` signature | auth/login + 9 protected routes |
| `CalendarEvent` shape | 11 calendar UI files + 7 API routes + agent booking + Calendly |
| Hardcoded user UUIDs / reseed | website agent bookings, lead intake |
| `src/middleware.ts` exemptions | every route's auth/CSRF posture (agent, webhooks, quote tracking) |
| Adding `franchiseId` | every list/aggregate query in the app (data-leak risk) |
| `src/lib/auth.ts` (JWT claims) | role gating everywhere; requires user re-login to take effect |

---

*End of handoff. This is a living document — Jaz should tick boxes, add dates, and append new findings as the codebase evolves. Treat §15 (blast radius) and §18 (change protocol) as mandatory reading before any edit.*
