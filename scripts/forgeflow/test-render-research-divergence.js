#!/usr/bin/env node

const assert = require('assert');
const {
  CRITIC_FIELDS,
  FRAME_DEFINITIONS,
  buildResearchDivergence,
  parseArgs,
  renderMarkdown,
} = require('./render-research-divergence');

const task = 'Choose a safe migration strategy.';
const result = buildResearchDivergence({ task, constraints: ['No downtime'] });
const repeat = buildResearchDivergence({ task, constraints: ['No downtime'] });

assert.deepStrictEqual(result, repeat, 'output must be deterministic');
assert.deepStrictEqual(result.frame_ids, ['inversion', 'remove-assumption', '3am-on-call']);
assert.deepStrictEqual(FRAME_DEFINITIONS.map((frame) => frame.id), result.frame_ids);
assert.strictEqual(result.branches.length, 3);
assert.ok(result.branches.every((branch) => branch.task === task));
assert.ok(result.branches.every((branch) => branch.immutable_constraints[0] === 'No downtime'));
assert.ok(result.branches.every((branch) => branch.isolation_contract.some((line) => line.includes('Do not communicate'))));
assert.ok(result.branches.every((branch) => branch.isolation_contract.some((line) => line.includes('without ranking'))));
assert.deepStrictEqual(result.critic.required_fields, CRITIC_FIELDS);
assert.ok(result.critic.input_contract.includes('Atlas evidence'));
assert.ok(result.critic.input_contract.includes('may flow back into a branch'));
assert.ok(CRITIC_FIELDS.every((field) => result.critic.candidate_contract[field]));
assert.deepStrictEqual(result.critic.overall_required, [
  'non_obvious_viable_candidate',
  'load_bearing_risk',
  'first_falsification_experiment',
  'final_recommendation',
]);
assert.deepStrictEqual(Object.keys(result.branches[0].requested_output), [
  'approach',
  'why_it_could_work',
  'key_assumptions',
  'failure_signals',
  'first_experiment',
]);
assert.strictEqual(result.execution.estimated_call_count, 4);
assert.strictEqual(result.execution.executes_calls, false);
assert.ok(result.boundaries.some((line) => line.includes('does not call an LLM or spawn agents')));
assert.ok(result.boundaries.some((line) => line.includes('does not read project memory')));
assert.ok(renderMarkdown(result).includes('## Critic Contract'));
assert.deepStrictEqual(parseArgs(['--task', task, '--constraint', 'No downtime', '--json']), {
  task,
  constraints: ['No downtime'],
  json: true,
});

for (const argv of [
  [],
  ['--task'],
  ['--task', ''],
  ['--task', task, '--task', 'duplicate'],
  ['--task', task, '--json', '--json'],
  ['--task', task, '--constraint'],
  ['--task', task, '--unknown'],
]) {
  assert.throws(() => parseArgs(argv));
}
assert.throws(() => buildResearchDivergence({ task, constraints: [''] }));

console.log('research divergence renderer: ok');
