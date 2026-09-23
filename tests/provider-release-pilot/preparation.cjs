const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const fixture = path.resolve(__dirname, '../../fixtures/provider-release-pilot');
const { prepare, verifyHashes } = require(path.join(fixture, 'prepare'));
const { score } = require(path.join(fixture, 'score'));
const protocol = require(path.join(fixture, 'protocol.json'));
const initialFailures = {
  provider: ['cross-provider-out-of-order', 'superseded-error', 'failed-refresh-retention-and-redaction', 'malformed-version-timestamp-and-extra-fields', 'latest-failure-suppresses-old-success'],
  web: ['stale-despite-version-header', 'html-script-fallback', 'missing-resource', 'redirect-no-target-contact', 'bodyless-cache', 'known-failure-before-unavailable', 'unknown-before-known-failure', 'unknown-identity-broken-interaction', 'unobserved-interaction'],
  native: ['stale-installed', 'installed-invalid-output', 'matching-invalid-output', 'nonzero-exit', 'wrong-executing-path', 'timeout-restores-profile', 'missing-installed'],
};
function evaluate(family, module) {
  const result = spawnSync(process.execPath, [path.join(fixture, 'acceptance.js'), family, module], { encoding: 'utf8', timeout: 30000 });
  assert.ifError(result.error);
  assert.ok([0, 1].includes(result.status), result.stderr);
  const checks = JSON.parse(result.stdout);
  assert.equal(checks.length, { provider: 7, web: 12, native: 10 }[family]);
  return checks;
}
verifyHashes();
for (const family of protocol.families) assert.ok(protocol.hashes[`${family.id}/base/README.md`], 'Task contract must be hashed');
if (protocol.status !== 'frozen-after-independent-control-review') assert.throws(() => prepare(), /review and protocol freeze/);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'provider-release-preparation-check-'));
let prepared;
try {
  for (const family of protocol.families) {
    const control = path.join(fixture, family.id, 'control.js');
    const original = evaluate(family.id, path.join(fixture, family.id, 'base', family.module));
    assert.deepEqual(original.filter(check => !check.pass).map(check => check.id), initialFailures[family.id]);
    const clean = evaluate(family.id, control);
    assert.deepEqual(clean.filter(check => !check.pass), []);
    console.log(`${family.id}: ${clean.length} candidate-control checks pass; ${initialFailures[family.id].length} seeded failures detected`);
  }
  const mutations = [
    ['provider', 'late-completion', 'if (id === sequences.get(key))', 'if (true)', 'superseded-success'],
    ['web', 'follow-redirect', "redirect: 'manual'", "redirect: 'follow'", 'redirect-no-target-contact'],
    ['native', 'execute-build', '[installed, profile]', '[built, profile]', 'clean-existing'],
    ['native', 'omit-restoration', 'if (original !== null) fs.writeFileSync(state, original);', 'if (original !== null) {}', 'clean-existing'],
  ];
  for (const [family, name, before, after, expectedFailure] of mutations) {
    const source = fs.readFileSync(path.join(fixture, family, 'control.js'), 'utf8');
    assert.ok(source.includes(before));
    const mutant = path.join(temporary, `${name}.js`);
    fs.writeFileSync(mutant, source.replaceAll(before, after));
    assert.equal(evaluate(family, mutant).find(check => check.id === expectedFailure).pass, false, name);
    console.log(`Oracle sensitivity: ${name} detected`);
  }
  prepared = prepare({ candidateOnly: true });
  assert.equal(prepared.queue.length, 36);
  for (const family of protocol.families) for (const variant of ['defective', 'control']) for (const arm of protocol.arms) {
    assert.equal(prepared.queue.filter(slot => slot.family === family.id && slot.variant === variant && slot.arm === arm).length, 2);
  }
  for (const arm of protocol.arms) for (const position of [0, 1, 2]) {
    assert.equal(prepared.queue.filter(slot => slot.arm === arm && slot.position === position).length, 4);
  }
  for (const slot of prepared.queue) {
    assert.deepEqual(fs.readdirSync(slot.workspace).sort(), ['README.md', 'src']);
    assert.deepEqual(fs.readdirSync(path.join(slot.workspace, 'src')), [path.basename(slot.module)]);
    const prompt = fs.readFileSync(path.join(prepared.root, `prompt-${slot.index}.txt`), 'utf8');
    assert.equal(Buffer.byteLength(prompt), slot.prompt_bytes);
    assert.ok(prompt.includes(slot.workspace) && prompt.includes(slot.module));
  }
  const unobserved = score(prepared.queue, []);
  assert.equal(unobserved.status, 'unobserved');
  assert.equal(unobserved.missing, 36);
  assert.deepEqual(unobserved.improvement_trigger, []);
  const synthetic = prepared.queue.map(slot => ({ index: slot.index, status: 'completed',
    fixed_files_unchanged: true, source_changed: false, checks: protocol.checks[slot.family].map(id => ({ id, pass: true })) }));
  const equal = score(prepared.queue, synthetic, { evidence: 'fixture' });
  assert.equal(equal.observed, 36);
  assert.ok(equal.rows.every(row => row.complete === 2));
  assert.deepEqual(equal.improvement_trigger, []);
  const apparentGain = synthetic.map(record => {
    const slot = prepared.queue[record.index];
    return slot.arm === 'baseline' && slot.variant === 'defective'
      ? { ...record, checks: record.checks.map(check => ({ ...check, pass: !protocol.initial_failures[slot.family].includes(check.id) })) }
      : record;
  });
  assert.deepEqual(score(prepared.queue, apparentGain, { evidence: 'fixture', controlValidity: 'independently-reviewed' }).improvement_trigger, []);
  if (protocol.status !== 'frozen-after-independent-control-review') {
    assert.deepEqual(score(prepared.queue, apparentGain, { evidence: 'actual', controlValidity: 'independently-reviewed' }).improvement_trigger, [], 'Pending freeze cannot claim benefit');
  }
  assert.throws(() => score(prepared.queue, [synthetic[0], synthetic[0]]), /duplicate/);
  assert.throws(() => score(prepared.queue, [{ ...synthetic[0], checks: [] }]), /oracle output/);
  const failed = score(prepared.queue, [{ index: 0, status: 'failed' }], { evidence: 'fixture' });
  assert.equal(failed.observed, 1); assert.equal(failed.missing, 35);
  assert.equal(failed.rows.reduce((sum, row) => sum + row.failed_attempts, 0), 1);
  assert.equal(failed.rows.reduce((sum, row) => sum + row.complete, 0), 0);
  console.log('36 candidate slots: isolated copies and corpus-wide order balance pass; model execution remains unobserved');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
  if (prepared) fs.rmSync(prepared.root, { recursive: true, force: true });
}
