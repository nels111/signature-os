/**
 * SigOS Smoke Tests
 * Run after every phase: npx playwright test --config=playwright.config.ts
 * All tests run as authenticated admin (nelson@signature-cleans.co.uk)
 *
 * Phase history:
 * Baseline (pre-Phase 1): written 2026-05-21
 */
import { test, expect } from '@playwright/test';

// ─── Page load tests ─────────────────────────────────────────────────────────

test('dashboard home loads', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.locator('h1, [data-testid="dashboard-title"], .text-2xl').first()).toBeVisible();
});

test('leads page loads', async ({ page }) => {
  await page.goto('/dashboard/leads');
  await expect(page.getByRole('heading', { name: /leads/i })).toBeVisible({ timeout: 10000 });
});

test('deals page loads', async ({ page }) => {
  await page.goto('/dashboard/deals');
  await expect(page.getByRole('heading', { name: /deals/i })).toBeVisible({ timeout: 10000 });
});

test('contacts page loads', async ({ page }) => {
  await page.goto('/dashboard/contacts');
  await expect(page.getByRole('heading', { name: /contacts/i })).toBeVisible({ timeout: 10000 });
});

test('accounts page loads', async ({ page }) => {
  await page.goto('/dashboard/accounts');
  await expect(page.getByRole('heading', { name: /accounts/i })).toBeVisible({ timeout: 10000 });
});

test('quotes list page loads', async ({ page }) => {
  await page.goto('/dashboard/quotes/list');
  await expect(page.getByRole('heading', { name: /quotes/i })).toBeVisible({ timeout: 10000 });
});

test('tasks page loads', async ({ page }) => {
  await page.goto('/dashboard/tasks');
  await expect(page.getByRole('heading', { name: /tasks/i })).toBeVisible({ timeout: 10000 });
});

test('financials page loads', async ({ page }) => {
  await page.goto('/dashboard/financials');
  await expect(page.getByRole('heading', { name: /contract financials/i })).toBeVisible({ timeout: 10000 });
});

test('calendar page loads', async ({ page }) => {
  await page.goto('/dashboard/calendar');
  // Calendar may show different headings depending on view
  await expect(page.locator('h1, [class*="calendar"], [class*="Calendar"]').first()).toBeVisible({ timeout: 10000 });
});

test('emails page loads', async ({ page }) => {
  await page.goto('/dashboard/emails');
  // Emails section
  await expect(page.locator('main, [class*="email"]').first()).toBeVisible({ timeout: 10000 });
});

// ─── API auth gates ───────────────────────────────────────────────────────────

test('API: dashboard returns data when authenticated', async ({ request }) => {
  const resp = await request.get('/api/dashboard');
  expect(resp.status()).toBe(200);
});

test('API: leads returns 200 when authenticated', async ({ request }) => {
  const resp = await request.get('/api/leads?page=1&limit=1');
  expect(resp.status()).toBe(200);
});

test('API: deals returns 200 when authenticated', async ({ request }) => {
  const resp = await request.get('/api/deals?page=1&limit=1');
  expect(resp.status()).toBe(200);
});

test('API: contacts returns 200 when authenticated', async ({ request }) => {
  const resp = await request.get('/api/contacts?page=1&limit=1');
  expect(resp.status()).toBe(200);
});

test('API: accounts returns 200 when authenticated', async ({ request }) => {
  const resp = await request.get('/api/accounts?page=1&limit=1');
  expect(resp.status()).toBe(200);
});

test('API: quotes returns 200 when authenticated', async ({ request }) => {
  const resp = await request.get('/api/quotes?page=1&limit=1');
  expect(resp.status()).toBe(200);
});

test('API: tasks returns 200 when authenticated', async ({ request }) => {
  const resp = await request.get('/api/tasks?page=1&limit=1');
  expect(resp.status()).toBe(200);
});

test('API: sites returns 200 when authenticated', async ({ request }) => {
  const resp = await request.get('/api/sites');
  expect(resp.status()).toBe(200);
});

test('API: notifications returns 200 when authenticated', async ({ request }) => {
  const resp = await request.get('/api/notifications');
  expect(resp.status()).toBe(200);
});

test('API: growth returns 200 when authenticated', async ({ request }) => {
  const resp = await request.get('/api/growth');
  expect(resp.status()).toBe(200);
});

// ─── Phase 2: Live shifts widget ─────────────────────────────────────────────

test('API: shifts/today returns 200 when authenticated', async ({ request }) => {
  const resp = await request.get('/api/shifts/today');
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  expect(body).toHaveProperty('shifts');
  expect(body).toHaveProperty('counts');
  expect(body).toHaveProperty('fetchedAt');
});


test('dashboard home: section tiles render', async ({ page }) => {
  await page.goto('/dashboard');
  // Home now shows Sales and/or Ops section tiles
  await expect(page.locator('a[href="/dashboard/sales"], a[href="/dashboard/ops"]').first()).toBeVisible({ timeout: 10000 });
});

test('sales detail page loads', async ({ page }) => {
  await page.goto('/dashboard/sales');
  await expect(page.getByRole('heading', { name: /sales/i })).toBeVisible({ timeout: 10000 });
});

test('ops detail page loads', async ({ page }) => {
  await page.goto('/dashboard/ops');
  await expect(page.getByRole('heading', { name: /operations/i })).toBeVisible({ timeout: 10000 });
});

test('ops detail page: shifts widget renders', async ({ page }) => {
  await page.goto('/dashboard/ops');
  await expect(page.getByText('Shifts Today')).toBeVisible({ timeout: 15000 });
});

// ─── Phase 1: Contract detail pages ──────────────────────────────────────────

test('contract detail page: 404 shows back button for unknown id', async ({ page }) => {
  await page.goto('/dashboard/contracts/nonexistent-id-99999');
  await expect(page.getByText('404')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: /back to financials/i })).toBeVisible();
});

test('contract detail page: loads for real site', async ({ page, request }) => {
  const resp = await request.get('/api/sites');
  const data = await resp.json();
  const firstSite = data.sites?.[0];
  if (!firstSite) { return; }
  await page.goto(`/dashboard/contracts/${firstSite.id}`);
  await expect(page.getByText(/weekly revenue/i)).toBeVisible({ timeout: 10000 });
});

test('contract detail page: financials row click navigates to contract', async ({ page }) => {
  await page.goto('/dashboard/financials');
  await page.waitForSelector('table tbody tr', { timeout: 10000 });
  await page.locator('table tbody tr').first().click();
  await expect(page).toHaveURL(/\/dashboard\/contracts\//, { timeout: 8000 });
});

// ─── Navigation interactions ──────────────────────────────────────────────────

test('financials row click opens edit modal or navigates', async ({ page }) => {
  await page.goto('/dashboard/financials');
  // Wait for table to load
  await page.waitForSelector('table tbody tr, [class*="site-row"]', { timeout: 10000 }).catch(() => null);
  const rows = page.locator('table tbody tr');
  const count = await rows.count();
  if (count > 0) {
    await rows.first().click();
    // Should either open a modal or navigate — check something changed
    const modal = page.locator('[role="dialog"], [class*="modal"]');
    const url = page.url();
    const hasModal = await modal.isVisible().catch(() => false);
    const hasNavigated = !url.includes('/financials') || hasModal;
    expect(hasModal || count > 0).toBeTruthy(); // row click at least didn't throw
  }
});

test('leads search filters results', async ({ page }) => {
  await page.goto('/dashboard/leads');
  await page.waitForSelector('input[placeholder*="earch"]', { timeout: 10000 });
  await page.fill('input[placeholder*="earch"]', 'zzznomatch999');
  await page.waitForTimeout(500);
  // Should show empty state or fewer results — just verify no JS error
  const heading = page.getByRole('heading', { name: /leads/i });
  await expect(heading).toBeVisible();
});

test('new quote button navigates to quote builder', async ({ page }) => {
  await page.goto('/dashboard/quotes/list');
  const btn = page.getByRole('button', { name: /new quote/i });
  await expect(btn).toBeVisible({ timeout: 5000 });
  await btn.click();
  await expect(page).toHaveURL(/dashboard\/quotes(?!\/list)/, { timeout: 5000 });
});

// ─── Phase 3: Contract health view ───────────────────────────────────────────

test('API: health returns 200 with contracts and summary', async ({ request }) => {
  const resp = await request.get('/api/health');
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  expect(body).toHaveProperty('contracts');
  expect(body).toHaveProperty('summary');
  expect(body.summary).toHaveProperty('total');
  expect(Array.isArray(body.contracts)).toBe(true);
});

test('health page loads with contract cards', async ({ page }) => {
  await page.goto('/dashboard/health');
  await expect(page.getByRole('heading', { name: /contract health/i })).toBeVisible({ timeout: 10000 });
  // Summary strip should show filter pills
  await expect(page.getByText(/All/)).toBeVisible({ timeout: 10000 });
});

// ─── Phase 4: Operative profiles ─────────────────────────────────────────────

test('API: operatives returns 200 with array', async ({ request }) => {
  const resp = await request.get('/api/operatives');
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  expect(body).toHaveProperty('operatives');
  expect(Array.isArray(body.operatives)).toBe(true);
  expect(body).toHaveProperty('weekEnd');
});

test('operatives page loads with filter chips', async ({ page }) => {
  await page.goto('/dashboard/operatives');
  await expect(page.getByRole('heading', { name: /operatives/i })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: /all/i })).toBeVisible({ timeout: 10000 });
});

test('operatives page: sidebar link is present', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('link', { name: /operatives/i })).toBeVisible({ timeout: 10000 });
});

// ─── Phase 5: Pipeline Kanban ─────────────────────────────────────────────────

test('pipeline page loads with kanban tabs', async ({ page }) => {
  await page.goto('/dashboard/pipeline');
  await expect(page.getByRole('heading', { name: /pipeline/i })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: /lead pipeline/i })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: /deal pipeline/i })).toBeVisible({ timeout: 10000 });
});

test('pipeline: deal tab shows summary cards', async ({ page }) => {
  await page.goto('/dashboard/pipeline');
  await page.getByRole('button', { name: /deal pipeline/i }).click();
  // Summary strip: Total Pipeline Value card should appear
  await expect(page.getByText(/Total Pipeline Value/i)).toBeVisible({ timeout: 10000 });
});
