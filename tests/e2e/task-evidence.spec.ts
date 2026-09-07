import { test, expect, type Page } from '@playwright/test';

const task = (id: string, status = 'verified') => ({
  id, objective: `Finish ${id}`, status: status === 'verified' ? 'complete' : 'needs-attention',
  phase: 'validation', updated_at: '2026-09-06T12:00:00Z',
  criteria: [{ id: 'accept', description: 'The change works', status }],
  evidence: [{ id: 'proof', kind: 'test', status, artifact: 'checks/results.txt', criterion_ids: ['accept'] }],
  counts: { total: 1, verified: status === 'verified' ? 1 : 0, [status]: 1 },
  next_action: status === 'verified' ? 'Task complete.' : 'Rerun the acceptance check.',
  history: [{ at: '2026-09-06T12:00:00Z', action: 'evidence-recorded' }],
});
async function fixture(page: Page, tasks: ReturnType<typeof task>[] = []) {
  await page.route('**/api/metrics', route => route.fulfill({ json: { projects: [], verdicts: [] } }));
  await page.route('**/api/readiness', route => route.fulfill({ json: { cards: [], lean_prime_steps: [] } }));
  await page.route('**/api/tasks', route => route.fulfill({ json: { schema_version: '1', project_root: '/work/launched', tasks, warnings: [] } }));
  await page.routeWebSocket('**/api/chat', ws => ws.send(JSON.stringify({ type: 'init', history: [] })));
}

test('empty tasks explain how to begin without affecting metrics', async ({ page }) => {
  await fixture(page);
  await page.goto('/');
  await expect(page.locator('#task-empty')).toContainText('Start a task in your ForgeFlow session');
  await expect(page.locator('#task-content')).toBeHidden();
  await expect(page.locator('#stat-approve')).toHaveText('0');
  await expect(page.locator('#task-scope')).toContainText('/work/launched');
});

test('criteria show verified, stale and failed proof with keyboard task selection', async ({ page }) => {
  await fixture(page, [task('complete'), task('stale', 'stale'), task('failed', 'failed')]);
  await page.goto('/');
  await expect(page.locator('#task-objective')).toHaveText('Finish stale');
  await expect(page.locator('#task-criteria')).toContainText('stale');
  await expect(page.locator('#task-next')).toContainText('Rerun');
  await page.locator('#task-select').focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(page.locator('#task-objective')).toHaveText('Finish complete');
  await expect(page.locator('#task-counts')).toContainText('1 of 1 criteria verified');
  await expect(page.locator('#task-criteria')).toContainText('checks/results.txt');
  await page.locator('#task-select').selectOption('failed');
  await expect(page.locator('#task-criteria .status-pill')).toHaveText('failed');
  await page.locator('#task-history summary').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#task-history-list')).toBeVisible();
});

test('failed task refresh retains snapshot and selection then recovers', async ({ page }) => {
  await fixture(page, [task('first'), task('second')]);
  await page.goto('/');
  await page.locator('#task-select').selectOption('second');
  await page.route('**/api/tasks', route => route.fulfill({ status: 500, body: 'Unavailable' }));
  await page.locator('#refresh-dashboard').click();
  await expect(page.locator('#tasks-status')).toContainText('Stale');
  await expect(page.locator('#task-objective')).toHaveText('Finish second');
  await expect(page.locator('#task-select')).toHaveValue('second');
  await expect(page.locator('#metrics-status')).not.toContainText('Stale');
  await fixture(page, [task('first'), task('second', 'stale')]);
  await page.locator('#refresh-dashboard').click();
  await expect(page.locator('#tasks-status')).toContainText('Updated');
  await expect(page.locator('#task-criteria .status-pill')).toHaveText('stale');
});

test('task content is literal text and mobile layout stays within viewport', async ({ page }) => {
  const hostile = task('unsafe', 'failed');
  hostile.objective = '<img src=x onerror=alert(1)>';
  hostile.criteria[0].description = '<script>alert(1)</script>';
  hostile.evidence[0].artifact = 'javascript:alert(1)' + 'x'.repeat(200);
  await page.setViewportSize({ width: 375, height: 812 });
  await fixture(page, [hostile]);
  await page.goto('/');
  await expect(page.locator('#task-objective')).toHaveText(hostile.objective);
  await expect(page.locator('#task-panel img, #task-panel script, #task-panel a')).toHaveCount(0);
  await expect(page.locator('#task-criteria')).toContainText('<script>alert(1)</script>');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('initial failure has a retry path and request timeout preserves other resources', async ({ page }) => {
  await fixture(page);
  await page.route('**/api/tasks', route => route.fulfill({ status: 500, body: 'Unavailable' }));
  await page.goto('/');
  await expect(page.locator('#task-empty')).toContainText('Refresh data to try again');
  await expect(page.locator('#tasks-status')).toContainText('Unavailable');
  await fixture(page, [task('recovered')]);
  await page.locator('#refresh-dashboard').click();
  await expect(page.locator('#task-objective')).toHaveText('Finish recovered');
  await page.clock.install();
  await page.route('**/api/tasks', () => {});
  await page.locator('#refresh-dashboard').click();
  await page.clock.fastForward(10001);
  await expect(page.locator('#tasks-status')).toContainText('Request timed out');
  await expect(page.locator('#task-objective')).toHaveText('Finish recovered');
  await expect(page.locator('#refresh-dashboard')).toBeEnabled();
});


for (const width of [320, 390]) {
  test(`mobile task criteria retain readable width and next action follows at ${width}px`, async ({ page }) => {
    const longTask = task('seven-phases', 'stale');
    longTask.criteria = Array.from({ length: 7 }, (_, index) => ({
      id: `phase-${index}`, status: 'stale',
      description: `Phase ${index + 1}: preserve interruption recovery and verify the complete source-to-evidence pathway with meaningful acceptance checks.`,
    }));
    longTask.evidence = longTask.criteria.map(criterion => ({
      id: `proof-${criterion.id}`, kind: 'test', status: 'stale',
      artifact: '.forgeflow/ForgeFlow/research/2026-09-06-next-level/acceptance-check-results.txt',
      criterion_ids: [criterion.id],
    }));
    longTask.counts = { total: 7, verified: 0, stale: 7 };
    longTask.next_action = 'Rerun checks whose evidence is stale for the current source or artifact, then inspect the results before continuing.';
    await page.setViewportSize({ width, height: 844 });
    await fixture(page, [longTask]);
    await page.goto('/');
    await expect(page.locator('#task-criteria > li')).toHaveCount(7);
    const criteria = await page.locator('#task-criteria').boundingBox();
    const nextAction = await page.locator('.task-work-grid .next-action').boundingBox();
    expect(criteria).not.toBeNull();
    expect(nextAction).not.toBeNull();
    expect(criteria!.width).toBeGreaterThanOrEqual(250);
    expect(nextAction!.y).toBeGreaterThanOrEqual(criteria!.y + criteria!.height);
    expect(nextAction!.width).toBeCloseTo(criteria!.width, 0);
    expect(criteria!.height).toBeLessThan(2500);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
