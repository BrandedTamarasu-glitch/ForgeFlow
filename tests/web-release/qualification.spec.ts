import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { join } from 'node:path';

const hash = (body: Buffer) => createHash('sha256').update(body).digest('hex');
const types: Record<string, string> = {
  '/index.html': 'text/html', '/app.js': 'text/javascript', '/style.css': 'text/css',
  '/logo.svg': 'image/svg+xml', '/icon.svg': 'image/svg+xml',
};
// Freeze expectations from intended checkout bytes before creating any server.
const intended = new Map(Object.entries(types).map(([path, type]) => {
  const body = readFileSync(join(__dirname, '../../fixtures/web-release/site', path));
  return [path, { body, type, sha256: hash(body) }] as const;
}));
type Observation = { path: string; status: number; type: string; sha256: string | null; redirected: boolean };
function classify(observed: Observation): 'pass' | 'fail' | 'unverified' {
  const expected = intended.get(observed.path);
  if (!expected) throw new Error('Observation outside frozen manifest');
  if (observed.redirected || (observed.status !== 200 && observed.status !== 304)) return 'fail';
  if (observed.status === 304 || observed.sha256 === null) return 'unverified';
  return observed.type === expected.type && observed.sha256 === expected.sha256 ? 'pass' : 'fail';
}

const cases = [
  { name: 'current', failed: [], unknown: [], available: true },
  { name: 'stale-build', failed: ['/index.html', '/app.js'], unknown: [], available: true },
  { name: 'mixed-asset', failed: ['/style.css'], unknown: [], available: true },
  { name: 'missing-icon', failed: ['/icon.svg'], unknown: [], available: true },
  { name: 'html-fallback', failed: ['/logo.svg'], unknown: [], available: true },
  { name: 'wrong-media-type', failed: ['/icon.svg'], unknown: [], available: true },
  { name: 'unexpected-redirect', failed: ['/icon.svg'], unknown: [], available: true },
  { name: 'bodyless-cache-response', failed: [], unknown: ['/icon.svg'], available: true },
  { name: 'runtime-failure', failed: [], unknown: [], available: false },
] as const;

test.afterAll(async ({}, testInfo) => {
  console.log(`Local web release observations: ${testInfo.project.outputDir}`);
});

for (const scenario of cases) {
  for (const width of scenario.name === 'current' ? [390, 1280] : [390]) {
    test(`${scenario.name} at ${width}px`, async ({ page, context, browser }, testInfo) => {
      const server = createServer((req, res) => {
        const path = new URL(req.url || '/', 'http://localhost').pathname;
        res.setHeader('Cache-Control', 'no-store');
        // Even the stale deployment claims the intended version.
        res.setHeader('X-Release', 'v2');
        if (path === '/api/availability') {
          res.writeHead(scenario.available ? 200 : 503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ available: scenario.available }));
          return;
        }
        const artifact = intended.get(path);
        if (!artifact) { res.writeHead(404); res.end(); return; }
        let { body, type } = artifact;
        if (scenario.name === 'stale-build') {
          if (path === '/index.html') body = Buffer.from(body.toString().replaceAll('v2', 'v1'));
          if (path === '/app.js') body = Buffer.concat([body, Buffer.from('\n// older build v1\n')]);
        }
        if (scenario.name === 'mixed-asset' && path === '/style.css') body = Buffer.concat([body, Buffer.from('\nbody { background: #222; }\n')]);
        if (scenario.name === 'html-fallback' && path === '/logo.svg') {
          body = intended.get('/index.html')!.body; type = 'text/html';
        }
        if (path === '/icon.svg') {
          if (scenario.name === 'missing-icon') { res.writeHead(404); res.end(); return; }
          if (scenario.name === 'unexpected-redirect') { res.writeHead(302, { Location: '/logo.svg' }); res.end(); return; }
          if (scenario.name === 'bodyless-cache-response') { res.writeHead(304); res.end(); return; }
          if (scenario.name === 'wrong-media-type') type = 'text/html';
        }
        res.writeHead(200, { 'Content-Type': type }); res.end(body);
      });
      const consumed: Promise<Observation>[] = [];
      const runtimeErrors: string[] = [];
      page.on('pageerror', error => runtimeErrors.push(error.message));
      page.on('response', response => {
        const path = new URL(response.url()).pathname;
        if (!['/index.html', '/app.js', '/style.css'].includes(path)) return;
        consumed.push((async () => ({ path, status: response.status(),
          type: (response.headers()['content-type'] || '').split(';')[0],
          sha256: await response.body().then(hash).catch(() => null),
          redirected: response.request().redirectedFrom() !== null,
        }))());
      });
      try {
        // Port 0 asks the OS to reserve an available port atomically.
        await new Promise<void>((resolve, reject) => {
          server.once('error', reject); server.listen(0, '127.0.0.1', resolve);
        });
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('Missing fixture address');
        const origin = `http://127.0.0.1:${address.port}`;
        const probes: Observation[] = [];
        for (const path of intended.keys()) {
          const response = await context.request.get(origin + path, { maxRedirects: 0 });
          expect(response.headers()['x-release']).toBe('v2');
          probes.push({ path, status: response.status(), type: (response.headers()['content-type'] || '').split(';')[0],
            sha256: response.status() === 304 ? null : hash(await response.body()),
            redirected: response.status() >= 300 && response.status() < 304 });
        }
        const failed = probes.filter(item => classify(item) === 'fail').map(item => item.path).sort();
        const unknown = probes.filter(item => classify(item) === 'unverified').map(item => item.path).sort();
        expect(failed).toEqual([...scenario.failed].sort());
        expect(unknown).toEqual([...scenario.unknown].sort());

        await page.setViewportSize({ width, height: 800 });
        await page.goto(origin + '/index.html');
        const actual = await Promise.all(consumed);
        expect(actual.map(item => item.path).sort()).toEqual(['/app.js', '/index.html', '/style.css']);
        expect(actual.filter(item => classify(item) === 'fail').map(item => item.path).sort())
          .toEqual(failed.filter(path => ['/index.html', '/app.js', '/style.css'].includes(path)));
        expect(actual.every(item => classify(item) !== 'unverified')).toBe(true);
        const button = page.getByRole('button', { name: 'Check availability', exact: true });
        await page.keyboard.press('Tab');
        await expect(button).toBeFocused();
        expect(await button.evaluate(node => parseFloat(getComputedStyle(node).outlineWidth))).toBeGreaterThan(0);
        await page.keyboard.press('Enter');
        const outcome = scenario.available ? 'Available' : 'Availability unavailable. Try again.';
        await expect(page.getByRole('status')).toHaveText(outcome);
        // Exercise pointer activation independently after restoring the starting status.
        await page.getByRole('status').evaluate(node => { node.textContent = 'Ready to check'; });
        await button.click();
        await expect(page.getByRole('status')).toHaveText(outcome);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(runtimeErrors).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath('page.png'), fullPage: true });
        const identity = failed.length ? 'fail' : unknown.length ? 'unverified' : 'pass';
        const visibleStatus = await page.getByRole('status').textContent();
        const interaction = visibleStatus === 'Available' ? 'pass' : 'fail';
        const qualification = identity === 'fail' || interaction === 'fail' ? 'fail' : identity;
        expect(qualification).toBe(scenario.name === 'current' ? 'pass' : scenario.name === 'bodyless-cache-response' ? 'unverified' : 'fail');
        writeFileSync(testInfo.outputPath('observations.json'), JSON.stringify({
          evidence: 'local-simulation', public_verification: 'unverified', browser: browser.version(),
          scenario: scenario.name, width, observed_at: new Date().toISOString(),
          intended: [...intended].map(([path, value]) => ({ path, type: value.type, sha256: value.sha256 })),
          probes, browser_consumed: actual, identity, interaction,
          visible_status: visibleStatus, qualification, runtime_errors: runtimeErrors,
          limits: ['no public target', 'no service worker or returning-cache trial', 'no screen reader or complete accessibility audit'],
        }, null, 2));
      } finally {
        try {
          await page.close();
        } finally {
          if (server.listening) await new Promise<void>((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
            server.closeAllConnections();
          });
        }
      }
    });
  }
}
