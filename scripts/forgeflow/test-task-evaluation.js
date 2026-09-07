#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ARMS, planTrials, summarizeTrials, main } = require('./task-evaluation');

const manifest = { seed: 'repeatable', baseline: 'sha256:fixture-baseline', tasks: [{ id: 'bugfix' }, { id: 'refactor' }], arms: Object.fromEntries(ARMS.map((arm) => [arm, { model: arm === 'no-agent' ? null : 'fixture-model', settings: { temperature: 0 }, budget: null }])) };
const plan = planTrials(manifest);
assert.deepEqual(planTrials(manifest), plan);
assert.equal(plan.trials.length, 18);
assert.notEqual(planTrials({ ...manifest, seed: 'different' }).plan_id, plan.plan_id);
for (const task of manifest.tasks) {
  for (const arm of ARMS) {
    const positions = plan.trials.filter((trial) => trial.task_id === task.id && trial.arm === arm).map((trial) => trial.position).sort();
    assert.deepEqual(positions, [0, 1, 2]);
  }
}
assert.throws(() => planTrials({ ...manifest, repetitions: 2 }), /multiple of 3/);
assert.throws(() => planTrials({ ...manifest, baseline: '' }), /baseline/);
const unseen = summarizeTrials(plan);
assert.equal(unseen.unobserved, 18);
assert.equal(unseen.actual[0].metrics.cost_usd.mean, null);
const fixture = plan.trials.map((trial) => ({ ...trial, observation: 'fixture', verified_completion: true }));
const report = summarizeTrials(fixture);
assert.equal(report.actual[0].trials, 0);
assert.equal(report.fixture[0].metrics.verified_completion.mean, 1);
assert.equal(report.fixture[0].metrics.cost_usd.mean, null);
assert.equal(report.fixture[0].metrics.regressions.unknown, 6);
assert.equal(report.matched_actual_groups, 0);
assert.equal(report.matched_differences.fixture[0].metrics.cost_usd.mean_difference, null);
assert.equal(report.matched_differences.fixture[0].metrics.verified_completion.observed_pairs, 6);
assert.equal(report.matched_differences.actual[0].metrics.verified_completion.observed_pairs, 0);
assert.equal(summarizeTrials([fixture[0]]).matched_differences.fixture[0].metrics.verified_completion.observed_pairs, 0);
assert.equal(summarizeTrials(fixture.map((trial) => ({ ...trial, observation: 'actual' }))).matched_actual_groups, 6);
assert.throws(() => summarizeTrials([fixture[0], fixture[0]]), /Duplicate trial/);
assert.throws(() => summarizeTrials([{ ...plan.trials[0], cost_usd: 0 }]), /Unobserved/);
assert.throws(() => summarizeTrials([{ ...fixture[0], regressions: 0.5 }]), /integer/);
assert.throws(() => summarizeTrials([fixture[0], { ...fixture[1], baseline: 'another' }]), /baseline/);
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-task-evaluation-'));
try {
  const file = path.join(directory, 'manifest.json');
  fs.writeFileSync(file, JSON.stringify(manifest));
  assert.deepEqual(main(['plan', '--input', file]), plan);
  const link = path.join(directory, 'linked.json');
  fs.symlinkSync(file, link);
  assert.throws(() => main(['plan', '--input', link]), /symlink/);
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
console.log('task evaluation: deterministic balanced schedules, honest observations, and safe CLI reads passed');
