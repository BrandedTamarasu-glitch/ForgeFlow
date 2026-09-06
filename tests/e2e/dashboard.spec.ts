import { test, expect, type Page, type WebSocketRoute } from '@playwright/test';

const counts = (approve: number, conditional: number, revise = 0, block = 0) => ({ APPROVE: approve, 'CONDITIONAL APPROVE': conditional, REVISE: revise, BLOCK: block });
const metrics = {
  schema_version: '1', parse_warnings: 0,
  projects: [
    { project: 'alpha', file_count: 2, event_totals: { verdict: 12 }, verdicts: { arbiter: counts(7, 3, 1, 1), compass: { CONFIRM: 6, CHALLENGE: 1 } }, auto_fix: { rounds: 4, applied: 2, applied_failed: 0 } },
    { project: 'beta', file_count: 1, event_totals: { verdict: 6 }, verdicts: { arbiter: counts(2, 2, 2), compass: { CONFIRM: 2, CHALLENGE: 0 } }, auto_fix: { rounds: 2, applied: 1, applied_failed: 0 } },
  ],
  verdicts: Array.from({ length: 14 }, (_, i) => ({ week: `2026-W${String(i + 1).padStart(2, '0')}`, arbiter: counts(i + 1, 1, 2, 1), compass: { CONFIRM: 1, CHALLENGE: 0 } })),
};
const readiness = {
  schema_version: '1', generated_at: '2026-09-05T12:00:00Z', project: 'launched-project', status: 'attention',
  cards: [
    { id: 'release-readiness', label: 'Release readiness', status: 'blocked', summary: 'Two checks need attention.', next: '/forgeflow-release-readiness', details: ['One missing report'] },
    { id: 'context', label: 'Context', status: 'ready', summary: 'Saved context is current.', next: '' },
  ], lean_prime_steps: [], next: '/forgeflow-release-readiness', boundary: 'Reads saved local artifacts.',
};
async function fixture(page: Page) {
  await page.route('**/api/metrics', route => route.fulfill({ json: metrics }));
  await page.route('**/api/readiness', route => route.fulfill({ json: readiness }));
  await page.routeWebSocket('**/api/chat', ws => ws.send(JSON.stringify({ type: 'init', history: [], activity: { agents: [] } })));
}

test('overview has landmarks, accessible charts and truthful project versus weekly scopes', async ({ page }) => {
  await fixture(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/Forgeflow.*Workshop/i);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.locator('#stat-approve')).toHaveText('9');
  await expect(page.locator('#stat-conditional')).toHaveText('5');
  await page.locator('#project-select').selectOption('alpha');
  await expect(page.locator('#stat-approve')).toHaveText('7');
  await expect(page.locator('#stat-conditional')).toHaveText('3');
  await expect(page.locator('#readiness-state')).toContainText('launched-project');
  await expect(page.locator('#chart-scope-note')).toContainText(/all projects/i);
  await page.locator('[data-window="4"]').click();
  await expect(page.locator('#verdict-table-body tr')).toHaveCount(4);
  await page.locator('[data-window="12"]').click();
  await expect(page.locator('#verdict-table-body tr')).toHaveCount(12);
  await page.locator('[data-window="all"]').click();
  await expect(page.locator('#verdict-table-body tr')).toHaveCount(14);
  await expect(page.locator('#stat-approve')).toHaveText('7');
  await page.getByText('View chart data', { exact: true }).click();
  await expect(page.getByRole('columnheader', { name: /conditional approve/i, exact: true })).toBeAttached();
  await expect(page.locator('#trend-chart')).toHaveAttribute('role', 'img');
  await expect(page.locator('#trend-chart')).toBeVisible();
  await expect(page.locator('#trend-title')).toBeAttached();
  await expect(page.locator('#trend-desc')).toBeAttached();
  await expect(page.locator('#drift-panel')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('failed refresh keeps data and user choices, then recovers independently', async ({ page }) => {
  await fixture(page);
  await page.goto('/');
  await expect(page.locator('#stat-approve')).toHaveText('9');
  await page.locator('#project-select').selectOption('beta');
  await page.locator('[data-window="12"]').click();
  await page.route('**/api/metrics', route => route.fulfill({ status: 500, body: 'Unavailable' }));
  await page.locator('#refresh-dashboard').click();
  await expect(page.locator('#metrics-status')).toContainText(/stale/i);
  await expect(page.locator('#stat-approve')).toHaveText('2');
  await expect(page.locator('#project-select')).toHaveValue('beta');
  await expect(page.locator('[data-window="12"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#readiness-next-command')).toHaveText('/forgeflow-release-readiness');
  await page.route('**/api/metrics', route => route.fulfill({ json: metrics }));
  await page.locator('#refresh-dashboard').click();
  await expect(page.locator('#metrics-status')).not.toContainText(/stale/i);
  await expect(page.locator('#project-select')).toHaveValue('beta');
  await page.route('**/api/readiness', route => route.fulfill({ status: 500, body: 'Unavailable' }));
  await page.locator('#refresh-dashboard').click();
  await expect(page.locator('#readiness-refresh-status')).toContainText(/stale/i);
  await expect(page.locator('#readiness-next-command')).toHaveText('/forgeflow-release-readiness');
  await expect(page.locator('#metrics-status')).not.toContainText(/stale/i);
});

test('live activity connects while metrics are pending and readiness errors stay independent', async ({ page }) => {
  await fixture(page);
  let release: () => void = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/metrics', async route => { await pending; await route.fulfill({ json: metrics }); });
  await page.route('**/api/readiness', route => route.fulfill({ status: 500, body: 'Unavailable' }));
  await page.goto('/');
  await expect(page.locator('#ember')).toHaveAttribute('data-state', 'idle');
  await expect(page.locator('#readiness-refresh-status')).toContainText(/unavailable/i);
  release();
  await expect(page.locator('#stat-approve')).toHaveText('9');
});

test('repeated refresh activation cannot start duplicate in-flight resource requests', async ({ page }) => {
  await fixture(page);
  await page.goto('/');
  await expect(page.locator('#stat-approve')).toHaveText('9');
  let calls = 0;
  let release: () => void = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/metrics', async route => { calls++; await pending; await route.fulfill({ json: metrics }); });
  await page.locator('#refresh-dashboard').click();
  await expect.poll(() => calls).toBe(1);
  await page.locator('#refresh-dashboard').evaluate(button => { button.dispatchEvent(new MouseEvent('click')); button.dispatchEvent(new MouseEvent('click')); });
  release();
  await expect(page.locator('#refresh-dashboard')).toBeEnabled();
  expect(calls).toBe(1);
});

test('empty metrics and missing artifacts remain useful and distinct from a failed fetch', async ({ page }) => {
  await fixture(page);
  await page.route('**/api/metrics', route => route.fulfill({ json: { schema_version: '1', projects: [], verdicts: [], parse_warnings: 0 } }));
  await page.route('**/api/readiness', route => route.fulfill({ json: { ...readiness, status: 'attention', cards: [{ id: 'context', label: 'Context', status: 'missing', summary: 'No saved context found.', next: '/forgeflow-context' }], next: '/forgeflow-context' } }));
  await page.goto('/');
  await expect(page.locator('#stat-approve')).toHaveText('0');
  await expect(page.locator('#metrics-status')).not.toContainText(/unavailable|stale/i);
  await expect(page.locator('#readiness-next-command')).toHaveText('/forgeflow-context');
  await expect(page.locator('#readiness-cards')).toContainText('No saved context found.');
});

test('next action copies by keyboard without navigation or command execution', async ({ page }) => {
  await fixture(page);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  const copy = page.locator('#readiness-copy-command');
  await copy.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#readiness-copy-status')).toContainText(/copied/i);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('/forgeflow-release-readiness');
  await expect(page).toHaveURL(/\/$/);
});

test('keyboard navigation exposes a visible focus ring on dashboard controls', async ({ page }) => {
  await fixture(page);
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to overview' })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const refresh = page.locator('#refresh-dashboard');
  await expect(refresh).toBeFocused();
  await expect(refresh).toHaveCSS('outline-style', 'solid');
  await expect(refresh).toHaveCSS('outline-width', '2px');
  await expect(refresh).toHaveCSS('outline-offset', '4px');
  await expect(refresh).toHaveCSS('outline-color', 'rgb(228, 172, 121)');
});

test('structured chat bounds history, escapes prose and replaces it on reconnect', async ({ page }) => {
  await fixture(page);
  await page.clock.install();
  let socket: WebSocketRoute;
  let connections = 0;
  await page.routeWebSocket('**/api/chat', ws => {
    socket = ws;
    connections++;
    ws.send(JSON.stringify({ type: 'init', activity: { agents: [] }, history: Array.from({ length: 110 }, (_, i) => ({ agent: 'compass', level: 'decision', timestamp: 1700000000000 + i, message: `History ${i}` })) }));
  });
  await page.goto('/');
  const rows = page.locator('#chat-messages .chat-message');
  await expect(rows).toHaveCount(100);
  await expect(rows.first()).toContainText('History 10');
  await expect(page.locator('#chat-announcement')).toBeEmpty();
  await page.locator('#chat-messages').evaluate(element => { element.scrollTop = 0; });
  socket!.send(JSON.stringify({ agent: 'warden', level: 'conversation', timestamp: Date.now(), message: '<img src=x onerror=alert(1)>' }));
  await expect(rows).toHaveCount(100);
  await expect(rows.last()).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#chat-messages img')).toHaveCount(0);
  expect(await page.locator('#chat-messages').evaluate(element => element.scrollTop)).toBe(0);
  await page.locator('#chat-latest').click();
  expect(await page.locator('#chat-messages').evaluate(element => element.scrollHeight - element.scrollTop - element.clientHeight)).toBeLessThanOrEqual(2);
  socket!.close();
  await page.clock.fastForward(6000);
  await expect(rows).toHaveCount(100);
  await expect(rows.last()).toContainText('History 109');
  expect(connections).toBeGreaterThan(1);
  await page.locator('#chat-filter').selectOption('phase');
  await expect(rows).toHaveCount(0);
  await page.locator('#chat-filter').selectOption('decision');
  await expect(rows).toHaveCount(100);
});

for (const width of [1440, 768, 390, 320]) {
  test(`overview fits ${width}px without horizontal overflow`, async ({ page }) => {
    await fixture(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.locator('#stat-approve')).toHaveText('9');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.locator('#ember')).toBeVisible();
    await page.screenshot({ path: `/tmp/forgeflow-dashboard-${width}.png`, fullPage: true });
  });
}

test('explicit activity populates the feed, deduplicates snapshots and reconnects silently', async ({ page }) => {
  await fixture(page);
  await page.clock.install();
  let socket: WebSocketRoute;
  const agent = { agent: 'fc', state: 'implementing', label: 'Building the dashboard', updated_at: Date.now() };
  let snapshot = { type: 'activity', room: 'work', sequence: 1, agents: [agent] };
  await page.routeWebSocket('**/api/chat', ws => {
    socket = ws;
    ws.send(JSON.stringify({ type: 'init', history: [], activity: snapshot }));
  });
  await page.goto('/');
  const rows = page.locator('#chat-messages .chat-message');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('implementing · Building the dashboard');
  await expect(page.locator('#chat-announcement')).toBeEmpty();
  socket!.send(JSON.stringify(snapshot));
  socket!.send(JSON.stringify({ ...snapshot, sequence: 2 }));
  await expect(rows).toHaveCount(1);
  snapshot = { ...snapshot, sequence: 3, agents: [{ ...agent, state: 'testing', label: '<img src=x> Checking results', updated_at: agent.updated_at + 1 }] };
  socket!.send(JSON.stringify(snapshot));
  await expect(rows).toHaveCount(2);
  await expect(rows.last()).toContainText('testing · <img src=x> Checking results');
  await expect(page.locator('#chat-messages img')).toHaveCount(0);
  await expect(page.locator('#ember')).toHaveAttribute('data-state', 'testing');
  await page.locator('#chat-filter').selectOption('phase');
  await expect(rows).toHaveCount(2);
  await page.locator('#chat-filter').selectOption('decision');
  await expect(rows).toHaveCount(0);
  await page.locator('#chat-filter').selectOption('all');
  await page.locator('#chat-announcement').evaluate(element => { element.textContent = ''; });
  socket!.close();
  await page.clock.fastForward(6000);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('testing');
  await expect(page.locator('#chat-announcement')).toBeEmpty();
  for (let i = 0; i < 110; i++) socket!.send(JSON.stringify({ ...snapshot, sequence: i + 4, agents: [{ ...agent, label: `Progress ${i}`, updated_at: agent.updated_at + i + 2 }] }));
  await expect(rows).toHaveCount(100);
  await expect(rows.last()).toContainText('Progress 109');
});

test('optional evidence stays informational and empty metrics explain how verdicts arrive', async ({ page }) => {
  await fixture(page);
  await page.route('**/api/readiness', route => route.fulfill({ json: {
    ...readiness, status: 'watch', cards: [
      { id: 'optional', label: 'Benchmark evidence', status: 'missing', severity: 'info', summary: 'No optional benchmark run yet.' },
      { id: 'actual', label: 'Validation failure', status: 'failed', severity: 'attention', summary: 'A check failed.' },
      { id: 'present', label: 'Context', status: 'ready', severity: 'ok', summary: 'Current.' },
    ],
  } }));
  await page.route('**/api/metrics', route => route.fulfill({ json: { ...metrics, projects: [], verdicts: [] } }));
  await page.goto('/');
  await expect(page.locator('#health-summary')).toContainText('1 of 3 checks need attention');
  await expect(page.locator('#health-summary')).toContainText('1 informational check');
  await expect(page.locator('#stat-approve')).toHaveText('0');
  await expect(page.locator('#stat-context')).toContainText('no review verdicts recorded');
  await expect(page.locator('#chart-empty')).toContainText('Planning and activity updates do not create review outcomes');
  await page.locator('.health-details-link').click();
  await expect(page.locator('.readiness-card').first()).toContainText('Informational evidence');
});
