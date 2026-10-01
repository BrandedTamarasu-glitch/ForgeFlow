#!/usr/bin/env node
'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const evidence = require('./review-evidence');
const { buildContextPack } = require('./build-context-pack');
const { buildContextWavePlan } = require('./render-context-wave-plan');
const { buildContextWave } = require('./build-context-wave');
const { buildReviewWavePrep } = require('./render-review-wave-prep');
const { recordProjectLearning, projectLearningId } = require('./record-project-learning');
const { connect, publishNote } = require('./vault-memory');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-evidence-acceptance-'));
const git = args => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.error?.message || result.stderr);
  return result.stdout;
};
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function inventory(directory) {
  const result = {};
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const [name, hash] of Object.entries(inventory(file))) result[`${entry.name}/${name}`] = hash;
    } else result[entry.name] = sha(fs.readFileSync(file));
  }
  return result;
}
let passed = 0;
function check(name, operation) { operation(); console.log(`ok ${++passed} - ${name}`); }
git(['init', '-q']);
fs.writeFileSync(path.join(root, '.gitignore'), '.forgeflow/\n');
for (let index = 0; index < 8; index++) fs.writeFileSync(path.join(root, `source-${index}.txt`), `initial ${index}\n`);
git(['add', '.']);
git(['-c', 'user.name=Local Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'initial']);
for (let index = 0; index < 8; index++) fs.appendFileSync(path.join(root, `source-${index}.txt`), `changed ${index}\n`);
check('default artifact ceiling accepts exact 16 MiB and refuses one extra byte', () => {
  const handle = evidence.beginRun({ root, scope: ['source-0.txt'] });
  assert.throws(() => evidence.captureInput(handle, { id: 'too-large', bytes: Buffer.alloc(16 * 1024 * 1024 + 1) }), /limit/);
  const bytes = Buffer.alloc(16 * 1024 * 1024, 0x61);
  const record = evidence.captureInput(handle, { id: 'exact', bytes });
  assert.equal(record.bytes, bytes.length);
  const ref = evidence.sealRun(handle);
  const retrieved = evidence.retrieveArtifact({ root, ref, artifactId: 'exact', rawRequired: true });
  assert.equal(retrieved.full_sha256, sha(bytes));
  assert.deepEqual(Buffer.from(retrieved.content_base64, 'base64'), bytes);
});
check('binary raw proof preserves invalid UTF-8 and rejects text-only retrieval', () => {
  const handle = evidence.beginRun({ root, scope: ['source-0.txt'] });
  const bytes = Buffer.from([0xff, 0x00, 0xc3, 0x28, 0x0a, 0x80]);
  evidence.captureInput(handle, { id: 'binary', bytes });
  const ref = evidence.sealRun(handle);
  assert.throws(() => evidence.retrieveArtifact({ root, ref, artifactId: 'binary' }), /Binary/);
  const result = evidence.retrieveArtifact({ root, ref, artifactId: 'binary', rawRequired: true });
  assert.equal(result.encoding, 'base64');
  assert.equal(result.coverage, 'full');
  assert.deepEqual(Buffer.from(result.content_base64, 'base64'), bytes);
  assert.throws(() => evidence.retrieveArtifact({ root, ref, artifactId: 'binary', rawRequired: true, maxChars: 5 }), /Raw proof/);
});
const pack = buildContextPack({ root, modeOverride: 'full', memoryIndex: false, maxDiffChars: 32 });
const before = inventory(pack.run_dir);
check('interrupted captured inventory remains inspectable without a seal', () => {
  const handle = evidence.beginRun({ root });
  const record = evidence.captureInput(handle, { id: 'saved', bytes: 'retained incomplete input' });
  const ref = { schema_version: '1', run_id: handle.run_id, run_dir: handle.run_dir, manifest_path: path.join(handle.run_dir, 'manifest.json'), manifest_sha256: null, scope: [] };
  const result = evidence.inspectRun({ root, ref });
  assert.equal(result.build_state, 'incomplete');
  assert.equal(result.artifacts.find(item => item.id === 'saved').sha256, record.sha256);
  assert.equal(result.artifacts[0].integrity, 'current');
});
let sidecar;
check('sidecar inspection verifies saved result and decision bytes', () => {
  const resultFile = path.join(root, '.forgeflow', 'result');
  const decisionFile = path.join(root, '.forgeflow', 'decision');
  fs.writeFileSync(resultFile, 'actual local result\n');
  fs.writeFileSync(decisionFile, 'actual local decision\n');
  sidecar = evidence.recordConsumption({ root, ref: pack.evidence_ref, id: 'selected', kind: 'review', resultPath: resultFile, decisionPath: decisionFile, artifactIds: ['git-diff-full'] });
  const inspection = evidence.inspectConsumption({ root, ref: sidecar });
  assert.equal(inspection.integrity, 'current');
  assert.equal(inspection.source, 'current');
  assert.equal(inspection.claim_truth, 'not_assessed');
  fs.appendFileSync(path.join(sidecar.directory, 'result'), 'tamper');
  assert.equal(evidence.inspectConsumption({ root, ref: sidecar }).integrity, 'changed');
  fs.writeFileSync(path.join(sidecar.directory, 'result'), 'actual local result\n');
});
check('compatibility projection refuses every retained consumption subtree before writes', () => {
  const consumptionRoot = path.join(path.dirname(path.dirname(pack.run_dir)), 'consumptions');
  const retainedBefore = inventory(consumptionRoot);
  for (const outDir of [consumptionRoot, path.join(consumptionRoot, 'unaccounted'), sidecar.directory]) {
    const handle = evidence.beginRun({ root, outDir });
    evidence.captureInput(handle, { id: 'projection-source', bytes: 'cannot bypass archive accounting' });
    evidence.sealRun(handle);
    assert.throws(() => evidence.publishProjection(handle, { files: [{ source: 'artifacts/projection-source', destination: 'unexpected' }] }), /retained archive/);
    assert.deepEqual(inventory(consumptionRoot), retainedBefore);
    assert.equal(fs.existsSync(path.join(outDir, 'unexpected')), false);
  }
  assert.deepEqual(inventory(pack.run_dir), before);
});
check('bounded packet retains independently computed complete Git diff', () => {
  const result = evidence.retrieveArtifact({ root, ref: pack.evidence_ref, artifactId: 'git-diff-full', rawRequired: true });
  const expected = git(['diff', '--binary', '--no-ext-diff', 'HEAD', '--', ...pack.evidence_ref.scope]);
  assert.equal(result.content, expected);
  assert.ok(expected.length > 32);
  assert.equal(result.full_sha256, sha(Buffer.from(expected)));
});
const telemetry = JSON.parse(fs.readFileSync(path.join(pack.run_dir, 'context-telemetry.json')));
const targetTokens = Math.max(1000, Math.ceil(telemetry.estimated_compact_tokens / 2));
check('wave lists refuse writes inside sealed parent', () => {
  assert.throws(() => buildContextWavePlan({ root, evidenceRef: pack.evidence_ref, targetTokens, writeWaveFiles: true, waveDir: path.join(pack.run_dir, 'waves') }), /outside sealed/);
  assert.deepEqual(inventory(pack.run_dir), before);
});
check('child wave retains parent bytes and uses separate pinned telemetry', () => {
  const built = buildContextWave({ root, evidenceRef: pack.evidence_ref, targetTokens });
  assert.equal(built.status, 'built', JSON.stringify(built));
  const ref = built.automation_handoff.review_packet.evidence_ref;
  assert.notEqual(ref.run_id, pack.evidence_ref.run_id);
  assert.equal(evidence.inspectRun({ root, ref }).integrity, 'current');
  assert.ok(built.automation_handoff.verification_command.includes(ref.run_dir));
  assert.deepEqual(inventory(pack.run_dir), before);
});
check('stale parent refuses wave preparation and preserves historical proof', () => {
  fs.appendFileSync(path.join(root, 'source-0.txt'), 'later\n');
  assert.throws(() => buildContextWave({ root, evidenceRef: pack.evidence_ref, targetTokens }), /stale/);
  const result = evidence.retrieveArtifact({ root, ref: pack.evidence_ref, artifactId: 'git-diff-full', rawRequired: true });
  assert.equal(result.source, 'stale');
  assert.equal(evidence.inspectConsumption({ root, ref: sidecar }).source, 'stale');
  assert.deepEqual(inventory(pack.run_dir), before);
});
check('generated output capacity refusal preserves earlier archive and respects cap', () => {
  const cappedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'review-evidence-cap-'));
  fs.writeFileSync(path.join(cappedRoot, 'source.txt'), 'bounded source\n');
  const archive = path.join(cappedRoot, '.forgeflow', path.basename(cappedRoot), 'context', 'runs');
  const cap = 12000;
  assert.throws(() => buildContextPack({ root: cappedRoot, modeOverride: 'full', memoryIndex: false, evidenceLimits: { runBytes: cap, archiveBytes: cap } }), /capacity/i);
  const bytes = directory => fs.readdirSync(directory, { withFileTypes: true }).reduce((total, entry) => total + (entry.isDirectory() ? bytes(path.join(directory, entry.name)) : fs.statSync(path.join(directory, entry.name)).size), 0);
  assert.ok(bytes(archive) <= cap, `retained ${bytes(archive)} exceeds ${cap}`);
  assert.deepEqual(inventory(pack.run_dir), before);
});
check('sealed unknown source cannot become within-budget ready proof', () => {
  const unknownRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'review-evidence-unknown-'));
  const handle = evidence.beginRun({ root: unknownRoot, allowUnknownSource: true });
  for (const [file, value] of Object.entries({
    'file-manifest.json': { files: [{ path: 'source.txt', kind: 'code', size_bytes: 1 }] },
    'context-telemetry.json': { estimated_compact_tokens: 10 },
    'synthesis-input.json': { agent_packets: { builder: 'builder.md' } },
  })) {
    evidence.writeOutput(handle, path.join(handle.run_dir, file), JSON.stringify(value));
    evidence.captureOutput(handle, { id: file.replaceAll('.', '-'), path: file });
  }
  const ref = evidence.sealRun(handle);
  assert.equal(evidence.inspectRun({ root: unknownRoot, ref }).source, 'unknown');
  assert.throws(() => buildReviewWavePrep({ root: unknownRoot, evidenceRef: ref, contextDir: ref.run_dir }), /unknown|current|stale/);
  assert.throws(() => buildContextWave({ root: unknownRoot, evidenceRef: ref, contextDir: ref.run_dir }), /unknown|current|stale/);
});
check('feedback and original candidate evidence retain complete bytes and control metadata', () => {
  const projectDir = path.join(root, '.forgeflow', path.basename(root));
  const originalEvidence = path.join(projectDir, 'original-proof.txt');
  fs.writeFileSync(originalEvidence, 'complete original memory proof\n');
  const entry = { category: 'validation-pattern', learning: 'Retained source validation guidance.', source: 'local fixture', dependencies: ['source-0.txt'], evidence_refs: [path.relative(root, originalEvidence)] };
  recordProjectLearning({ root, projectDir, inputEntries: [entry] });
  const feedbackFile = path.join(projectDir, 'task-memory-feedback.jsonl');
  const feedback = JSON.stringify({ learning_id: projectLearningId(entry), outcome: 'contradicted', causal_usefulness: null }) + '\n';
  fs.writeFileSync(feedbackFile, feedback);
  const retained = buildContextPack({ root, modeOverride: 'full', task: 'Retained source validation guidance' });
  const inspection = evidence.inspectRun({ root, ref: retained.evidence_ref });
  for (const file of [feedbackFile, originalEvidence]) {
    const artifact = inspection.artifacts.find(item => item.provenance.source_path === file);
    assert.ok(artifact, `${file} must be captured`);
    assert.deepEqual(Buffer.from(evidence.retrieveArtifact({ root, ref: retained.evidence_ref, artifactId: artifact.id, rawRequired: true }).content_base64, 'base64'), fs.readFileSync(file));
    assert.equal(artifact.coverage, 'full');
    assert.equal(artifact.provenance.toolCallId, null);
  }
  assert.equal(fs.readFileSync(path.join(retained.run_dir, 'advisory-project/task-memory-feedback.jsonl'), 'utf8'), feedback);
  const index = JSON.parse(fs.readFileSync(path.join(retained.run_dir, 'memory-index.json')));
  assert.equal(index.records.find(item => item.learning_id === projectLearningId(entry)).feedback_withheld, true);
});
check('vault note full bytes and frozen metadata survive private memory indexing', () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'review-evidence-vault-'));
  connect({ root, vault, projectId: 'retained-proof' });
  const published = publishNote({ root, note: { title: 'Retained vault guidance', body: 'Inspect source proof before a decision.', dependencies: ['source-0.txt'] } });
  assert.equal(published.status, 'published');
  const retained = buildContextPack({ root, modeOverride: 'full', task: 'Retained vault guidance' });
  const inspection = evidence.inspectRun({ root, ref: retained.evidence_ref });
  const note = inspection.artifacts.find(item => item.provenance.source_path === published.file);
  assert.ok(note, 'consumed original vault note bytes must be captured');
  assert.equal(note.sha256, sha(fs.readFileSync(published.file)));
  const frozen = JSON.parse(evidence.retrieveArtifact({ root, ref: retained.evidence_ref, artifactId: 'vault-memory-state', rawRequired: true }).content);
  assert.ok(frozen.records.some(item => item.kind === 'vault-memory'));
  const index = JSON.parse(fs.readFileSync(path.join(retained.run_dir, 'memory-index.json')));
  const indexed = index.records.find(item => item.kind === 'vault-memory');
  assert.ok(indexed, 'private index must preserve vault record');
  assert.equal(indexed.vault_freshness, 'sources-match');
  assert.equal(indexed.text, frozen.records.find(item => item.kind === 'vault-memory').text);
});
console.log(`${passed} independent evidence acceptance checks passed`);
