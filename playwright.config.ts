import { defineConfig, devices } from '@playwright/test';

/** Preview dedicado aos E2E (evita colisão com `astro dev` na porta 4321). */
const E2E_PREVIEW_PORT = (process.env.E2E_PREVIEW_PORT || '').trim() || '4174';
const E2E_PREVIEW_ORIGIN = `http://127.0.0.1:${E2E_PREVIEW_PORT}/`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || E2E_PREVIEW_ORIGIN,
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
          url: E2E_PREVIEW_ORIGIN,
          reuseExistingServer: !process.env.CI,
          timeout: 300_000,
          env: {
            ...process.env,
            BASE_PATH: process.env.BASE_PATH ?? '/',
            E2E_PREVIEW_PORT,
          },
        },
      }),
});
