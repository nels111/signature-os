# SigOS Phase Build Progress

5 phases, each requires: Codex CLI audit + smoke tests (scripts/smoke-test.sh).
Rule: no phase starts without previous phase passing both gates.

## Phase Overview

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Site/contract detail pages | ✅ DONE |
| 2 | Live shifts widget on home | 🔨 IN PROGRESS |
| 3 | Contract health view (traffic lights) | ⏳ Pending |
| 4 | Operative profiles | ⏳ Pending |
| 5 | Pipeline Kanban | ⏳ Pending |

---

## Baseline (pre-Phase 1)

**Smoke test:** Run on 2026-05-21. Result: **24/24 PASS** (11.8s)
**Codex audit:** Not required at baseline.

---

## Phase 1: Site/Contract Detail Pages

**Goal:** Click a contract row in /dashboard/financials → dedicated contract page.

**Spec:**
- Route: `/dashboard/contracts/[id]`
- Content blocks:
  - Header: site name, client, cell tier (A/B/C), status badge
  - Billing card: rate type (hourly/monthly_fixed), sell rate, weekly revenue, monthly revenue, gross margin %
  - Hours card: contracted hrs/wk (from Regular Hours Sheet seed), actual hrs last 4 weeks (from Connecteam via `/api/sites/[id]/margin`)
  - Operative assignments: list of operatives with shift data (from Connecteam API)
  - Site pack status: placeholder with link to Dropbox (no data model yet — show as card with "No site pack on file" if empty)
  - Compliance docs: DBS, insurance, right-to-work — placeholder cards (data model TBD for Phase 4)
  - Audit history: placeholder (data model TBD for Phase 3)

**Files to create/modify:**
- `src/app/dashboard/contracts/[id]/page.tsx` (new)
- `src/app/dashboard/contracts/[id]/ContractDetailPage.tsx` (new)
- `src/app/api/sites/[id]/route.ts` — check what it returns, may need expanding
- `src/app/dashboard/financials/FinancialsDashboard.tsx` — update row onClick to navigate

**Edge cases to handle:**
1. Site ID not found → 404 with back button
2. Connecteam API timeout → show billing card only, hours card shows "Live data unavailable"
3. No margin data yet (ESTIMATED_RATE) → show clearly, link to edit
4. Monthly fixed site → display correctly (no hrs/rate confusion)
5. Mobile viewport — cards stack, no horizontal scroll

**Status:** ✅ DONE
**Build completed:** 2026-05-21
**Codex audit:** PASSED — 3 P1 fixed (gitignore auth state, role guards, migration), 4 P2 documented
**Smoke tests:** 27/27 PASS (15.2s)

---

## Phase 2: Live Shifts Widget

**Goal:** Replace static "Operatives Clocked" stat card with live drillable feed of who's clocked in, overdue, upcoming.

**Spec:**
- API: `GET /api/shifts/today` (admin/operations only, 90-sec in-memory cache)
  - Queries 3 schedulers (`6814169`, `15165164`, `16197755`) for today's published shifts
  - Cross-references time-clock activities (`6814166`) to determine status
  - Returns `ShiftEntry[]` sorted: overdue → clocked_in → upcoming → completed
  - London timezone, 5-minute grace period, excludes Carina/Charlie/Nick/Nelson
- Component: `src/components/LiveShiftsWidget.tsx`
  - Auto-refreshes every 2 minutes
  - Filter chips: All / In / Overdue / Due / Done
  - Row: 32px avatar (initials/✓), name, job, time, clock-in status, lateness
  - "+Xmin" late indicator, show more/less (6 default), pulsing dot for overdue
  - Loading skeleton (3 rows), footer with last-updated timestamp
- Integration: Added to `DashboardContent.tsx` Ops section below ContractList

**Files created/modified:**
- `src/app/api/shifts/today/route.ts` (new)
- `src/components/LiveShiftsWidget.tsx` (new)
- `src/app/dashboard/DashboardContent.tsx` (modified — added LiveShiftsWidget)
- `tests/e2e/smoke.spec.ts` (modified — +2 Phase 2 tests)

**Status:** ✅ DONE
**Build:** PASS (clean, no TypeScript errors)
**Smoke tests:** 32/32 PASS (20.6s)
**Codex audit:** PASSED — 2 P1 fixed (key parse fragile, error message leak), 6 P2 documented

---

## Phase 2b: Dashboard Navigation Redesign

**Goal:** Two-level navigation — home shows summary tiles, tap Sales/Ops to drill into full detail with mobile card layout.

**Spec:**
- Home `/dashboard`: Two big tappable tiles (Sales + Ops). Sales tile shows pipeline value + leads/deals/quotes count. Ops tile shows hrs/wk + contracts/revenue/operatives + mini progress bar. Chevron on right.
- Sales detail `/dashboard/sales`: Back nav, 4 stat cards, pipeline stage breakdown with value bars, quick links
- Ops detail `/dashboard/ops`: Back nav, growth bar, 8 stat cards, ContractList, LiveShiftsWidget (card layout)
- LiveShiftsWidget rebuilt as kanban cards: left-edge colour strip (green/red/amber/grey), 36px avatar, name + job + time + status detail, responsive grid (`auto-fill minmax 220px`)

**Files created/modified:**
- `src/components/LiveShiftsWidget.tsx` (rebuilt — card grid layout)
- `src/app/dashboard/sales/page.tsx` (new)
- `src/app/dashboard/sales/SalesContent.tsx` (new)
- `src/app/dashboard/ops/page.tsx` (new)
- `src/app/dashboard/ops/OpsContent.tsx` (new)
- `src/app/dashboard/DashboardContent.tsx` (modified — section tiles replace flat grids)
- `tests/e2e/smoke.spec.ts` (modified — +4 Phase 2b tests)

**Status:** ✅ DONE
**Build:** PASS (clean)
**Smoke tests:** 32/32 PASS (19.8s)
**Codex audit:** PASSED (same session as Phase 2 — no additional P1s)

---

## Phase 3: Contract Health View

**Goal:** RAG traffic light view across all contracts. At a glance: which are healthy, which need attention, which are at risk.

**Spec:**
- Route: `/dashboard/health`
- API: `GET /api/health` — batch fetches all sites + current week hours in one pass, 5-min cache
- Health status logic:
  - 🟢 Green: `rateConfirmed = true` AND `grossMarginPct >= 30`
  - 🟡 Amber: `!rateConfirmed` OR `connecteamError` OR `grossMarginPct >= 20 && < 30`
  - 🔴 Red: `grossMarginPct < 20` OR no data at all
- Component: `HealthDashboard.tsx`
  - Summary strip: X green / X amber / X red counts
  - Contract cards grid (3-col desktop, 1-col mobile): left-edge colour strip, name, cell tier, rate, margin %, status reason
  - Click card → `/dashboard/contracts/[id]`
  - Auto-refresh every 5 min
- Sidebar: add Health link to Tools section

**Edge cases:**
1. Monthly-fixed sites: margin calculated on weekly revenue = monthlyBillingValue / 4.33
2. No Connecteam data: amber (tracking issue, not contract issue)
3. Zero hours week (e.g. school holidays): amber with "No hours this week"
4. Unconfirmed rate: amber regardless of calculated margin (margin may be wrong)

**Files to create/modify:**
- `src/app/api/health/route.ts` (new)
- `src/app/dashboard/health/page.tsx` (new)
- `src/app/dashboard/health/HealthDashboard.tsx` (new)
- `src/components/Sidebar.tsx` (add Health link)
- `tests/e2e/smoke.spec.ts` (+2 tests)

**Status:** ✅ DONE
**Build:** PASS (clean)
**Smoke tests:** 34/34 PASS (23.3s)
**Codex audit:** PASSED — 1 P1 fixed (zero-hours week → false red, now amber "No hours this week"), 4 P2 documented (cache race condition, stale cache no max-TTL, Space key not handled on cards, SCHEDULER_IDS hardcoded)

---

## Phase 4: Operative Profiles

**Status:** ⏳ Ready to build — Phase 3 audit passed

---

## Phase 5: Pipeline Kanban

**Status:** Pending Phase 4 completion

---

## Hotfix: Growth Page Mobile Rebuild

**Trigger:** Nelson flagged growth module overflowing on mobile ("looks shit")
**Fix:** Full mobile-first rewrite of `GrowthTracker.tsx`
- Metrics: 4-col strip → 2×2 grid (`gridTemplateColumns: '1fr 1fr'`)
- Progress bar: compressed to 36px height, 14px/16px padding
- Contracts: side-by-side columns → single stacked sections
- Trajectory callout: verbose box → single compact line
- CSS vars fixed: `var(--surface)` / `var(--border)` (old code had wrong vars)

**Build:** PASS | **Smoke:** 32/32 (19.2s) | **Deployed:** 2026-05-21

---

## Smoke Test History

| Date | Phase | Pass/Total | Notes |
|------|-------|-----------|-------|
| 2026-05-21 | Baseline | 24/24 | Initial baseline |
| 2026-05-21 | Phase 1 | 27/27 | +3 contract detail tests |
| 2026-05-21 | Phase 2 | 29/29 | +2 shifts widget tests (15.8s) |
| 2026-05-21 | Phase 2b | 32/32 | +4 dashboard nav tests (19.8s) |
| 2026-05-21 | Hotfix/Growth | 32/32 | Mobile rebuild, no new tests needed (19.2s) |
| 2026-05-21 | Phase 3 | 34/34 | +2 health view tests (23.3s) |
| 2026-05-21 | Phase 3 audit fix | 34/34 | P1: zero-hours → amber (22.6s) |
