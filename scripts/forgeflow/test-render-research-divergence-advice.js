#!/usr/bin/env node

const assert = require('assert');
const { buildAdvice, parseArgs, renderMarkdown } = require('./render-research-divergence-advice');

const divergent = buildAdvice({ task: 'Choose between several consequential architecture boundaries under uncertain growth.' });
assert.strictEqual(divergent.recommendation, 'diverge');
assert.strictEqual(divergent.suggested_invocation, '$research --diverge');
assert.ok(renderMarkdown(divergent).includes('1.47x'));
assert.ok(renderMarkdown(divergent).includes('advisory-only'));

const canonical = buildAdvice({ task: 'Select the canonical HTTP status code for a known standard response.' });
assert.strictEqual(canonical.recommendation, 'default');
assert.strictEqual(canonical.signals.canonical_or_mechanical, true);
assert.strictEqual(buildAdvice({ task: 'Pick a color.' }).recommendation, 'default');
assert.deepStrictEqual(parseArgs(['--task', 'Investigate intermittent timeout options', '--json']), { task: 'Investigate intermittent timeout options', json: true });
assert.throws(() => parseArgs(['--task']), /Missing value/);
assert.throws(() => parseArgs(['--task', 'x', '--task', 'y']), /Duplicate/);
assert.throws(() => parseArgs(['--unknown']), /Unknown/);

console.log('research divergence advice: ok');
