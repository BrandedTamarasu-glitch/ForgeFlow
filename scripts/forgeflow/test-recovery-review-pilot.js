#!/usr/bin/env node
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { preparePilot } = require('../../fixtures/recovery-review-pilot/pilot');
const { cases } = require('../../fixtures/recovery-review-pilot/inputs.json');
const key = require('../../fixtures/recovery-review-pilot/answer-key.json');
const { summarizeSkillTrials } = require('./task-evaluation');
const packs = preparePilot();
assert.deepEqual(packs.map(pack => pack.plan.plan_id), ['f36e7a51b42b9803fd25b937e7c9d0ba90731cee265fe210035f2256bb8980b3', '8981e40144b8906dc2572da43f16527c00de5fe41a8cb7de3dd48f9053fe24d6']);
assert.equal(packs.reduce((sum, pack) => sum + pack.plan.trials.length, 0), 32);
for (const { manifest, plan, prompts } of packs) {
  assert.equal(summarizeSkillTrials({ manifest, trials: [] }).unobserved, 16);
  for (const task of manifest.tasks) {
    for (const arm of ['skill-disabled', 'skill-enabled']) {
      assert.deepEqual(plan.trials.filter(trial => trial.task_id === task.id && trial.arm === arm).map(trial => trial.position).sort(), [0, 0, 1, 1]);
    }
  }
  for (const trial of plan.trials) {
    assert.ok(prompts[trial.trial_id].endsWith(trial.task.input));
    if (!trial.skill_enabled) assert.equal(prompts[trial.trial_id], trial.task.input);
    assert.ok(!prompts[trial.trial_id].includes('cleanup-current'));
    assert.ok(!prompts[trial.trial_id].includes('lost-increment'));
  }
}
for (const id of ['rr01', 'rr02']) {
  const context = vm.createContext({});
  vm.runInContext(cases.find(item => item.id === id).code, context);
  // Execute the published starting state and schedule, then reload cloned bytes.
  const result = vm.runInContext(`const store = {head:'g0', blobs:{g0:JSON.stringify({items:['old']}), g1:JSON.stringify({items:['old','accepted']})}}; collect(store, () => publish(store)); reload(JSON.parse(JSON.stringify(store)));`, context);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), key.cases[id].reload);
}
for (const id of ['rr03', 'rr04']) {
  const context = vm.createContext({});
  vm.runInContext(cases.find(item => item.id === id).code, context);
  const result = vm.runInContext(`const store = {current:{count:0,version:0}}; const a=prepare(store), b=prepare(store); a(); if(b()===false) prepare(store)(); store.current.count;`, context);
  assert.equal(result, id === 'rr03' ? 1 : 2);
  if (id === 'rr03') {
    assert.equal(vm.runInContext(`const state={cacheWarm:false,hintReady:false}; try { hints(state,()=>{throw new Error('fault')}); } catch {} hints(state); state.cacheWarm && state.hintReady;`, context), true);
  } else {
    assert.equal(vm.runInContext(`const state={current:{primary:0,index:0}}; try { publish(state,1,()=>{throw new Error('fault')}); } catch {} state.current.primary===state.current.index;`, context), true);
  }
}
const { scoreResponse } = require('../../fixtures/recovery-review-pilot/score');
const response = (findings, reload) => JSON.stringify({ findings, reload, limitations: ['Synthetic test response only.'] });
assert.equal(scoreResponse('rr02', response([], key.cases.rr02.reload), [], 'fixture').verified_completion, true);
assert.equal(scoreResponse('rr02', response([], key.cases.rr01.reload), [], 'fixture').verified_completion, false);
assert.equal(scoreResponse('rr01', response([], key.cases.rr01.reload), [], 'fixture').missed_defects, 1);
const found = response([{ target: 'collect', severity: 'high', reason: 'Deletes the newly published generation.' }], key.cases.rr01.reload);
assert.throws(() => scoreResponse('rr01', found, [], 'fixture'), /Every finding/);
assert.equal(scoreResponse('rr01', found, [{ disposition: 'matched', defect_id: 'cleanup-current', evidence: 'Synthetic adjudication checked against deletion schedule.' }], 'fixture').verified_completion, true);
assert.equal(scoreResponse('rr01', 'invalid', [], 'fixture').run_status, 'failed');
assert.equal(scoreResponse('rr01', response([null], null), [], 'fixture').valid, false);
console.log('recovery/review pilot: frozen balanced 32-trial plans, code/reload oracles and synthetic scoring checks passed; no model observations in this check');
