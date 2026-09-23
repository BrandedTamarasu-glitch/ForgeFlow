import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Independent of the dashboard configuration: no service or network is needed.
export default defineConfig({
  testDir: 'tests/visual-capabilities',
  outputDir: mkdtempSync(join(tmpdir(), 'forgeflow-visual-acceptance-')),
  reporter: 'list',
  workers: 1,
  retries: 0,
  maxFailures: 3,
  use: { browserName: 'chromium', headless: true, launchOptions: { executablePath: process.env.FORGEFLOW_CHROMIUM_PATH } },
});
