'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync, spawn } = require('child_process');
const evidence = require('./review-evidence');
let passed = 0;
function check(name, operation) { operation(); passed++; process.stdout.write(`ok ${passed} - ${name}\n`); }
function repository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-evidence-'));
  const git = args => { const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); };
  git(['init', '-q']); fs.writeFileSync(path.join(root, 'source.txt'), 'one\ntwo\nthree\nfour\nfive\n'); git(['add', 'source.txt']);
  git(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'base']);
  return root;
}
function build(root, options = {}) {
  const handle = evidence.beginRun({ root, scope: ['source.txt'], ...options });
  evidence.captureInput(handle, { id: 'source', path: 'source.txt' });
  return { handle, ref: evidence.sealRun(handle) };
}
function execute(code) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', code], { env: process.env }); let stdout = '', stderr = '';
    child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
    child.on('error', reject); child.on('close', status => { if (status) reject(new Error(stderr)); else resolve(stdout.trim()); });
  });
}
(async () => {
  const root = repository(), first = build(root), original = fs.readFileSync(first.ref.manifest_path);
  check('sealed full bytes and expected identity', () => {
    const result = evidence.inspectRun({ root, ref: first.ref }); assert.equal(result.integrity, 'current'); assert.equal(result.source, 'current'); assert.equal(result.coverage, 'full');
    assert.throws(() => evidence.captureInput(first.handle, { id: 'late', bytes: 'late' }), /Sealed/);
    assert.throws(() => evidence.inspectRun({ root, ref: { ...first.ref, manifest_sha256: undefined } }), /expected manifest/);
  });
  check('retrieval includes neighbors and refuses decisive excerpt as raw proof', () => {
    const result = evidence.retrieveArtifact({ root, ref: first.ref, artifactId: 'source', startLine: 3, endLine: 3 });
    assert.equal(result.content, 'two\nthree\nfour'); assert.equal(result.coverage, 'excerpted'); assert.equal(result.omitted_before_lines, 1);
    assert.throws(() => evidence.retrieveArtifact({ root, ref: first.ref, artifactId: 'source', startLine: 3, endLine: 3, rawRequired: true }), /Raw proof/);
    assert.equal(evidence.retrieveArtifact({ root, ref: first.ref, artifactId: 'source', rawRequired: true }).coverage, 'full');
  });
  check('rebuild preserves earlier sealed proof', () => { const next = build(root); assert.notEqual(next.ref.run_id, first.ref.run_id); assert.deepEqual(fs.readFileSync(first.ref.manifest_path), original); });
  check('stale source differs from artifact integrity', () => {
    fs.appendFileSync(path.join(root, 'source.txt'), 'six\n'); const result = evidence.inspectRun({ root, ref: first.ref }); assert.equal(result.source, 'stale'); assert.equal(result.integrity, 'current');
    assert.throws(() => evidence.recordConsumption({ root, ref: first.ref, id: 'old', kind: 'review', artifactIds: ['source'] }), /current source/);
  });
  const current = build(root);
  check('changed and missing artifacts distinct', () => {
    const artifact = path.join(current.ref.run_dir, 'artifacts', 'source'); fs.appendFileSync(artifact, 'tamper'); assert.equal(evidence.inspectRun({ root, ref: current.ref }).integrity, 'changed'); fs.unlinkSync(artifact); assert.equal(evidence.inspectRun({ root, ref: current.ref }).integrity, 'missing');
  });
  check('manifest tamper is changed even when artifacts remain', () => {
    const tampered = build(root); fs.appendFileSync(tampered.ref.manifest_path, ' '); assert.equal(evidence.inspectRun({ root, ref: tampered.ref }).integrity, 'changed');
  });
  check('interrupted run is inspectable and never complete', () => {
    const interrupted = evidence.beginRun({ root, scope: ['source.txt'] }); const ref = { schema_version: '1', run_id: interrupted.run_id, run_dir: interrupted.run_dir, manifest_path: path.join(interrupted.run_dir, 'manifest.json'), manifest_sha256: null, scope: ['source.txt'] };
    const result = evidence.inspectRun({ root, ref }); assert.equal(result.build_state, 'incomplete'); assert.equal(result.integrity, 'missing');
    const cli = spawnSync(process.execPath, [path.join(__dirname, 'review-evidence-cli.js'), 'inspect', '--root', root, '--run', interrupted.run_id, '--scope', '["source.txt"]'], { encoding: 'utf8' }); assert.equal(cli.status, 0, cli.stderr); assert.equal(JSON.parse(cli.stdout).build_state, 'incomplete');
  });
  check('descriptor rejects symlink hardlink traversal and FIFO', () => {
    const handle = evidence.beginRun({ root, scope: ['source.txt'] });
    fs.symlinkSync('source.txt', path.join(root, 'symbol')); fs.linkSync(path.join(root, 'source.txt'), path.join(root, 'hard'));
    assert.throws(() => evidence.captureInput(handle, { id: 'symlink', path: 'symbol' }), /Unsafe/);
    assert.throws(() => evidence.captureInput(handle, { id: 'hard', path: 'hard' }), /Unsafe/); fs.unlinkSync(path.join(root, 'hard'));
    assert.throws(() => evidence.captureInput(handle, { id: 'escape', path: '../outside' }), /outside/);
    const fifo = path.join(root, 'fifo'); const made = spawnSync('mkfifo', [fifo]); assert.equal(made.status, 0); assert.throws(() => evidence.captureInput(handle, { id: 'fifo', path: 'fifo' }), /Unsafe/); fs.unlinkSync(fifo);
  });
  check('descriptor detects actual replacement during read', () => {
    const file = path.join(root, 'replacement'); fs.writeFileSync(file, 'old'); const read = fs.readSync;
    fs.readSync = (...args) => { const count = read(...args); fs.unlinkSync(file); fs.writeFileSync(file, 'new'); return count; };
    try { assert.throws(() => evidence.readInputFile({ path: file, root }), /changed/); } finally { fs.readSync = read; }
  });
  check('exact artifact byte and count boundaries refuse without truncation', () => {
    const handle = evidence.beginRun({ root, scope: ['source.txt'], limits: { artifactBytes: 4, artifactCount: 1 } });
    assert.throws(() => evidence.captureInput(handle, { id: 'oversized', bytes: '12345' }), /limit/);
    const record = evidence.captureInput(handle, { id: 'exact', bytes: '1234' }); assert.equal(record.bytes, 4);
    assert.throws(() => evidence.captureInput(handle, { id: 'extra', bytes: '' }), /limit/);
  });
  check('aggregate capacity refuses preserving prior captured bytes', () => {
    const handle = evidence.beginRun({ root, scope: ['source.txt'], limits: { runBytes: 2000 } });
    evidence.captureInput(handle, { id: 'small', bytes: 'ok' }); assert.throws(() => evidence.captureInput(handle, { id: 'large', bytes: Buffer.alloc(2000) }), /capacity/); assert.equal(fs.readFileSync(path.join(handle.run_dir, 'artifacts/small'), 'utf8'), 'ok');
    assert.throws(() => evidence.beginRun({ root, scope: ['source.txt'], limits: { archiveBytes: 1 } }), /capacity/); assert.deepEqual(fs.readFileSync(first.ref.manifest_path), original);
  });
  check('source mutation during build refuses seal', () => {
    const handle = evidence.beginRun({ root, scope: ['source.txt'] }); evidence.captureInput(handle, { id: 'source', path: 'source.txt' }); fs.appendFileSync(path.join(root, 'source.txt'), 'seven'); assert.throws(() => evidence.sealRun(handle), /Source changed/); assert.equal(fs.existsSync(path.join(handle.run_dir, 'manifest.json')), false);
  });
  check('explicit legacy unknown source never claims current proof', () => {
    const legacy = fs.mkdtempSync(path.join(os.tmpdir(), 'review-legacy-')); const handle = evidence.beginRun({ root: legacy, allowUnknownSource: true }); evidence.captureInput(handle, { id: 'bytes', bytes: 'legacy', coverage: 'excerpted' });
    const ref = evidence.sealRun(handle), result = evidence.inspectRun({ root: legacy, ref }); assert.equal(result.source, 'unknown'); assert.equal(result.coverage, 'excerpted'); assert.throws(() => evidence.recordConsumption({ root: legacy, ref, id: 'invalid', kind: 'review', artifactIds: ['bytes'] }), /current source/);
    assert.throws(() => evidence.beginRun({ root: legacy }), /Cannot inspect/);
  });
  check('sidecars preserve full decision/result and do not mutate parent', () => {
    const run = build(root), before = fs.readFileSync(run.ref.manifest_path); const directory = path.join(root, '.forgeflow', 'outputs'); fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(path.join(directory, 'result'), 'complete result'); fs.writeFileSync(path.join(directory, 'decision'), 'complete decision');
    const options = { root, ref: run.ref, id: 'decision-1', kind: 'review', resultPath: '.forgeflow/outputs/result', decisionPath: '.forgeflow/outputs/decision', artifactIds: ['source'] };
    const sidecar = evidence.recordConsumption(options); assert.equal(fs.readFileSync(path.join(sidecar.directory, 'result'), 'utf8'), 'complete result'); assert.equal(JSON.parse(fs.readFileSync(sidecar.manifest_path)).claim_truth, 'not_assessed'); assert.deepEqual(fs.readFileSync(run.ref.manifest_path), before); assert.throws(() => evidence.recordConsumption(options), /EEXIST/);
  });
  check('projection rejects hardlinked destinations before changing any earlier file', () => {
    const run = build(root), out = run.handle.out_dir; fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'first'), 'preserved'); fs.writeFileSync(path.join(out, 'second'), 'hard'); fs.linkSync(path.join(out, 'second'), path.join(root, 'projection-hard'));
    assert.throws(() => evidence.publishProjection(run.handle, { files: [{ source: 'artifacts/source', destination: 'first' }, { source: 'artifacts/source', destination: 'second' }] }), /hardlinked/); assert.equal(fs.readFileSync(path.join(out, 'first'), 'utf8'), 'preserved'); fs.unlinkSync(path.join(root, 'projection-hard'));
  });
  const concurrent = repository(), modulePath = path.join(__dirname, 'review-evidence.js');
  const code = `const e=require(${JSON.stringify(modulePath)});const root=${JSON.stringify(concurrent)};const h=e.beginRun({root,scope:['source.txt']});e.captureInput(h,{id:'source',path:'source.txt'});const ref=e.sealRun(h);e.publishProjection(h,{files:[{source:'artifacts/source',destination:'source-copy'}]});console.log(JSON.stringify(ref));`;
  const refs = (await Promise.all([execute(code), execute(code), execute(code)])).map(JSON.parse);
  check('concurrent processes preserve separate runs and a coherent published reference', () => {
    assert.equal(new Set(refs.map(ref => ref.run_id)).size, 3); for (const ref of refs) assert.equal(evidence.inspectRun({ root: concurrent, ref }).integrity, 'current');
    const published = evidence.readProjectionReference({ root: concurrent, outDir: path.join(concurrent, '.forgeflow', path.basename(concurrent), 'context/latest') }); assert(refs.some(ref => ref.run_id === published.run_id));
  });
  process.stdout.write(`${passed} evidence checks passed\n`);
})().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
