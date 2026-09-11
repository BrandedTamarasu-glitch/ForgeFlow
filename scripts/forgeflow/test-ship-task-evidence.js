#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const store = require('./task-store');
const { runCheck } = require('./task');
const { installTemplate } = require('./install-template');

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-ship-evidence-'));
const root = path.join(base, 'project with spaces');
fs.mkdirSync(root);
const project = path.join(root, '.forgeflow', path.basename(root));
const ship = path.join(project, 'ship');
const script = path.join(__dirname, 'ship-prepare.sh');
const env = { ...process.env, FORGEFLOW_ACTIVITY: 'off', FORGEFLOW_DASHBOARD_AUTO_OPEN: 'off',
  GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.invalid' };
function git(...args) {
  const result = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
}
function prepare(args = [], entry = script) {
  const result = spawnSync('bash', [entry, ...args], { cwd: root, env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return JSON.parse(fs.readFileSync(path.join(ship, 'ship-summary.json'), 'utf8'));
}
function check(task, event, code = 0) {
  return runCheck(root, task, { event_id: event, criterion_ids: ['works'], command: [process.execPath, '-e', `process.exit(${code})`] });
}
try {
  git('init', '-qb', 'main');
  fs.writeFileSync(path.join(root, '.gitignore'), '.forgeflow/\n');
  fs.writeFileSync(path.join(root, 'source.txt'), 'one\n');
  git('add', '.gitignore', 'source.txt'); git('commit', '-qm', 'fixture');
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(path.join(project, 'old.md'), 'OLD-TEST passed: obsolete result\n');
  fs.writeFileSync(path.join(project, 'review-history.md'), 'Final Verdict: APPROVE\nCompass Verdict: CONFIRM\n');
  fs.writeFileSync(path.join(project, 'implementation-notes.md'), '# Implementation Notes\n## Decisions\n- OLD-DECISION belongs to another task\n## Validation Notes\n- OLD-VALIDATION passed\n');
  let summary = prepare(['Legacy title']);
  assert.equal(summary.title, 'Legacy title');
  assert.equal(summary.task, null);
  assert.deepEqual(summary.tests, []);
  assert.equal(summary.reviewGate, 'unknown');
  assert.match(summary.validationSummary, /No task selected/);
  for (const file of ['ship-summary.json', 'ship-presentation.html', 'pr-body.md']) {
    const text = fs.readFileSync(path.join(ship, file), 'utf8');
    assert.doesNotMatch(text, /OLD-TEST|OLD-DECISION|OLD-VALIDATION/);
    assert.match(text, /Historical context|Historical Context/);
  }
  store.createTask(root, { id: 'selected', objective: 'Current scope', scope: ['source.txt'], criteria: [
    { id: 'works', description: 'Expected behavior works' }, { id: 'manual', description: 'Manual <script> check' },
  ] });
  check('selected', 'selected-pass');
  const proof = '.forgeflow/manual.md';
  fs.writeFileSync(path.join(root, proof), 'Observed manual behavior.\n');
  store.recordEvidence(root, 'selected', { event_id: 'manual-proof', kind: 'manual', status: 'passed', criterion_ids: ['manual'], artifact: proof, reason: 'Observed behavior.' });
  // A newer task must never become the implicit shipping target.
  store.createTask(root, { id: 'unrelated', objective: 'Other work', scope: ['source.txt'], criteria: [{ id: 'works', description: 'Unrelated criterion' }] });
  check('unrelated', 'unrelated-pass');
  assert.equal(prepare().task, null);
  summary = prepare(['--task', 'selected', 'Current', 'title']);
  assert.equal(summary.title, 'Current title');
  assert.equal(summary.task.id, 'selected');
  assert.equal(summary.task.ready, true);
  assert.equal(summary.tests.length, 1);
  assert.match(summary.tests[0], /selected-pass: passed/);
  assert.doesNotMatch(summary.tests.join(), /unrelated-pass|manual-proof/);
  assert.match(summary.manualChecks[0], /manual-proof/);
  assert.equal(summary.reviewGate, 'unknown', 'Task readiness must not imply reviewer approval');
  const html = fs.readFileSync(path.join(ship, 'ship-presentation.html'), 'utf8');
  assert.match(html, /Manual &lt;script&gt; check/);
  assert.doesNotMatch(html, /Manual <script> check/);
  assert.match(fs.readFileSync(path.join(ship, 'pr-body.md'), 'utf8'), /selected-pass: passed/);

  check('selected', 'selected-fail', 1);
  summary = prepare(['--task', 'selected']);
  assert.equal(summary.tests.length, 1);
  assert.match(summary.tests[0], /selected-fail: failed \(exit 1\)/);
  assert.doesNotMatch(JSON.stringify(summary.validationEvidence), /selected-pass/);
  assert.equal(summary.task.counts.failed, 1);

  fs.writeFileSync(path.join(root, 'source.txt'), 'changed\n');
  summary = prepare(['--task', 'selected']);
  assert.deepEqual(summary.tests, []);
  assert.deepEqual(summary.manualChecks, []);
  assert.equal(summary.task.counts.stale, 2);
  assert.match(fs.readFileSync(path.join(ship, 'pr-body.md'), 'utf8'), /2 stale/);
  fs.writeFileSync(path.join(root, 'source.txt'), 'one\n');
  fs.appendFileSync(path.join(root, proof), 'Evidence replaced.\n');
  summary = prepare(['--task', 'selected']);
  assert.deepEqual(summary.manualChecks, []);
  assert.equal(summary.task.counts.stale, 1);
  fs.unlinkSync(path.join(root, proof));
  assert.equal(prepare(['--task', 'selected']).task.counts.missing, 1);

  store.recordAction(root, 'selected', { event_id: 'pending-action', action_id: 'validation-pending', status: 'unknown', description: 'Interrupted validation needs reconciliation.' });
  summary = prepare(['--task', 'selected']);
  assert.equal(summary.task.ready, false);
  assert.match(summary.validationDetails.join(), /validation-pending: unknown/);
  const prior = fs.readFileSync(path.join(ship, 'ship-summary.json'), 'utf8');
  for (const args of [['--task'], ['--task', '../bad'], ['--task', 'missing'], ['--task', 'selected', '--task', 'unrelated']]) {
    const result = spawnSync('bash', [script, ...args], { cwd: root, env, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /task|Select/);
    assert.equal(fs.readFileSync(path.join(ship, 'ship-summary.json'), 'utf8'), prior);
  }
  fs.writeFileSync(path.join(root, 'source.txt'), 'new commit\n');
  git('add', 'source.txt'); git('commit', '-qm', 'advance source');
  assert.deepEqual(prepare(['--task', 'selected']).tests, []);

  // Exercise real Git layers, including a staged edit reversed in the worktree.
  const unusual = 'tab\tand\nnewline.txt';
  for (const name of ['deleted.txt', 'rename-old.txt', 'staged-only.txt', unusual]) {
    fs.writeFileSync(path.join(root, name), 'baseline\n');
  }
  fs.appendFileSync(path.join(root, '.gitignore'), 'ignored.tmp\n');
  git('add', '.gitignore', 'deleted.txt', 'rename-old.txt', 'staged-only.txt', unusual);
  git('commit', '-qm', 'inventory baseline');
  git('checkout', '-qb', 'inventory-preview');
  fs.writeFileSync(path.join(root, 'committed.txt'), 'branch addition\n');
  git('add', 'committed.txt'); git('commit', '-qm', 'branch change');
  fs.writeFileSync(path.join(root, 'source.txt'), 'staged version\n');
  fs.writeFileSync(path.join(root, 'staged-only.txt'), 'staged version\n');
  git('add', 'source.txt', 'staged-only.txt');
  fs.writeFileSync(path.join(root, 'source.txt'), 'unstaged version\n');
  fs.writeFileSync(path.join(root, 'staged-only.txt'), 'baseline\n');
  fs.unlinkSync(path.join(root, 'deleted.txt'));
  git('mv', 'rename-old.txt', 'rename-new.txt');
  fs.writeFileSync(path.join(root, unusual), 'edited\n');
  fs.mkdirSync(path.join(root, 'new folder'));
  fs.writeFileSync(path.join(root, 'new folder', 'new file.txt'), 'untracked\n');
  fs.writeFileSync(path.join(root, 'ignored.tmp'), 'excluded\n');
  const expectedFiles = [
    { status: 'A', path: 'committed.txt' },
    { status: 'D', path: 'deleted.txt' },
    { status: 'A', path: 'new folder/new file.txt' },
    { status: 'A', path: 'rename-new.txt' },
    { status: 'D', path: 'rename-old.txt' },
    { status: 'M', path: 'source.txt' },
    { status: 'M', path: 'staged-only.txt' },
    { status: 'M', path: unusual },
  ];
  const beforePreview = git('status', '--porcelain=v1', '-z');
  summary = prepare(['Inventory preview']);
  assert.deepEqual(summary.files, expectedFiles);
  assert.match(summary.impact, /8 changed file\(s\)/);
  assert.match(summary.summary, /index and working tree/);
  assert.equal(git('status', '--porcelain=v1', '-z'), beforePreview, 'Preview must preserve source and index');
  assert.deepEqual(prepare().files, expectedFiles, 'Generated state must not enter repeated previews');
  const inventoryHtml = fs.readFileSync(path.join(ship, 'ship-presentation.html'), 'utf8');
  for (const file of expectedFiles) assert.ok(inventoryHtml.includes(file.path));

  const claudeHome = path.join(base, 'claude'), codexHome = path.join(base, 'codex');
  installTemplate({ target: 'both', claudeHome, codexHome });
  for (const home of [claudeHome, codexHome]) {
    const installed = path.join(home, 'forgeflow/scripts/forgeflow/ship-prepare.sh');
    const result = prepare(['--task', 'selected'], installed);
    assert.deepEqual(result.files, expectedFiles);
    assert.equal(result.task.id, 'selected');
    assert.deepEqual(result.tests, []);
    assert.equal(result.reviewGate, 'unknown');
  }
  console.log('Shipping evidence: selection, supersession, source/artifact freshness, missing proof, pending actions, legacy isolation, working-tree inventory and both installed hosts passed.');
} finally { fs.rmSync(base, { recursive: true, force: true }); }
