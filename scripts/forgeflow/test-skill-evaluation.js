#!/usr/bin/env node
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { planSkillTrials, summarizeSkillTrials, summarizeTrials, main } = require('./task-evaluation');

const root = path.resolve(__dirname, '../..');
const manifestPath = path.join(root, 'fixtures/atomicity/evaluation-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const key = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/atomicity/answer-key.json'), 'utf8'));
const operations = require('../../fixtures/atomicity/operations');
const hashFile = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
assert.equal(manifest.provenance.source_revision, hashFile(manifest.provenance.source));
assert.equal(manifest.baseline, `sha256:${manifest.provenance.source_revision}`);
assert.equal(manifest.provenance.answer_key_sha256, hashFile('fixtures/atomicity/answer-key.json'));
assert.equal(manifest.tasks.length, key.cases.length);
for (const task of manifest.tasks) {
  const answer = key.cases.find((entry) => entry.id === task.id);
  assert.ok(task.input.includes(answer.requirement));
  assert.ok(task.input.includes(operations[answer.operation].toString()));
  assert.ok(!task.input.includes(answer.mechanism));
  assert.deepEqual(Object.keys(task).sort(), ['id', 'input']);
}
const plan = planSkillTrials(manifest);
assert.equal(plan.plan_id, '2fa165fcec7b758d56f37b6a929ae168c7e8a475d561be5a8fdf1cc9bff6edce');
assert.deepEqual(main(['plan-skill', '--input', manifestPath]), plan);
assert.equal(plan.trials.length, 48);
for (const task of manifest.tasks) {
  for (const arm of ['skill-disabled', 'skill-enabled']) {
    const trials = plan.trials.filter((trial) => trial.task_id === task.id && trial.arm === arm);
    assert.deepEqual(trials.map((trial) => trial.position).sort(), [0, 0, 1, 1]);
    assert.ok(trials.every((trial) => trial.skill_enabled === (arm === 'skill-enabled')));
  }
}
const report = (trials, protocol = manifest) => summarizeSkillTrials({ manifest: protocol, trials });
assert.equal(report([]).unobserved, 48);
assert.equal(report([]).actual[0].metrics.tokens.mean, null);
const fixture = plan.trials.map((trial) => ({ ...trial, observation: 'fixture', run_status: 'completed', verified_completion: true, missed_defects: 0, false_findings: 0 }));
const summary = report(fixture);
assert.equal(summary.fixture[0].trials, 24);
assert.equal(summary.actual[0].trials, 0);
assert.equal(summary.matched_differences.fixture[0].metrics.verified_completion.observed_pairs, 24);
assert.equal(summary.fixture[0].metrics.cost_usd.mean, null);
assert.equal(summary.matched_actual_groups, 0);
assert.equal(report([fixture[0]]).unobserved, 47);
assert.equal(report([fixture[0]]).matched_differences.fixture[0].metrics.verified_completion.observed_pairs, 0);
const failed = report([{ ...fixture[0], run_status: 'failed', verified_completion: null, missed_defects: null, false_findings: null }]);
assert.equal(failed.failed.fixture, 1);
assert.equal(failed.scheduled, 48);
assert.equal(failed.unobserved, 47);
assert.equal(failed.fixture.find((arm) => arm.trials).metrics.verified_completion.mean, null);
assert.throws(() => report([fixture[0], fixture[0]]), /Duplicate/);
assert.throws(() => report([{ ...fixture[0], trial_id: 'unknown' }]), /frozen plan/);
for (const change of [{ baseline: 'changed' }, { model: 'changed' }, { skill_enabled: !fixture[0].skill_enabled }, { position: 99 }, { task: { id: 'changed' } }, { budget: 1 }]) {
  assert.throws(() => report([{ ...fixture[0], ...change }]), /metadata differs/);
}
assert.throws(() => report([{ ...fixture[0], observation: 'actual' }]), /model-ready/);
assert.throws(() => report([{ ...fixture[0], run_status: 'unobserved' }]), /agree/);
assert.throws(() => report([{ ...plan.trials[0], tokens: 1 }]), /Unobserved/);
assert.throws(() => report([{ ...fixture[0], missed_defects: 0.5 }]), /integer/);
assert.throws(() => report([{ ...fixture[0], latency_ms: -1 }]), /Invalid/);
assert.throws(() => summarizeTrials(fixture), /Invalid arm/);
assert.throws(() => planSkillTrials({ ...manifest, repetitions: 3 }), /multiple of 2/);
assert.throws(() => planSkillTrials({ ...manifest, tasks: [{ ...manifest.tasks[0], expected: 'violation' }] }), /answer keys separate/);
assert.throws(() => planSkillTrials({ ...manifest, provenance: { ...manifest.provenance, source_revision: 'unknown' } }), /SHA256/);
const changed = structuredClone(manifest);
changed.arms['skill-enabled'].model = 'test-model';
assert.throws(() => planSkillTrials(changed), /share model/);
changed.arms['skill-disabled'].model = 'test-model';
changed.skill.revision = 'test-revision';
changed.execution = 'model-ready';
const configured = planSkillTrials(changed);
assert.notEqual(configured.plan_id, plan.plan_id);
assert.throws(() => report(fixture, changed), /frozen plan/);
// Synthetic records test actual-result parsing; no models are invoked here.
const actual = configured.trials.map((trial) => ({ ...trial, observation: 'actual', run_status: 'completed', verified_completion: trial.skill_enabled, tokens: 10 }));
const actualReport = report(actual, changed);
assert.equal(actualReport.matched_actual_groups, 24);
assert.equal(actualReport.matched_differences.actual[0].metrics.verified_completion.mean_difference, 1);
const mixed = report([actual[0], { ...actual[1], observation: 'fixture' }], changed);
assert.equal(mixed.matched_actual_groups, 0);
assert.equal(mixed.matched_differences.fixture[0].metrics.verified_completion.observed_pairs, 0);
assert.equal(mixed.unobserved, 46);
configured.trials[0].task.input = 'mutated';
configured.trials[0].skill.revision = 'mutated';
assert.equal(changed.skill.revision, 'test-revision');
assert.notEqual(changed.tasks[0].input, 'mutated');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-skill-evaluation-'));
try {
  const file = path.join(directory, 'records.json');
  fs.writeFileSync(file, JSON.stringify({ manifest, trials: [fixture[0]] }));
  assert.equal(main(['summarize-skill', '--input', file]).unobserved, 47);
  const link = path.join(directory, 'linked.json');
  fs.symlinkSync(file, link);
  assert.throws(() => main(['summarize-skill', '--input', link]), /symlink/);
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
console.log('skill evaluation: frozen corpus, balanced schedules, metadata integrity, missing/failed runs and observation separation passed (synthetic records only)');
