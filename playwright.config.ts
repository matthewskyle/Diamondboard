import { defineConfig, devices } from '@playwright/test';

const previewPort = 4173;
const previewURL = `http://127.0.0.1:${previewPort}`;

/**
 * WebKit only. The board is a touch app, so every project is an iPad or iPhone
 * profile with touch enabled. `npm run e2e` builds first; this server only
 * previews that build, which is what installs the service worker.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: previewURL,
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${previewPort} --strictPort`,
    url: previewURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'ipad-portrait',
      use: { ...devices['iPad (gen 7)'], browserName: 'webkit', hasTouch: true },
    },
    {
      name: 'ipad-landscape',
      use: { ...devices['iPad (gen 7) landscape'], browserName: 'webkit', hasTouch: true },
    },
    {
      name: 'iphone',
      use: { ...devices['iPhone 13'], browserName: 'webkit', hasTouch: true },
    },
  ],
});
