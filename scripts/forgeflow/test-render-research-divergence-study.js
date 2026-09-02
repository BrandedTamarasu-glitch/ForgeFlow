#!/usr/bin/env node

const assert = require('assert');
const { buildStudy, parseArgs, renderMarkdown } = require('./render-research-divergence-study');

const full = buildStudy();
const again = buildStudy();
const pilot = buildStudy({ pilot: true });

assert.deepStrictEqual(full, again, 'study definition must be deterministic');
assert.deepStrictEqual(full.experiments.map((experiment) => experiment.id), [
  'A-explicit-arm-comparison',
  'B-route-classification-controls',
]);

const explicit = full.experiments[0];
const classification = full.experiments[1];
assert.strictEqual(explicit.tasks.length, 8);
assert.strictEqual(classification.tasks.length, 16);
assert.ok(explicit.tasks.every((task) => task.expected_route === 'diverge'));
assert.deepStrictEqual(explicit.arms.map((arm) => arm.id), ['baseline', 'diverge']);
assert.ok(explicit.limitation.includes('cannot test abstention'));
assert.deepStrictEqual(classification.arms.map((arm) => arm.id), ['classify']);
assert.ok(classification.tasks.some((task) => task.expected_route === 'abstain'));
assert.ok(classification.tasks.some((task) => task.expected_route === 'diverge'));
assert.ok(classification.instruction.includes('without receiving an explicit --diverge'));
assert.strictEqual(pilot.experiments[0].tasks.length, 4);
assert.strictEqual(pilot.experiments[1].tasks.length, 8);
assert.ok(classification.instruction.includes('prospective classifier evidence'));
assert.ok(full.boundaries.some((boundary) => boundary.includes('does not auto-route')));
assert.strictEqual(full.execution.executes_models, false);
assert.strictEqual(full.execution.writes_files, false);
assert.ok(full.boundaries.some((boundary) => boundary.includes('.forgeflow/memory')));
assert.ok(renderMarkdown(full).includes('cannot test abstention'));
assert.deepStrictEqual(parseArgs(['--pilot', '--json']), { json: true, pilot: true, help: false });
assert.throws(() => parseArgs(['--pilot', '--pilot']), /Duplicate argument/);
assert.throws(() => parseArgs(['--unknown']), /Unknown argument/);

console.log('research divergence study render: ok');
