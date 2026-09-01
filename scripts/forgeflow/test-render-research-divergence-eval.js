#!/usr/bin/env node

const assert = require('assert');
const { buildResearchDivergenceEval, parseArgs, renderMarkdown } = require('./render-research-divergence-eval');

const first = buildResearchDivergenceEval();
const second = buildResearchDivergenceEval();

assert.deepStrictEqual(first, second, 'scaffold must be deterministic');
assert.strictEqual(first.tasks.length, 8);
assert.strictEqual(new Set(first.tasks.map((task) => task.task_class)).size, 8);
assert.deepStrictEqual(first.arms.map((arm) => arm.id), ['baseline', 'diverge']);
assert.ok(first.tasks.some((task) => task.task_class === 'architecture'));
assert.ok(first.tasks.some((task) => task.task_class === 'reliability'));
assert.ok(first.tasks.some((task) => task.task_class === 'security'));
assert.ok(first.tasks.some((task) => task.task_class === 'accessibility-product'));
assert.strictEqual(first.tasks.filter((task) => task.control).length, 4);
assert.ok(first.tasks.filter((task) => task.control).every((task) => task.arms.diverge.expected_route === 'abstain'));
assert.ok(first.tasks.every((task) => task.expected_route && task.abstention_reason));
assert.deepStrictEqual(first.metrics.scored_0_to_5, ['breadth', 'novelty', 'trap_detection', 'actionability', 'builder_usefulness']);
assert.strictEqual(first.execution.executes_models, false);
assert.strictEqual(first.execution.writes_files, false);
assert.strictEqual(first.execution.calls_network, false);
assert.ok(renderMarkdown(first).includes('abstention control'));
assert.strictEqual(parseArgs(['--json']).json, true);
assert.throws(() => parseArgs(['--unknown']), /Unknown argument/);

console.log('research divergence eval: ok');
