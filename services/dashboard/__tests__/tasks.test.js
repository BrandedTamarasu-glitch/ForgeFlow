'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server');
const { execFileSync } = require('node:child_process');
const { EventEmitter } = require('node:events');
const { Worker } = require('node:worker_threads');
const { createTaskScanner } = require('../tasks');
const { createTask, recordEvidence, checkpointTask } = require('../../../scripts/forgeflow/task-store');

async function fixture(t, projectRoot) {
  const root = projectRoot || fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-task-api-'));
  if (!projectRoot) {
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'Fixture'], { cwd: root });
  }
  const server = createServer({ projectRoot: root, metricsRoots: [], onError: () => {} });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    if (!projectRoot) fs.rmSync(root, { recursive: true, force: true });
  });
  return { root, url: `http://127.0.0.1:${server.address().port}` };
}

test('task API returns a scoped empty snapshot without creating workspace files', async t => {
  const { root, url } = await fixture(t);
  const response = await fetch(`${url}/api/tasks`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const body = await response.json();
  assert.equal(body.schema_version, '1');
  assert.equal(body.project_root, path.basename(root));
  assert.deepEqual(body.tasks, []);
  assert.deepEqual(fs.readdirSync(root), ['.git']);
});

test('task API rejects cross-origin reads, writes and client-selected project paths', async t => {
  const { root, url } = await fixture(t);
  assert.equal((await fetch(`${url}/api/tasks`, { headers: { origin: 'https://example.com' } })).status, 400);
  assert.equal((await fetch(`${url}/api/tasks`, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 400);
  assert.equal((await fetch(`${url}/api/tasks`, { method: 'POST', body: '{}' })).status, 405);
  assert.equal((await fetch(`${url}/api/tasks?projectRoot=/tmp`)).status, 404);
  assert.equal((await fetch(`${url}/api/tasks/../artifact`)).status, 404);
  assert.deepEqual(fs.readdirSync(root), ['.git']);
});

test('task API reports unsafe project reads without exposing exception details', async t => {
  const missing = path.join(os.tmpdir(), `forgeflow-missing-task-root-${process.pid}-${Date.now()}`);
  const { url } = await fixture(t, missing);
  const response = await fetch(`${url}/api/tasks`);
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.match(body.error, /Task evidence could not be read/);
  assert.equal(JSON.stringify(body).includes(missing), false);
});


test('saved task evidence reaches the API and becomes stale after source edits', async t => {
  const { root, url } = await fixture(t);
  fs.writeFileSync(path.join(root, 'app.js'), 'original');
  const proofDir = path.join(root, '.forgeflow', 'proof');
  fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(path.join(proofDir, 'result.txt'), 'checked');
  createTask(root, { id: 'delivery', objective: 'Verified delivery', criteria: [{ id: 'c1', description: 'Works as expected' }] });
  recordEvidence(root, 'delivery', { event_id: 'proof1', kind: 'manual', status: 'passed', criterion_ids: ['c1'], artifact: '.forgeflow/proof/result.txt', reason: 'Verified' });
  checkpointTask(root, 'delivery', { event_id: 'checkpoint1', phase: 'validate', state: 'complete', note: 'Complete', session: { host: 'codex', id: 'private-session-id' } });
  const current = await (await fetch(`${url}/api/tasks`)).json();
  assert.equal(current.tasks[0].status, 'complete');
  assert.equal(current.tasks[0].criteria[0].status, 'verified');
  assert.equal(current.tasks[0].evidence[0].status, 'verified');
  assert.equal(current.tasks[0].evidence[0].artifact, '.forgeflow/proof/result.txt');
  assert.equal(JSON.stringify(current).includes(root), false);
  assert.equal(JSON.stringify(current).includes('private-session-id'), false);
  assert.equal(Object.hasOwn(current.tasks[0], 'workspace'), false);
  assert.equal(Object.hasOwn(current.tasks[0].evidence[0], 'source'), false);
  fs.writeFileSync(path.join(root, 'app.js'), 'changed');
  const stale = await (await fetch(`${url}/api/tasks`)).json();
  assert.equal(stale.tasks[0].status, 'needs-attention');
  assert.equal(stale.tasks[0].criteria[0].status, 'stale');
  assert.equal(stale.tasks[0].evidence[0].status, 'stale');
  assert.match(stale.tasks[0].next_action, /Rerun/);
  recordEvidence(root, 'delivery', { event_id: 'proof2', kind: 'manual', status: 'failed', criterion_ids: ['c1'], artifact: '.forgeflow/proof/result.txt', reason: 'Regression found' });
  const failed = await (await fetch(`${url}/api/tasks`)).json();
  assert.equal(failed.tasks[0].criteria[0].status, 'failed');
  assert.equal(failed.tasks[0].counts.failed, 1);
  assert.equal((await fetch(`${url}/.forgeflow/proof/result.txt`)).status, 404);
});

test('task scanner coalesces overlap, waits for worker termination and refreshes subsequent reads', async () => {
  const workers = [];
  let release;
  const scanner = createTaskScanner('/unused', { workerFactory: () => {
    const worker = new EventEmitter();
    worker.terminate = () => new Promise(resolve => { release = resolve; });
    workers.push(worker); return worker;
  } });
  try {
    const first = scanner.scan();
    assert.equal(scanner.scan(), first);
    assert.equal(workers.length, 1);
    workers[0].emit('message', { body: '{"tasks":[]}' });
    await Promise.resolve();
    assert.equal(scanner.scan(), first, 'termination retains the single worker slot');
    release();
    assert.equal(await first, '{"tasks":[]}');
    const second = scanner.scan();
    assert.notEqual(second, first);
    assert.equal(workers.length, 2);
    workers[1].emit('message', { body: '{"tasks":[1]}' });
    await Promise.resolve(); release();
    assert.equal(await second, '{"tasks":[1]}');
  } finally { await scanner.close(); }
});

test('task scanner releases failed, exited and timed-out workers and closes pending scans', async () => {
  const workers = [];
  const scanner = createTaskScanner('/unused', { timeoutMs: 30, workerFactory: () => {
    const worker = new EventEmitter();
    worker.terminated = false;
    worker.terminate = async () => { worker.terminated = true; };
    workers.push(worker); return worker;
  } });
  try {
    let result = scanner.scan();
    let rejection = assert.rejects(result, /fixture failure/);
    workers.at(-1).emit('error', new Error('fixture failure'));
    await rejection;
    assert.equal(workers.at(-1).terminated, true);
    await new Promise(resolve => setImmediate(resolve));
    result = scanner.scan();
    rejection = assert.rejects(result, /exited without a result/);
    workers.at(-1).emit('exit', 0); await rejection;
    await new Promise(resolve => setImmediate(resolve));
    await assert.rejects(scanner.scan(), /timed out/);
    assert.equal(workers.at(-1).terminated, true);
    await new Promise(resolve => setImmediate(resolve));
    result = scanner.scan();
    rejection = assert.rejects(result, /closed/);
    await scanner.close(); await rejection;
    assert.equal(workers.at(-1).terminated, true);
    await assert.rejects(scanner.scan(), /closed/);
  } finally { await scanner.close(); }
});

test('task scan worker failure does not poison a later real scan', async t => {
  const { root } = await fixture(t);
  const scanner = createTaskScanner(path.join(root, 'later'));
  try {
    const failed = scanner.scan();
    await assert.rejects(failed, /Task scan failed/);
    const later = path.join(root, 'later');
    fs.mkdirSync(later);
    execFileSync('git', ['init', '-q'], { cwd: later });
    let retry = failed;
    for (let i = 0; i < 100 && retry === failed; i++) {
      await new Promise(resolve => setTimeout(resolve, 10));
      retry = scanner.scan();
    }
    assert.notEqual(retry, failed, 'termination eventually frees the scanner for a fresh request');
    assert.deepEqual(JSON.parse(await retry).tasks, []);
  } finally { await scanner.close(); }
});

test('native worker calls cannot delay the response deadline or permit overlapping replacement workers', async () => {
  const entered = new Int32Array(new SharedArrayBuffer(4));
  let workers = 0;
  const scanner = createTaskScanner('/unused', { timeoutMs: 500, workerFactory: () => {
    workers++;
    return new Worker(`
      const { workerData } = require('node:worker_threads');
      Atomics.store(workerData, 0, 1);
      require('node:child_process').spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 2000)']);
    `, { eval: true, workerData: entered });
  } });
  const started = performance.now();
  try {
    const pending = scanner.scan();
    await assert.rejects(pending, /timed out/);
    assert.equal(Atomics.load(entered, 0), 1, 'worker reached its native subprocess');
    assert.ok(performance.now() - started < 1500, 'response deadline does not wait for the two-second native call');
    assert.equal(scanner.scan(), pending, 'draining scan retains the same rejected promise');
    await assert.rejects(scanner.scan(), /timed out/);
    assert.equal(workers, 1, 'new requests cannot spawn workers while termination is pending');
    await scanner.close();
    assert.ok(performance.now() - started >= 1500, 'close waits separately for native-call cleanup');
  } finally { await scanner.close(); }
});

test('closing rejects a pending response immediately but waits for worker cleanup', async () => {
  const worker = new EventEmitter();
  let release;
  worker.terminate = () => new Promise(resolve => { release = resolve; });
  const scanner = createTaskScanner('/unused', { workerFactory: () => worker });
  const response = scanner.scan();
  const rejected = assert.rejects(response, /closed/);
  let cleaned = false;
  const cleanup = scanner.close().then(() => { cleaned = true; });
  await rejected;
  assert.equal(cleaned, false);
  release();
  await cleanup;
  assert.equal(cleaned, true);
});

test('large task archives keep actual health requests responsive during verification', async t => {
  const { root, url } = await fixture(t);
  for (let i = 0; i < 1000; i++) fs.writeFileSync(path.join(root, `source-${i}.txt`), 'x'.repeat(4096));
  const task = createTask(root, { id: 'archive-0', objective: 'Archive responsiveness', criteria: [{ id: 'works', description: 'Works' }] });
  const directory = path.join(root, '.forgeflow', path.basename(root), 'tasks');
  for (let i = 1; i < 250; i++) fs.writeFileSync(path.join(directory, `archive-${i}.json`), JSON.stringify({ ...task, id: `archive-${i}` }));
  let taskFinished = false;
  const taskResponse = fetch(`${url}/api/tasks`).then(async response => {
    assert.equal(response.status, 200);
    const body = await response.json(); taskFinished = true; return body;
  });
  // Let the tasks request enter its verification path before querying health.
  await new Promise(resolve => setTimeout(resolve, 30));
  const started = performance.now();
  const health = await fetch(`${url}/api/health`);
  assert.equal(health.status, 200);
  assert.equal(taskFinished, false, 'health responds while archive verification is in flight');
  assert.ok(performance.now() - started < 1000, 'health does not wait for archive hashing');
  const body = await taskResponse;
  assert.equal(body.tasks.length, 250);
  assert.deepEqual(body.warnings, []);
});

test('both installed hosts execute their packaged task scan worker', async t => {
  const { installTemplate } = require('../../../scripts/forgeflow/install-template');
  const { root } = await fixture(t);
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-task-worker-installed-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const claudeHome = path.join(base, 'claude'), codexHome = path.join(base, 'codex');
  installTemplate({ target: 'both', claudeHome, codexHome });
  for (const home of [claudeHome, codexHome]) {
    const installed = require(path.join(home, 'forgeflow/services/dashboard/tasks.js'));
    const scanner = installed.createTaskScanner(root);
    try {
      const body = JSON.parse(await scanner.scan());
      assert.equal(body.project_root, path.basename(root));
      assert.deepEqual(body.tasks, []);
    } finally { await scanner.close(); }
  }
});
