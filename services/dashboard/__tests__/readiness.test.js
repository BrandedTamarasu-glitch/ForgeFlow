'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { createServer } = require('../server');
const { scanReadiness } = require('../readiness');

const INDEX_HTML = path.resolve(__dirname, '..', 'public', 'index.html');
const READINESS_CARD_ORDER = [
  'project-health',
  'learning-status',
  'context-budget',
  'lean-prime',
  'lean-guidance',
  'host-verification',
  'benchmark-evidence',
  'guidance-aftercare',
  'release-readiness',
  'dogfood-report',
  'dogfood-refresh-plan',
];
const LEAN_PRIME_STEP_ORDER = ['mode', 'decision', 'report', 'telemetry', 'injection'];

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function makeReadinessFixture() {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-dashboard-readiness-'));
  const projectDir = path.join(projectRoot, '.forgeflow', path.basename(projectRoot));
  const contextDir = path.join(projectDir, 'context');
  const latestDir = path.join(contextDir, 'latest');
  writeJson(path.join(contextDir, 'project-operating-model.json'), { schema_version: '1', status: 'ready' });
  writeJson(path.join(latestDir, 'latest-insights-report.json'), { status: 'injected', freshness: { status: 'current' } });
  writeJson(path.join(latestDir, 'context-telemetry.json'), { budget_status: 'pass', compact_tokens: 800, estimated_saved_tokens: 1200 });
  writeJson(path.join(projectDir, 'release-readiness', 'last.json'), { status: 'ready', blockers: [] });
  writeJson(path.join(contextDir, 'architecture.json'), { schema_version: '1' });
  writeJson(path.join(contextDir, 'ownership-map.json'), { schema_version: '1' });
  writeJson(path.join(contextDir, 'invocation-hints.json'), { schema_version: '1' });
  writeJson(path.join(latestDir, 'synthesis-input.json'), { context_blocks: [{ name: 'architecture-intelligence' }] });
  writeJson(path.join(latestDir, 'packet-artifacts.json'), { packet_count: 4 });
  writeJson(path.join(latestDir, 'code-topology.json'), { nodes: [] });
  writeJson(path.join(contextDir, 'dogfood-report.json'), {
    status: 'ready',
    promotion_decision: 'consider-promote',
    promotion_reason: 'Fixture evidence is complete.',
  });
  return { projectRoot, projectDir };
}

function startServer(opts) {
  return new Promise((resolve, reject) => {
    const server = createServer({ metricsRoot: opts.metricsRoot, projectRoot: opts.projectRoot, projectDir: opts.projectDir, onError: reject });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((res, rej) => server.close((err) => (err ? rej(err) : res()))),
      });
    });
  });
}

function getJson(baseUrl, requestPath) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(baseUrl);
    const req = http.request({
      hostname: parsed.hostname,
      port: Number(parsed.port),
      path: requestPath,
      method: 'GET',
      headers: { host: '127.0.0.1:4003' },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

test('scanReadiness summarizes local readiness without leaking absolute root', async () => {
  const fixture = makeReadinessFixture();
  const body = await scanReadiness(fixture);
  assert.equal(body.schema_version, '1');
  assert.equal(body.status, 'attention');
  assert.equal(body.cards.length, 11);
  assert.deepEqual(body.cards.map((item) => item.id), READINESS_CARD_ORDER);
  for (const card of body.cards) {
    assert.deepEqual(Object.keys(card), ['id', 'label', 'status', 'summary', 'next']);
  }
  assert.equal(body.next, '/forgeflow-lean-prime --prime-task "<work item>" --write-report');
  assert.ok(body.cards.some((item) => item.id === 'lean-prime' && item.status === 'blocked'));
  assert.ok(body.cards.some((item) => item.id === 'lean-prime' && item.next === '/forgeflow-lean-prime --prime-task "<work item>" --write-report'));
  assert.ok(body.cards.some((item) => item.id === 'lean-guidance' && item.status === 'blocked'));
  assert.ok(body.cards.some((item) => item.id === 'host-verification' && ['ready', 'watch', 'partial'].includes(item.status)));
  assert.ok(body.cards.some((item) => item.id === 'benchmark-evidence' && item.status === 'missing'));
  assert.ok(body.cards.some((item) => item.id === 'guidance-aftercare'));
  assert.ok(body.lean_prime_steps.some((item) => item.id === 'decision' && item.status === 'missing'));
  assert.deepEqual(body.lean_prime_steps.map((item) => item.id), LEAN_PRIME_STEP_ORDER);
  for (const step of body.lean_prime_steps) {
    assert.deepEqual(Object.keys(step), ['id', 'status', 'next', 'reason']);
  }
  assert.equal(JSON.stringify(body).includes(fixture.projectRoot), false);
  assert.ok(body.boundary.includes('read-only'));
});

test('GET /api/readiness serves no-store local readiness JSON', async () => {
  const fixture = makeReadinessFixture();
  const metricsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-dashboard-metrics-'));
  const server = await startServer({ metricsRoot, ...fixture });
  try {
    const res = await getJson(server.baseUrl, '/api/readiness');
    assert.equal(res.status, 200);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.body.schema_version, '1');
    assert.equal(res.body.status, 'attention');
    assert.ok(res.body.cards.some((item) => item.id === 'release-readiness' && item.status === 'ready'));
    assert.ok(res.body.cards.some((item) => item.id === 'lean-prime' && item.next === '/forgeflow-lean-prime --prime-task "<work item>" --write-report'));
    assert.ok(res.body.cards.some((item) => item.id === 'lean-guidance' && item.next === '/forgeflow-lean-decision --task "<work item>"'));
    assert.ok(res.body.cards.some((item) => item.id === 'host-verification'));
    assert.ok(res.body.cards.some((item) => item.id === 'benchmark-evidence'));
    assert.ok(res.body.cards.some((item) => item.id === 'guidance-aftercare'));
    assert.ok(res.body.lean_prime_steps.some((item) => item.id === 'telemetry' && item.next.startsWith('/')));
    assert.ok(res.body.cards.some((item) => item.id === 'dogfood-refresh-plan' && item.next === '/forgeflow-dogfood-report --write'));
    assert.equal(JSON.stringify(res.body).includes(fixture.projectRoot), false);
  } finally {
    await server.close();
  }
});

test('dashboard HTML includes read-only project readiness panel contract', () => {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  assert.match(html, /id="readiness-panel"/);
  assert.match(html, /id="readiness-status"/);
  assert.match(html, /id="readiness-cards"/);
  assert.match(html, /id="readiness-lean-prime"/);
  assert.match(html, /id="readiness-lean-prime-list"/);
  assert.match(html, /id="readiness-copy-command"/);
  assert.match(html, /fetch\('\/api\/readiness'/);
  assert.doesNotMatch(html, /\/api\/readiness[^]*method:\s*'POST'/);
});
