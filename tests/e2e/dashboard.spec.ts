import { test, expect } from '@playwright/test';

test('dashboard page renders with correct title', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    // The WebSocket client in index.html connects to port 4001 (agent-chat),
    // which is not running in test environments — filter those expected errors.
    if (
      msg.type() === 'error' &&
      !msg.text().includes('4001') &&
      !msg.text().includes('WebSocket')
    ) {
      errors.push(msg.text());
    }
  });

  await page.goto('/');
  await expect(page).toHaveTitle('Forgeflow \u2014 Dashboard');

  // Wait for content to load (WS retry loop fires every 5s; networkidle fires before then)
  await page.waitForLoadState('networkidle');

  // Zero non-WS console errors
  expect(errors).toHaveLength(0);
});

test('API returns schema_version 1', async ({ request }) => {
  const res = await request.get('/api/metrics');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.schema_version).toBe('1');
  expect(body).toHaveProperty('projects');
  expect(body).toHaveProperty('verdicts');
});

test('page has correct accessibility landmarks', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Title check
  await expect(page).toHaveTitle('Forgeflow \u2014 Dashboard');

  // Window toggle buttons have aria-pressed (present in static HTML before JS)
  const toggleButtons = page.locator('button[aria-pressed]');
  await expect(toggleButtons).not.toHaveCount(0);

  // Project filter select has aria-label
  const projectSelect = page.locator('select[aria-label="Filter by project"]');
  await expect(projectSelect).toBeVisible();

  // Drift panel has role="status"
  const driftPanel = page.locator('[role="status"]');
  await expect(driftPanel).not.toHaveCount(0);
});

test('drift panel has aria-live="polite"', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const driftPanel = page.locator('#drift-panel');
  await expect(driftPanel).toHaveAttribute('aria-live', 'polite');
});

test('trend chart SVG has role="img" and aria-labelledby', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const svg = page.locator('#trend-chart');
  await expect(svg).toHaveAttribute('role', 'img');
  await expect(svg).toHaveAttribute('aria-labelledby', 'trend-title trend-desc');
  // Verify the aria-labelledby targets survive renderTrend() — the render
  // loop clears and rebuilds SVG children, so title/desc must be preserved.
  await expect(page.locator('#trend-title')).toBeAttached();
  await expect(page.locator('#trend-desc')).toBeAttached();
});

test('#chart-scope-note visible when a project is selected', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const select = page.locator('#project-select');
  const options = select.locator('option');
  const count = await options.count();
  if (count > 1) {
    // Select the first non-empty project option
    const value = await options.nth(1).getAttribute('value');
    if (value) {
      await select.selectOption(value);
      const scopeNote = page.locator('#chart-scope-note');
      await expect(scopeNote).not.toHaveAttribute('hidden', /.*/);
    }
  }
});

test('#error-banner visible when /api/metrics returns 500', async ({ page }) => {
  await page.route('/api/metrics', route => {
    route.fulfill({ status: 500, body: 'Internal Server Error' });
  });
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const errorBanner = page.locator('#error-banner');
  await expect(errorBanner).toHaveClass(/visible/);
});
