#!/usr/bin/env node
const assert = require('node:assert/strict');
const { preparePilot, scoreResponse } = require('../../fixtures/capability-pilot/pilot');
const { summarizeSkillTrials } = require('./task-evaluation');
const packs = preparePilot();
assert.equal(packs.length, 2);
assert.deepEqual(packs.map(pack => pack.plan.plan_id), ['1b1d637053ba471c88273e1555ca013f4af3bedd190c9e933698f387e6dd1083', '5e714cea3d6c948130576f3be39fc27f53b0204d24304bc7e7af379e4f3c5b02']);
assert.equal(packs.reduce((sum, pack) => sum + pack.plan.trials.length, 0), 32);
for (const { manifest, plan, prompts } of packs) {
  assert.equal(summarizeSkillTrials({ manifest, trials: [] }).unobserved, 16);
  for (const task of manifest.tasks) {
    for (const arm of ['skill-disabled', 'skill-enabled']) {
      const trials = plan.trials.filter(trial => trial.task_id === task.id && trial.arm === arm);
      assert.deepEqual(trials.map(trial => trial.position).sort(), [0, 0, 1, 1]);
      for (const trial of trials) {
        assert.ok(prompts[trial.trial_id].endsWith(task.input));
        if (!trial.skill_enabled) assert.equal(prompts[trial.trial_id], task.input);
        assert.ok(!prompts[trial.trial_id].includes('answer-key.json'));
      }
    }
  }
}
const response = findings => JSON.stringify({ findings: findings.map(id => ({ id, reason: 'synthetic scorer test' })), limitations: [] });
assert.equal(scoreResponse('p02', response([]), true).verified_completion, true);
assert.equal(scoreResponse('p02', response([])).verified_completion, null, 'manual reasoning review is required');
assert.deepEqual(scoreResponse('p01', response(['assets/favicon.html', 'docs/guide.html']), true), { valid: true, verified_completion: false, missed_defects: 1, false_findings: 0 });
assert.equal(scoreResponse('v02', response(['#alpha']), true).false_findings, 1);
assert.equal(scoreResponse('v01', response(['#beta', '#beta']), true).false_findings, 1);
assert.equal(scoreResponse('v01', 'not JSON', true).missed_defects, null);
assert.equal(scoreResponse('v01', JSON.stringify({ findings: [null], limitations: [] }), true).valid, false);
assert.equal(scoreResponse('v01', JSON.stringify({ findings: [{ id: '#beta', reason: '' }], limitations: [] }), true).valid, false);
assert.throws(() => scoreResponse('unknown', response([])), /Unknown case/);
console.log('capability pilot: frozen corpus, balanced 32-trial schedule, prompt separation and scoring checks passed (synthetic responses only)');
