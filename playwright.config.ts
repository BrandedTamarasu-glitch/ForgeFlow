import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  retries: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:4003',
    headless: true,
  },
  webServer: {
    command: 'node services/dashboard/server.js',
    url: 'http://127.0.0.1:4003',
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
});
