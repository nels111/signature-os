import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/session.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveURL(/login/);

  // Fill credentials
  await page.fill('input[name="email"], input[type="email"]', 'nelson@signature-cleans.co.uk');
  await page.fill('input[name="password"], input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL(/dashboard/, { timeout: 15000 });

  // Save session state
  await page.context().storageState({ path: authFile });
});
