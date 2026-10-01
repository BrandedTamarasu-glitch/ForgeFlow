#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildReviewWavePrep, prepareReview, parseArgs, renderMarkdown } = require('./render-review-wave-prep');

function makeContext(tokens) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-review-wave-prep-'));
  const contextDir = path.join(root, '.forgeflow', path.basename(root), 'context', 'latest');
  fs.mkdirSync(contextDir, { recursive: true });
  fs.writeFileSync(path.join(contextDir, 'file-manifest.json'), JSON.stringify({
    files: [
      { path: 'src/auth.ts', kind: 'security', size_bytes: 1200 },
      { path: 'src/service.ts', kind: 'service', size_bytes: 1200 },
      { path: 'docs/readme.md', kind: 'docs', size_bytes: 1200 },
    ],
  }));
  fs.writeFileSync(path.join(contextDir, 'context-telemetry.json'), JSON.stringify({ estimated_compact_tokens: tokens }));
  fs.writeFileSync(path.join(contextDir, 'synthesis-input.json'), JSON.stringify({ agent_packets: { builder: 'builder.md' } }));
  return { root, contextDir };
}

function makeEmptyContext() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-review-wave-empty-'));
  const contextDir = path.join(root, '.forgeflow', path.basename(root), 'context', 'latest');
  fs.mkdirSync(contextDir, { recursive: true });
  fs.writeFileSync(path.join(contextDir, 'file-manifest.json'), JSON.stringify({ files: [] }));
  fs.writeFileSync(path.join(contextDir, 'context-telemetry.json'), JSON.stringify({ estimated_compact_tokens: 0 }));
  fs.writeFileSync(path.join(contextDir, 'synthesis-input.json'), JSON.stringify({ agent_packets: {} }));
  return { root, contextDir };
}

const over = makeContext(12000);
const split = buildReviewWavePrep({ root: over.root, contextDir: over.contextDir, targetTokens: 8000, writeWaveFiles: true });
const markdown = renderMarkdown(split);
const under = makeContext(4000);
const ok = buildReviewWavePrep({ root: under.root, contextDir: under.contextDir, targetTokens: 8000 });
const empty = makeEmptyContext();
const incomplete = buildReviewWavePrep({ root: empty.root, contextDir: empty.contextDir, targetTokens: 8000 });
const opts = parseArgs(['--root', over.root, '--context-dir', over.contextDir, '--target-tokens', '8000', '--write-wave-files', '--json']);

const checks = [
  ['splits before review', split.status === 'split-before-review' && split.next.includes("--wave 'risk-core'")],
  ['split follow-through requires a measured budget check', split.follow_through.status === 'build-and-verify-first-wave' && split.follow_through.review_ready === false && split.follow_through.next_command.includes("--wave 'risk-core'")],
  ['writes wave file', fs.existsSync(path.join(over.contextDir, 'waves', 'risk-core-files.txt'))],
  ['under budget ok', ok.status === 'current-packet-ok' && ok.next.includes('current context pack') && ok.follow_through.review_ready === true],
  ['incomplete blocks review', incomplete.status === 'context-incomplete' && incomplete.next.includes('Rebuild') && incomplete.next_reason.includes('file manifest has no files') && incomplete.follow_through.review_ready === false && incomplete.follow_through.next_command === 'node scripts/forgeflow/build-context-pack.js --json'],
  ['renders boundary', markdown.includes('does not rebuild packets') && markdown.includes('## Follow Through')],
  ['parses args', opts.writeWaveFiles === true && opts.json === true && opts.targetTokens === 8000],
];

let failed = 0;
for (const [name, okValue] of checks) {
  if (!okValue) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('review wave prep: ok');


// Fixed preparation pipeline: source identities and retained effects are real Git
// fixtures; no providers, reviewers, network or application workflows are run.
const assert = require('assert');
const { execFileSync } = require('child_process');
const store = require('./task-store');
const preparationRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-review-prepare-'));
const git = args => execFileSync('git', args, { cwd: preparationRoot, stdio: 'pipe' });
git(['init', '-q']);
fs.writeFileSync(path.join(preparationRoot, '.gitignore'), '.forgeflow/\n');
fs.mkdirSync(path.join(preparationRoot, 'src'));
fs.writeFileSync(path.join(preparationRoot, 'src', 'service.js'), 'module.exports = value => value + 1;\n');
git(['add', '.']);
git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture']);
const inputDir = path.join(preparationRoot, '.forgeflow', 'inputs');
fs.mkdirSync(inputDir, { recursive: true });
const filesPath = path.join(inputDir, 'files.txt');
fs.writeFileSync(filesPath, 'src/service.js\n');
const prepOptions = { root: preparationRoot, prepId: 'small', filesPath, modeOverride: 'full', targetTokens: 16000 };
const ready = prepareReview(prepOptions);
assert.equal(ready.status, 'ready', JSON.stringify(ready.blocker));
assert.equal(ready.required_reviewers.length, 4);
assert.equal(ready.packets.length, 1);
assert(fs.existsSync(ready.evidence_ref_file));
const taskBefore = fs.readFileSync(path.join(store.taskDirectory(preparationRoot), `${ready.task_id}.json`), 'utf8');
const reused = prepareReview(prepOptions);
assert.equal(reused.status, 'ready', JSON.stringify(reused.blocker));
assert.equal(JSON.stringify(reused), JSON.stringify(ready), 'same-id receipt reuse');
assert.equal(fs.readFileSync(path.join(store.taskDirectory(preparationRoot), `${ready.task_id}.json`), 'utf8'), taskBefore, 'reuse must not record duplicate effects');
assert.equal(prepareReview({ ...prepOptions, targetTokens: 14000 }).blocker.code, 'inputs-changed');
const cancelled = prepareReview({ ...prepOptions, prepId: 'cancelled', signal: { aborted: true } });
assert.equal(cancelled.blocker.code, 'cancelled');
assert(!fs.existsSync(path.join(store.taskDirectory(preparationRoot), 'review-prep-cancelled.json')));
let cancellationChecks = 0;
const duringCancel = prepareReview({ ...prepOptions, prepId: 'cancel-during', signal: { get aborted() { return ++cancellationChecks >= 3; } } });
assert.equal(duringCancel.blocker.code, 'cancelled');
const retainedTask = store.readTask(preparationRoot, duringCancel.task_id);
assert(retainedTask.actions.some(action => action.id === 'capture-inputs' && action.status === 'confirmed'));
assert(!retainedTask.actions.some(action => action.id === 'scope'), 'cancellation must stop before claiming another mutation');
const resumedCancel = prepareReview({ ...prepOptions, prepId: 'cancel-during' });
assert.equal(resumedCancel.status, 'ready', JSON.stringify(resumedCancel.blocker));
const occupiedId = 'review-prep-occupied';
store.createTask(preparationRoot, { id: occupiedId, objective: 'occupied fixture', criteria: [{ id: 'prepared', description: 'fixture' }] });
store.recordAction(preparationRoot, occupiedId, { event_id: 'claim', action_id: 'context', status: 'pending', description: 'unknown existing writer', exclusive: true });
const occupied = prepareReview({ ...prepOptions, prepId: 'occupied' });
assert.equal(occupied.blocker.code, 'unreconciled-action');
store.recordAction(preparationRoot, occupiedId, { event_id: 'unknown', action_id: 'context', status: 'unknown', description: 'interrupted writer' });
assert.equal(prepareReview({ ...prepOptions, prepId: 'occupied' }).blocker.code, 'unreconciled-action');
const overPrepared = prepareReview({ ...prepOptions, prepId: 'over', targetTokens: 1000 });
assert.equal(overPrepared.status, 'blocked');
assert.equal(overPrepared.blocker.code, 'manual-scope-needed');
assert(overPrepared.evidence_ref && fs.existsSync(overPrepared.run_dir));
const receiptBytes = fs.readFileSync(ready.receipt_path);
fs.appendFileSync(ready.receipt_path, ' ');
assert.equal(prepareReview(prepOptions).blocker.code, 'artifacts-changed');
fs.writeFileSync(ready.receipt_path, receiptBytes);
fs.appendFileSync(path.join(preparationRoot, 'src', 'service.js'), '// changed\n');
assert.equal(prepareReview(prepOptions).blocker.code, 'source-changed');
assert.equal(prepareReview({ ...prepOptions, prepId: '../escape' }).blocker.code, 'invalid-prep-id');
assert.equal(prepareReview({ ...prepOptions, prepId: 'badlimit', maxWaves: 17 }).blocker.code, 'invalid-wave-limit');

// Concurrent native callers share one preparation identity. Exactly one context
// mutation is journaled even when both processes enter at the same time.
const helper = path.join(__dirname, 'render-review-wave-prep.js');
const concurrentInput = { ...prepOptions, prepId: 'concurrent' };
const concurrentScript = `
const { spawn } = require('child_process');
const code = ${JSON.stringify(`const result = require(${JSON.stringify(helper)}).prepareReview(${JSON.stringify(concurrentInput)}); console.log(JSON.stringify({status: result.status, code: result.blocker?.code}));`)};
Promise.all([0, 1].map(() => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['-e', code]); let output = '';
  child.stdout.on('data', value => output += value);
  child.on('error', reject); child.on('exit', status => status === 0 ? resolve(JSON.parse(output)) : reject(new Error('Concurrent fixture child failed')));
}))).then(results => console.log(JSON.stringify(results))).catch(error => { console.error(error.message); process.exitCode = 1; });`;
const callers = JSON.parse(execFileSync(process.execPath, ['-e', concurrentScript], { encoding: 'utf8', timeout: 15000 }));
assert(callers.some(caller => caller.status === 'ready'));
const concurrentTask = store.readTask(preparationRoot, 'review-prep-concurrent');
assert.equal(concurrentTask.actions.filter(action => action.id === 'context').length, 1);
assert.equal(concurrentTask.events.filter(event => event.id === 'claim-context').length, 1);
assert.equal(prepareReview(concurrentInput).status, 'ready');

// Many small independently reviewable files force a real bounded split. Long
// source names make full-scope routing/context overhead measurable, without
// invented telemetry or editing sealed evidence.
const splitFiles = [];
for (let i = 0; i < 40; i += 1) {
  const file = `src/module-${i}-${'scope'.repeat(30)}.js`;
  fs.writeFileSync(path.join(preparationRoot, file), `module.exports = ${i};\n`);
  splitFiles.push(file);
}
const splitList = path.join(inputDir, 'split-files.txt');
fs.writeFileSync(splitList, `${splitFiles.join('\n')}\n`);
const preparedSplit = prepareReview({ ...prepOptions, prepId: 'split-ready', filesPath: splitList, targetTokens: 14000 });
assert.equal(preparedSplit.status, 'ready', JSON.stringify(preparedSplit.blocker));
assert(preparedSplit.packets.length > 1, 'fixture must actually use bounded child packets');
assert(preparedSplit.packets.every(packet => packet.mode === 'full-mode' && packet.required_reviewers.length === 4));
assert(splitFiles.every(file => preparedSplit.packets.some(packet => packet.files.includes(file))));
assert.equal(prepareReview({ ...prepOptions, prepId: 'split-ready', filesPath: splitList, targetTokens: 14000 }).status, 'ready');

console.log('deterministic review preparation: ok');
