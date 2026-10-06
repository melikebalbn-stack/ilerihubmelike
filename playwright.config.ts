import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: !process.env.E2E_BASE_URL,
  timeout: 60_000,
  expect: { timeout: 30_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : process.env.E2E_BASE_URL ? 1 : 0,
  workers: process.env.CI || process.env.E2E_BASE_URL ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // E2E_BASE_URL verilirse (dev sandbox) sunucu başlatılmaz.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run start',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
      },
})
