// Local deterministic qualification only; launches no model or native prompts.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

assert.equal(process.argv.length, 3, 'Usage: node validate.mjs /path/to/source-repository');
assert.equal(process.platform, 'linux', 'This candidate qualification requires Linux FIFO and local-socket checks.');
const source = resolve(process.argv[2]);
const here = fileURLToPath(new URL('.', import.meta.url));
const revision = '2bbb198b7a5852cd64fc243a1392cda56f517640';
const directory = await mkdtemp(join(tmpdir(), 'ff-control-v2-'));
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024, ...options });
  assert.ifError(result.error);
  return result;
}
function oracle(file) {
  const result = run(process.execPath, [file, directory]);
  assert.ok(result.status === 0 || result.status === 1, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(result.status, output.pass ? 0 : 1);
  assert.ok(output.checks.length >= 21);
  return output;
}
function rejectMutation(name, result, expected) {
  const failures = result.checks.filter(check => !check.pass).map(check => check.id);
  assert.equal(result.pass, false, `${name} escaped`);
  for (const id of expected) assert.ok(failures.includes(id), `${name} missed ${id}: ${failures}`);
  return { name, rejected: true, failures };
}
try {
  // Archive the pinned commit, never the caller's working tree. No checkout edits.
  const archive = run('git', ['-C', source, 'archive', revision], { encoding: null });
  assert.equal(archive.status, 0, archive.stderr?.toString());
  const extract = run('tar', ['-x', '-C', directory], { input: archive.stdout });
  assert.equal(extract.status, 0, extract.stderr);
  const original = oracle(join(here, '../completion-pilot/acceptance.mjs'));
  assert.equal(original.checks.filter(check => check.pass).length, 19);
  const challenges = [rejectMutation('submitted-pr', oracle(join(here, 'acceptance.mjs')), ['native-id-matches-bound-header', 'id-busy-then-ready-recovers-once'])];
  const applied = run('git', ['apply', join(here, 'control.patch')], { cwd: directory });
  assert.equal(applied.status, 0, applied.stderr);
  const controller = join(directory, 'packages/controller/controller.mjs');
  const corrected = await readFile(controller, 'utf8');
  const historical = oracle(join(here, '../completion-pilot/acceptance.mjs'));
  assert.equal(historical.pass, true);
  const candidate = oracle(join(here, 'acceptance.mjs'));
  assert.equal(candidate.pass, true);
  assert.equal(candidate.checks.length, 33);
  const mutations = [
    ['malformed-id-equality', '  if (agent.agent !== "pi")', '  if (native.value === bound) return true;\n  if (agent.agent !== "pi")', ['mistagged-path-id-rejected', 'malformed-id-rejected']],
    ['legacy-compatibility-removed', 'if (uuid.test(bound)) return native.value === bound;', 'if (uuid.test(bound)) return false;', ['legacy-id-binding', 'uppercase-legacy-id-binding']],
    ['canonical-alias-removed', 'return await realpath(native.value) === await realpath(bound) &&', 'return native.value === bound &&', ['canonical-native-path-alias']],
    ['foreign-header-accepted', 'header.id === native.value', 'true', ['foreign-id-rejected', 'header-id-mismatch-rejected']],
    ['pre-send-claim-removed', 'receipt.delivery = "sending";', 'receipt.delivery = "pending";', ['native-id-matches-bound-header']],
  ];
  for (const [name, before, after, expected] of mutations) {
    assert.equal(corrected.split(before).length, 2, `${name} mutation anchor changed`);
    await writeFile(controller, corrected.replace(before, after));
    challenges.push(rejectMutation(name, oracle(join(here, 'acceptance.mjs')), expected));
  }
  await writeFile(controller, corrected);
  const tests = run(process.execPath, ['--test', '--test-isolation=none', '--test-reporter=tap', 'packages/controller/test/controller.test.mjs'], { cwd: directory });
  assert.equal(tests.status, 0, tests.stdout + tests.stderr);
  assert.match(tests.stdout, /# fail 0/);
  console.log(JSON.stringify({ status: 'candidate-validated-not-frozen', revision, historical_checks: historical.checks.length, candidate_checks: candidate.checks.length, challenges, controller_summary: tests.stdout.split('\n').filter(line => /^# (tests|pass|fail) /.test(line)), limitations: ['Synthetic metadata and local files; no live native or model qualification.', 'Full supported-workflow qualification and a new comparison freeze remain pending.'] }, null, 2));
} finally {
  await rm(directory, { recursive: true, force: true });
}
