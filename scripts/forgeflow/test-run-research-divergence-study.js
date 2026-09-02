#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  RUN_GATE,
  buildRuns,
  deterministicShuffle,
  executeStudy,
  parseArgs,
  preview,
  validateLiveOptions,
} = require('./run-research-divergence-study');
const { buildStudy } = require('./render-research-divergence-study');

const pilot = buildStudy({ pilot: true });
const first = buildRuns(pilot, 2, 'fixed-seed');
const second = buildRuns(pilot, 2, 'fixed-seed');
assert.deepStrictEqual(first, second, 'seeded run ordering must be deterministic');
assert.strictEqual(first.length, 32);
assert.deepStrictEqual(
  first.filter((run) => run.experiment_id.startsWith('A-')).map((run) => run.arm.id).sort(),
  ['baseline', 'baseline', 'baseline', 'baseline', 'baseline', 'baseline', 'baseline', 'baseline', 'diverge', 'diverge', 'diverge', 'diverge', 'diverge', 'diverge', 'diverge', 'diverge'],
);
assert.deepStrictEqual(deterministicShuffle(['a', 'b', 'c', 'd'], 'x'), deterministicShuffle(['a', 'b', 'c', 'd'], 'x'));
assert.strictEqual(preview({ pilot: true, seed: 'x' }).planned_runs, 16);
assert.strictEqual(preview({ pilot: true, seed: 'x' }).writes_files, false);
assert.throws(() => parseArgs(['--run', '--run']), /Duplicate argument/);
assert.throws(() => parseArgs(['--seed', 'forgeflow-study-v1', '--seed', 'other']), /Duplicate argument/);
assert.throws(() => parseArgs(['--iterations']), /Missing value/);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-divergence-study-test-'));
const repo = path.join(root, 'repo');
const runner = path.join(root, 'fake-runner.js');
fs.mkdirSync(path.join(repo, '.forgeflow', 'memory'), { recursive: true });
fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
fs.writeFileSync(path.join(repo, 'src', 'marker.txt'), 'fresh checkout\n');
fs.writeFileSync(path.join(repo, '.forgeflow', 'memory', 'private.txt'), 'must not copy\n');
fs.writeFileSync(path.join(repo, 'plan.md'), 'must not copy\n');
fs.writeFileSync(path.join(repo, 'progress.md'), 'must not copy\n');
fs.writeFileSync(path.join(repo, 'handoff.md'), 'must not copy\n');
fs.mkdirSync(path.join(repo, '.claude'), { recursive: true });
fs.writeFileSync(path.join(repo, '.claude', 'handoff.md'), 'must not copy\n');
fs.writeFileSync(runner, '#!/usr/bin/env node\nconst fs=require("fs"); const request=JSON.parse(fs.readFileSync(process.argv[2],"utf8")); process.stdout.write(request.run_id); process.stderr.write("fixture stderr");\n');
fs.chmodSync(runner, 0o755);

const baseOptions = {
  run: true,
  pilot: true,
  json: true,
  seed: 'test-seed',
  runner,
  repo,
  iterations: '1',
  maxRuns: '16',
  studyDir: path.join(root, 'study'),
};

assert.throws(() => validateLiveOptions(baseOptions, {}), new RegExp(RUN_GATE));
assert.throws(
  () => validateLiveOptions({ ...baseOptions, studyDir: path.join(repo, 'study') }, { [RUN_GATE]: '1' }),
  /outside the repository/,
);
assert.throws(
  () => executeStudy({ ...baseOptions, maxRuns: '15' }, { [RUN_GATE]: '1' }),
  /exceeds --max-runs/,
);

const invocations = [];
const fakeSpawn = (command, args, settings) => {
  const request = JSON.parse(fs.readFileSync(args[0], 'utf8'));
  invocations.push({ command, args, settings, request });
  return { status: 0, signal: null, stdout: request.run_id, stderr: 'study_usage={"model":"fixture","outer_codex_exec_count":1,"nested_model_call_count":null,"total_tokens":10,"cost_usd":null,"cost_method":"fixture"}\nfixture stderr' };
};
const summary = executeStudy(baseOptions, { [RUN_GATE]: '1' }, fakeSpawn);
assert.strictEqual(summary.run_count, 16);
assert.strictEqual(invocations.length, 16);
assert.ok(invocations.every((invocation) => invocation.command === runner));
assert.ok(invocations.every((invocation) => invocation.settings.cwd === invocation.request.checkout));
assert.ok(invocations.every((invocation) => invocation.settings.env.FORGEFLOW_STUDY_OUTPUT_DIR === invocation.request.output_dir));
assert.ok(summary.records.every((record) => record.exit_code === 0));
assert.ok(summary.records.every((record) => /^[a-f0-9]{64}$/.test(record.runner_sha256)));
assert.ok(summary.records.every((record) => /^[a-f0-9]{64}$/.test(record.checkout_sha256)));
assert.ok(summary.records.every((record) => /^[a-f0-9]{64}$/.test(record.stdout_sha256)));
assert.ok(summary.records.every((record) => /^[a-f0-9]{64}$/.test(record.stderr_sha256)));
assert.ok(summary.records.every((record) => record.latency_ms >= 0));
assert.ok(summary.records.every((record) => record.usage?.outer_codex_exec_count === 1 && record.usage.nested_model_call_count === null && record.usage.total_tokens === 10));
assert.strictEqual(fs.statSync(baseOptions.studyDir).mode & 0o777, 0o700);
assert.strictEqual(new Set(summary.records.map((record) => record.checkout)).size, 16, 'every run needs a fresh checkout');
for (const record of summary.records) {
  assert.strictEqual(fs.readFileSync(record.stdout, 'utf8'), record.run_id);
  assert.match(fs.readFileSync(record.stderr, 'utf8'), /fixture stderr/);
  assert.ok(fs.existsSync(path.join(record.checkout, 'src', 'marker.txt')));
  assert.ok(!fs.existsSync(path.join(record.checkout, '.forgeflow', 'memory', 'private.txt')));
  assert.ok(!fs.existsSync(path.join(record.checkout, 'plan.md')));
  assert.ok(!fs.existsSync(path.join(record.checkout, 'progress.md')));
  assert.ok(!fs.existsSync(path.join(record.checkout, 'handoff.md')));
  assert.ok(!fs.existsSync(path.join(record.checkout, '.claude', 'handoff.md')));
  assert.ok(record.stdout.startsWith(path.join(baseOptions.studyDir, 'outputs')));
}
assert.ok(fs.existsSync(path.join(baseOptions.studyDir, 'study-results.json')));
assert.throws(() => executeStudy(baseOptions, { [RUN_GATE]: '1' }, fakeSpawn), /already exists/);

console.log('research divergence study runner: ok');
