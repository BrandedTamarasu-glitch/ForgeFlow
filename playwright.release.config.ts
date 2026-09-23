import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outputDir = process.env.FORGEFLOW_RELEASE_RESULTS ||= mkdtempSync(join(tmpdir(), 'forgeflow-web-release-'));

export default defineConfig({
  testDir: 'tests/web-release',
  outputDir,
  reporter: 'list', workers: 1, retries: 0, maxFailures: 3,
  use: { browserName: 'chromium', headless: true, serviceWorkers: 'block',
    launchOptions: { executablePath: process.env.FORGEFLOW_CHROMIUM_PATH } },
});
