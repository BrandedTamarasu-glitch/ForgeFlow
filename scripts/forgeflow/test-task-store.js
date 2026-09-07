#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { test } = require('node:test');
const store = require('./task-store');
const { runCheck } = require('./task');

function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function fixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-task-store-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q');
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src/code.js'), 'module.exports = 1;\n');
  fs.writeFileSync(path.join(root, 'outside.txt'), 'outside');
  fs.writeFileSync(path.join(root, '.gitignore'), '.forgeflow/\n');
  git(root, 'add', '.gitignore', 'src/code.js', 'outside.txt');
  git(root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'fixture');
  store.createTask(root, { id: 'task', objective: 'Verify behavior', criteria: [{ id: 'behavior', description: 'The behavior check passes' }], phases: ['build', 'test'], ...options });
  const artifact = `.forgeflow/${path.basename(root)}/proof.txt`;
  fs.writeFileSync(path.join(root, artifact), 'Observed behavior passed\n');
  return { root, artifact };
}
function proof(root, artifact, overrides = {}) {
  return store.recordEvidence(root, 'task', { event_id: 'proof', kind: 'manual', status: 'passed', criterion_ids: ['behavior'], reason: 'Observed expected behavior', artifact, ...overrides });
}
function view(root) { return store.taskView(root, store.readTask(root, 'task')); }

test('source edit, deletion, and new untracked file invalidate evidence without destroying history', t => {
  for (const change of ['edit', 'delete', 'untracked']) {
    const { root, artifact } = fixture(t);
    const historical = proof(root, artifact).evidence[0];
    assert.equal(view(root).criteria[0].status, 'verified');
    if (change === 'edit') fs.writeFileSync(path.join(root, 'src/code.js'), 'module.exports = 2;\n');
    if (change === 'delete') fs.unlinkSync(path.join(root, 'src/code.js'));
    if (change === 'untracked') fs.writeFileSync(path.join(root, 'src/new.js'), 'new source');
    assert.equal(view(root).criteria[0].status, 'stale', change);
    assert.deepEqual(store.readTask(root, 'task').evidence[0], historical);
  }
});

test('scope preserves evidence after unrelated edits and generated artifacts, but catches scoped additions', t => {
  const { root, artifact } = fixture(t, { scope: ['src'] });
  proof(root, artifact);
  fs.writeFileSync(path.join(root, 'outside.txt'), 'unrelated change');
  fs.writeFileSync(path.join(root, '.forgeflow/generated.txt'), 'generated');
  assert.equal(view(root).criteria[0].status, 'verified');
  fs.writeFileSync(path.join(root, 'src/new.js'), 'relevant');
  assert.equal(view(root).criteria[0].status, 'stale');
});

test('artifact replacement and deletion are detected independently of source scope', t => {
  const { root, artifact } = fixture(t, { scope: ['src'] });
  proof(root, artifact);
  fs.writeFileSync(path.join(root, artifact), 'Different report');
  assert.equal(view(root).evidence[0].freshness, 'stale');
  fs.unlinkSync(path.join(root, artifact));
  assert.equal(view(root).criteria[0].status, 'missing');
  assert.equal(view(root).ready, false);
});

test('binary artifact replacement changes its hash even when UTF-8 decoding would match', t => {
  const { root, artifact } = fixture(t);
  fs.writeFileSync(path.join(root, artifact), Buffer.from([0xff]));
  proof(root, artifact);
  fs.writeFileSync(path.join(root, artifact), Buffer.from([0xfe]));
  assert.equal(view(root).evidence[0].freshness, 'stale');
});

test('recording is idempotent and conflicting event reuse does not mutate evidence', t => {
  const { root, artifact } = fixture(t);
  proof(root, artifact);
  proof(root, artifact);
  assert.equal(store.readTask(root, 'task').evidence.length, 1);
  assert.throws(() => proof(root, artifact, { reason: 'Changed claim' }), /different input/);
  assert.equal(store.readTask(root, 'task').evidence.length, 1);
  assert.throws(() => proof(root, artifact, { event_id: 'bad-test', kind: 'test', command: ['node', '--test'], status: 'passed', exit_code: 1 }), /conflicts/);
});

test('record growth rejects before replacing the last readable task, below the event limit', t => {
  const scope = Array.from({ length: 500 }, (_, i) => `${String(i).padStart(3, '0')}-${'source-'.repeat(28)}.js`);
  const criteria = Array.from({ length: 100 }, (_, i) => ({ id: `criterion-${i}-${'c'.repeat(100)}`, description: 'Observed behavior' }));
  const { root, artifact } = fixture(t, { scope, criteria });
  for (const file of scope) fs.writeFileSync(path.join(root, file), 'module.exports = 1;\n');
  const file = path.join(store.taskDirectory(root), 'task.json');
  let previous = fs.readFileSync(file), rejected = false;
  for (let i = 0; i < 200; i++) {
    try { proof(root, artifact, { event_id: `growth-${i}`, criterion_ids: criteria.map(item => item.id) }); }
    catch (error) {
      assert.match(error.message, /Task record limit reached/);
      assert.deepEqual(fs.readFileSync(file), previous, 'Rejected growth must preserve the exact prior bytes');
      const saved = store.readTask(root, 'task');
      assert.equal(saved.evidence.length, i);
      assert.ok(saved.events.length < 2000);
      assert.equal(fs.existsSync(`${file}.lock`), false);
      assert.equal(fs.readdirSync(store.taskDirectory(root)).some(name => name.endsWith('.tmp')), false);
      // Existing event replay must still work after rejecting new growth.
      proof(root, artifact, { event_id: `growth-${i - 1}`, criterion_ids: criteria.map(item => item.id) });
      rejected = true;
      break;
    }
    previous = fs.readFileSync(file);
    assert.ok(previous.length <= 16 * 1024 * 1024);
  }
  assert.equal(rejected, true, 'Fixture must actually reach the byte boundary');
});

test('oversized initial task leaves no record or lock and can be retried with bounded input', t => {
  const { root } = fixture(t);
  const input = { id: 'oversized', objective: 'Reject an oversized scope', criteria: [{ id: 'check', description: 'Check' }] };
  // Scope paths need not exist; this syntactically valid input exceeds storage size.
  assert.throws(() => store.createTask(root, { ...input, scope: ['é'.repeat(8 * 1024 * 1024)] }), /Task record limit reached/);
  const file = path.join(store.taskDirectory(root), 'oversized.json');
  assert.equal(fs.existsSync(file), false);
  assert.equal(fs.existsSync(`${file}.lock`), false);
  store.createTask(root, input);
  assert.equal(store.readTask(root, 'oversized').id, 'oversized');
});

test('a task list shares captures by scope and artifact but refreshes them on the next call', t => {
  const { root, artifact } = fixture(t, { scope: ['src'] });
  proof(root, artifact);
  const original = store.readTask(root, 'task');
  for (let i = 0; i < 20; i++) {
    const task = { ...original, id: `copy-${i}` };
    store.atomicWrite(path.join(store.taskDirectory(root), `${task.id}.json`), task);
  }
  const sourceFile = path.join(root, 'src/code.js');
  const artifactFile = path.join(root, artifact);
  const read = fs.readFileSync;
  let sourceReads = 0, artifactReads = 0;
  t.mock.method(fs, 'readFileSync', function (file, ...args) {
    if (file === sourceFile) sourceReads++;
    if (file === artifactFile) artifactReads++;
    return read.call(this, file, ...args);
  });
  const first = store.listTasks(root);
  assert.equal(first.tasks.length, 21);
  assert.equal(first.tasks.every(task => task.ready), true);
  assert.equal(sourceReads, 2, 'Preserve double-capture instability detection, once for the shared scope');
  assert.equal(artifactReads, 2, 'Shared evidence uses one safe read and one binary hash read for the entire list');
  fs.writeFileSync(sourceFile, 'changed source');
  assert.equal(store.listTasks(root).tasks.every(task => task.criteria[0].status === 'stale'), true);
  assert.equal(sourceReads, 4, 'No source cache persists into the next list call');
  fs.writeFileSync(sourceFile, 'module.exports = 1;\n');
  fs.unlinkSync(artifactFile);
  assert.equal(store.listTasks(root).tasks.every(task => task.criteria[0].status === 'missing'), true);
});

test('rejects traversal, escaped symlinks, hardlinked artifacts, source hardlinks, and unsafe task destinations', t => {
  const { root, artifact } = fixture(t);
  assert.throws(() => store.readTask(root, '../escape'), /Invalid task id/);
  assert.throws(() => proof(root, '../escape'), /relative path/);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-task-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outside, 'secret'), 'outside');
  fs.symlinkSync(outside, path.join(root, '.forgeflow/link'));
  assert.throws(() => proof(root, '.forgeflow/link/secret'), /symlink/);
  fs.linkSync(path.join(root, artifact), path.join(root, '.forgeflow/hardlink'));
  assert.throws(() => proof(root, artifact), /hardlink/);
  fs.unlinkSync(path.join(root, '.forgeflow/hardlink'));
  fs.linkSync(path.join(root, 'src/code.js'), path.join(root, '.forgeflow/source-link'));
  assert.throws(() => store.sourceSnapshot(root), /hardlinked/);
  fs.unlinkSync(path.join(root, '.forgeflow/source-link'));
  const file = path.join(store.taskDirectory(root), 'task.json');
  const saved = fs.readFileSync(file);
  fs.unlinkSync(file);
  fs.symlinkSync(path.join(outside, 'secret'), file);
  assert.throws(() => store.readTask(root, 'task'), /symlink/);
  assert.throws(() => proof(root, artifact), /symlink/);
  assert.equal(fs.readFileSync(path.join(outside, 'secret'), 'utf8'), 'outside');
  fs.unlinkSync(file);
  fs.writeFileSync(file, saved);
  assert.equal(store.readTask(root, 'task').id, 'task');
});

test('completion requires criteria, accepts explicit waivers, preserves two host sessions, and invalidates completed state', t => {
  const { root } = fixture(t);
  const checkpoint = { event_id: 'complete', phase: 'test', state: 'complete', note: 'All criteria accounted for' };
  assert.throws(() => store.checkpointTask(root, 'task', checkpoint), /Cannot complete/);
  assert.throws(() => proof(root, undefined, { status: 'waived', reason: '' }), /reason/);
  proof(root, undefined, { status: 'waived', reason: 'Maintainer explicitly waived this fixture behavior' });
  assert.equal(view(root).criteria[0].status, 'waived');
  store.checkpointTask(root, 'task', { event_id: 'interrupt', phase: 'test', state: 'interrupted', note: 'Saved boundary', session: { host: 'codex', id: 'same-id' } });
  assert.equal(view(root).status, 'interrupted');
  store.resumeTask(root, 'task', { event_id: 'resume', session: { host: 'claude', id: 'same-id' } });
  assert.deepEqual(store.readTask(root, 'task').sessions, [{ host: 'codex', id: 'same-id' }, { host: 'claude', id: 'same-id' }]);
  store.checkpointTask(root, 'task', checkpoint);
  assert.equal(view(root).status, 'complete');
  fs.writeFileSync(path.join(root, 'src/code.js'), 'changed');
  assert.equal(view(root).status, 'needs-attention');
  assert.equal(view(root).history.at(-1).freshness, 'stale');
  store.resumeTask(root, 'task', { event_id: 'resume-changed' });
  assert.equal(store.readTask(root, 'task').state, 'active');
  assert.equal(view(root).ready, false);
});

test('unknown external actions prevent resume and completion until explicit reconciliation', t => {
  const { root, artifact } = fixture(t);
  proof(root, artifact);
  store.recordAction(root, 'task', { event_id: 'action', action_id: 'push', status: 'unknown', description: 'Simulated interrupted external action' });
  assert.throws(() => store.resumeTask(root, 'task', { event_id: 'resume' }), /Reconcile action push/);
  assert.throws(() => store.checkpointTask(root, 'task', { event_id: 'complete', phase: 'test', state: 'complete', note: 'Attempt complete' }), /Cannot complete/);
  assert.throws(() => store.recordAction(root, 'task', { event_id: 'resolve', action_id: 'push', status: 'not-performed', description: 'Observed status' }), /reconciliation evidence/);
  store.recordAction(root, 'task', { event_id: 'resolve', action_id: 'push', status: 'not-performed', description: 'Observed status', evidence: 'Fixture remote inspection confirmed no operation' });
  store.resumeTask(root, 'task', { event_id: 'resume' });
  assert.equal(view(root).ready, true);
});

test('CLI executes a real behavior check once, captures failures, and rejects source-changing checks', t => {
  const { root } = fixture(t);
  const input = { event_id: 'run', criterion_ids: ['behavior'], command: [process.execPath, '-e', "if(require('./src/code')!==1)process.exit(2);console.log('behavior verified')"] };
  const file = path.join(root, '.forgeflow/check.json');
  fs.writeFileSync(file, JSON.stringify(input));
  const cliArgs = [path.join(__dirname, 'task.js'), 'check', '--root', root, '--task', 'task', '--input', file];
  const result = spawnSync(process.execPath, cliArgs, { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const actual = JSON.parse(result.stdout);
  assert.equal(actual.criteria[0].status, 'verified');
  assert.match(fs.readFileSync(path.join(root, actual.evidence[0].artifact.path), 'utf8'), /behavior verified/);
  assert.equal(spawnSync(process.execPath, cliArgs, { encoding: 'utf8' }).status, 0);
  assert.equal(store.readTask(root, 'task').evidence.length, 1);
  const failed = runCheck(root, 'task', { ...input, event_id: 'failed', command: [process.execPath, '-e', 'process.exit(2)'] });
  assert.equal(failed.criteria[0].status, 'failed');
  assert.throws(() => runCheck(root, 'task', { ...input, event_id: 'mutating', command: [process.execPath, '-e', "require('fs').writeFileSync('src/code.js','changed')"] }), /Source changed during validation/);
  assert.equal(store.readTask(root, 'task').evidence.length, 2);
});

test('CLI retry preserves the requested failed check exit status after a later passing check', t => {
  const { root } = fixture(t);
  const failed = { event_id: 'failed', criterion_ids: ['behavior'], command: [process.execPath, '-e', 'process.exit(3)'] };
  runCheck(root, 'task', failed);
  runCheck(root, 'task', { ...failed, event_id: 'passed', command: [process.execPath, '-e', 'process.exit(0)'] });
  const file = path.join(root, '.forgeflow/retry.json');
  fs.writeFileSync(file, JSON.stringify(failed));
  const result = spawnSync(process.execPath, [path.join(__dirname, 'task.js'), 'check', '--root', root, '--task', 'task', '--input', file], { encoding: 'utf8' });
  assert.equal(result.status, 1, 'Retrying recorded failed evidence must retain failure exit status');
});

test('duplicate check recording does not execute the command twice', t => {
  const { root } = fixture(t);
  const input = { event_id: 'once', criterion_ids: ['behavior'], command: [process.execPath, '-e', "const fs=require('fs'),p='.forgeflow/count';const count=fs.existsSync(p)?Number(fs.readFileSync(p)):0;fs.writeFileSync(p,String(count+1))"] };
  runCheck(root, 'task', input);
  runCheck(root, 'task', input);
  assert.equal(fs.readFileSync(path.join(root, '.forgeflow/count'), 'utf8'), '1');
});

test('CLI retries of successful evidence exit nonzero after source or artifact changes without reexecution', t => {
  for (const changed of ['source', 'artifact']) {
    const { root } = fixture(t);
    const input = { event_id: 'once', criterion_ids: ['behavior'], command: [process.execPath, '-e', "const fs=require('fs'),p='.forgeflow/count';const count=fs.existsSync(p)?Number(fs.readFileSync(p)):0;fs.writeFileSync(p,String(count+1));console.log('Verified behavior')"] };
    const initial = runCheck(root, 'task', input);
    assert.equal(initial.evidence[0].freshness, 'current');
    if (changed === 'source') fs.writeFileSync(path.join(root, 'src/code.js'), 'module.exports = 2;\n');
    else fs.writeFileSync(path.join(root, initial.evidence[0].artifact.path), 'Replaced artifact');
    const file = path.join(root, '.forgeflow/stale-retry.json');
    fs.writeFileSync(file, JSON.stringify(input));
    const result = spawnSync(process.execPath, [path.join(__dirname, 'task.js'), 'check', '--root', root, '--task', 'task', '--input', file], { encoding: 'utf8' });
    assert.equal(result.status, 1, `${changed} change must invalidate successful check exit status`);
    assert.equal(JSON.parse(result.stdout).evidence[0].freshness, 'stale');
    assert.equal(fs.readFileSync(path.join(root, '.forgeflow/count'), 'utf8'), '1', 'Retry must not execute the check again');
    assert.equal(store.readTask(root, 'task').evidence.length, 1);
  }
});

test('invalid criterion mapping rejects a command before it can perform any operation', t => {
  const { root } = fixture(t);
  const input = { event_id: 'invalid', criterion_ids: ['does-not-exist'], command: [process.execPath, '-e', "require('fs').writeFileSync('.forgeflow/unexpected','executed')"] };
  assert.throws(() => runCheck(root, 'task', input), /criterion|criteria/i);
  assert.equal(fs.existsSync(path.join(root, '.forgeflow/unexpected')), false);
});

test('interrupted command claims cannot execute again or resume before reconciliation', t => {
  const { root } = fixture(t);
  store.recordAction(root, 'task', { event_id: 'interrupted-begin', action_id: 'check-interrupted', status: 'pending', description: 'Process interrupted after claiming command' });
  const input = { event_id: 'interrupted', criterion_ids: ['behavior'], command: [process.execPath, '-e', "require('fs').writeFileSync('.forgeflow/repeated','unexpected')"] };
  assert.throws(() => runCheck(root, 'task', input), /already started/);
  assert.equal(fs.existsSync(path.join(root, '.forgeflow/repeated')), false);
  assert.throws(() => store.resumeTask(root, 'task', { event_id: 'resume-interrupted' }), /Reconcile/);
});

test('lock recovery preserves live or invalid owners and clears only a dead writer without reconciling actions', t => {
  const { root } = fixture(t);
  store.recordAction(root, 'task', { event_id: 'pending', action_id: 'uncertain', status: 'unknown', description: 'External action outcome unknown' });
  const lock = path.join(store.taskDirectory(root), 'task.json.lock');
  fs.writeFileSync(lock, JSON.stringify({ pid: process.pid }));
  assert.throws(() => store.recoverTaskLock(root, 'task'), /still running/);
  assert.equal(fs.existsSync(lock), true);
  fs.writeFileSync(lock, JSON.stringify({ pid: 0 }));
  assert.throws(() => store.recoverTaskLock(root, 'task'), /Invalid lock owner/);
  assert.equal(fs.existsSync(lock), true);
  const finished = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
  assert.equal(finished.status, 0);
  fs.writeFileSync(lock, JSON.stringify({ pid: finished.pid }));
  const cli = spawnSync(process.execPath, [path.join(__dirname, 'task.js'), 'recover-lock', '--root', root, '--task', 'task'], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).recovered, true);
  assert.equal(fs.existsSync(lock), false);
  assert.equal(store.recoverTaskLock(root, 'task').recovered, false);
  assert.throws(() => store.resumeTask(root, 'task', { event_id: 'resume-after-lock' }), /Reconcile action uncertain/);
});

test('concurrent starts claim the command once even when both read the task before claiming', async t => {
  const { root } = fixture(t);
  const script = `
    const fs=require('fs'),path=require('path'),store=require(process.argv[1]);
    const root=process.argv[3],index=Number(process.argv[4]),snapshot=store.sourceSnapshot;
    store.sourceSnapshot=(...args)=>{
      const result=snapshot(...args),marker=path.join(root,'.forgeflow','ready-'+index);
      fs.writeFileSync(marker,'ready');
      const deadline=Date.now()+5000;
      while(!fs.existsSync(path.join(root,'.forgeflow','ready-'+(1-index)))){
        if(Date.now()>deadline)throw new Error('Barrier timed out');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);
      }
      if(index===1)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,180);
      return result;
    };
    const {runCheck}=require(process.argv[2]);
    try {runCheck(root,'task',{event_id:'concurrent-check',criterion_ids:['behavior'],command:[process.execPath,'-e',"require('fs').appendFileSync('.forgeflow/executions',String.fromCharCode(114,117,110,10));Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,450)"]});}
    catch(error){if(/locked|started|claim|busy/i.test(error.message))process.exit(2);throw error;}
  `;
  const results = await Promise.all([0, 1].map(index => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script, path.join(__dirname, 'task-store.js'), path.join(__dirname, 'task.js'), root, String(index)], { stdio: ['ignore', 'ignore', 'pipe'] });
    let error = '';
    child.stderr.on('data', chunk => { error += chunk; });
    child.once('error', reject);
    child.once('exit', code => resolve({ code, error }));
  })));
  for (const result of results) assert.ok([0, 2].includes(result.code), result.error);
  assert.equal(fs.readFileSync(path.join(root, '.forgeflow/executions'), 'utf8'), 'run\n');
});

test('concurrent checkpoint writers serialize or explicitly reject locks without losing successful events', async t => {
  const { root } = fixture(t);
  const script = `const store=require(process.argv[1]);try {store.checkpointTask(process.argv[2],'task',{event_id:process.argv[3],phase:'build',state:'active',note:'Concurrent checkpoint'});}catch(e){if(e.message.includes('locked'))process.exit(2);throw e;}`;
  const results = await Promise.all(Array.from({ length: 6 }, (_, index) => new Promise((resolve, reject) => {
    const id = `writer-${index}`;
    const child = spawn(process.execPath, ['-e', script, path.join(__dirname, 'task-store.js'), root, id], { stdio: ['ignore', 'ignore', 'pipe'] });
    let error = '';
    child.stderr.on('data', chunk => { error += chunk; });
    child.once('error', reject);
    child.once('exit', code => resolve({ id, code, error }));
  })));
  assert.ok(results.some(result => result.code === 0));
  for (const result of results) assert.ok([0, 2].includes(result.code), result.error);
  const task = store.readTask(root, 'task');
  assert.deepEqual(task.history.map(event => event.id).sort(), results.filter(result => result.code === 0).map(result => result.id).sort());
  assert.equal(fs.existsSync(path.join(store.taskDirectory(root), 'task.json.lock')), false);
});
