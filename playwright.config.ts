import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4321/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  // Em Docker (E2E_DOCKER=1) o servidor é iniciado pelo entrypoint; local/CI sem Docker usa webServer.
  ...(process.env.E2E_DOCKER
    ? {}
    : {
        webServer: {
          command: 'node scripts/start-preview-e2e.js',
          url: 'http://127.0.0.1:4321/',
          reuseExistingServer: !process.env.CI,
          timeout: 300_000,
        },
      }),
});
