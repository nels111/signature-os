import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['line'], ['json', { outputFile: 'tests/e2e/results.json' }]],
  use: {
    baseURL: 'http://localhost:3200',
    trace: 'off',
    screenshot: 'only-on-failure',
    headless: true,
    // Store auth state
    storageState: process.env.PLAYWRIGHT_AUTH ? 'tests/e2e/.auth/session.json' : undefined,
  },
  projects: [
    // Setup project: log in and save session
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'smoke',
      testMatch: /smoke\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        storageState: 'tests/e2e/.auth/session.json',
      },
    },
  ],
  // No webServer — app must already be running via PM2
});
