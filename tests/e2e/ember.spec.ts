import { test, expect, type WebSocketRoute } from '@playwright/test';

const states = ['idle', 'planning', 'researching', 'implementing', 'reviewing', 'testing', 'waiting', 'failed', 'complete', 'offline'];

test('every preview is labeled, keyboard accessible, and returns to disconnected live state', async ({ page }) => {
  await page.routeWebSocket('**/api/chat', ws => ws.close());
  await page.goto('/');
  const ember = page.locator('#ember');
  await expect(ember).toHaveAttribute('data-state', 'offline');
  for (const state of states) {
    const button = ember.locator(`[data-preview-state="${state}"]`);
    await button.focus(); await page.keyboard.press('Enter');
    await expect(ember).toHaveAttribute('data-state', state);
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(ember.locator('.ember-source')).toHaveText('PREVIEW');
  }
  await ember.getByRole('button', { name: 'Return to live' }).click();
  await expect(ember).toHaveAttribute('data-state', 'offline');
  await expect(ember.locator('.ember-source')).toHaveText('OFFLINE');
});

test('live reports continue during preview and pause; stale work waits and disconnects go offline', async ({ page }) => {
  let socket: WebSocketRoute;
  await page.clock.install();
  await page.routeWebSocket('**/api/chat', ws => {
    socket = ws;
    ws.send(JSON.stringify({ type: 'init', history: [], activity: { agents: [] } }));
  });
  await page.goto('/');
  const ember = page.locator('#ember');
  await expect(ember).toHaveAttribute('data-state', 'idle');
  const report = async (state: string, label: string) => {
    const now = await page.evaluate(() => Date.now());
    socket.send(JSON.stringify({ type: 'activity', agents: [{ agent: 'fc', state, label, updated_at: now }] }));
  };
  await report('implementing', '<img src=x onerror=alert(1)>');
  await expect(ember).toHaveAttribute('data-state', 'implementing');
  await expect(ember.locator('.ember-readout')).toContainText('<img src=x onerror=alert(1)>');
  await expect(ember.locator('img')).toHaveCount(0);
  await ember.getByRole('button', { name: 'Pause motion', exact: true }).click();
  await expect(ember).toHaveAttribute('data-paused', 'true');
  await expect(ember.locator('.ember-arm')).toHaveCSS('animation-play-state', 'paused');
  await ember.locator('[data-preview-state="planning"]').click();
  await report('testing', 'Running checks');
  await expect(ember).toHaveAttribute('data-state', 'planning');
  await expect(ember.locator('.ember-readout')).toContainText('live status: Testing');
  await ember.getByRole('button', { name: 'Return to live' }).click();
  await expect(ember).toHaveAttribute('data-state', 'testing');
  await page.clock.fastForward(93000);
  await expect(ember).toHaveAttribute('data-state', 'waiting');
  await expect(ember.locator('h2')).toHaveText('Waiting for an update.');
  await report('complete', 'All checks passed');
  await expect(ember).toHaveAttribute('data-state', 'complete');
  socket!.close();
  await expect(ember).toHaveAttribute('data-state', 'offline');
});

test('idle alternates polishing and dozing without inventing activity', async ({ page }) => {
  await page.clock.install();
  await page.routeWebSocket('**/api/chat', ws => ws.send(JSON.stringify({ type: 'init', activity: { agents: [] } })));
  await page.goto('/');
  const ember = page.locator('#ember');
  await expect(ember).toHaveAttribute('data-idle', 'watching');
  await page.clock.fastForward(15000);
  await expect(ember).toHaveAttribute('data-idle', 'polishing');
  await page.clock.fastForward(33000);
  await expect(ember).toHaveAttribute('data-idle', 'dozing');
  await expect(ember).toHaveAttribute('data-state', 'idle');
});

test('mobile layout respects reduced motion while preserving poses and status', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const ember = page.locator('#ember');
  await ember.locator('[data-preview-state="implementing"]').click();
  await expect(ember.locator('.ember-arm')).toHaveCSS('animation-name', 'none');
  await expect(ember.getByRole('button', { name: 'Reduced motion enabled' })).toBeDisabled();
  const box = await ember.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await expect(ember.locator('.ember-readout')).toContainText('Implementing preview');
});
