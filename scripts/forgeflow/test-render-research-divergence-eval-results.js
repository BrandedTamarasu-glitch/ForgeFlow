#!/usr/bin/env node

const assert = require('assert');
const path = require('path');
const { buildResults, parseArgs, renderMarkdown, validateEvidence } = require('./render-research-divergence-eval-results');

const root = path.resolve(__dirname, '..', '..');
const evidence = path.join(root, 'fixtures', 'research-divergence-eval', 'sample-evidence.json');
const result = buildResults({ root, evidence });

assert.strictEqual(result.status, 'valid');
assert.strictEqual(result.evidence.grade, 'illustrative');
assert.strictEqual(result.evidence.claims_allowed, false);
assert.strictEqual(result.arms.length, 2);
assert.strictEqual(result.routing.control_abstention_rate, 1);
assert.strictEqual(result.routing.open_ended_non_abstention_rate, 1);
assert.strictEqual(result.routing.route_accuracy, 1);
assert.strictEqual(result.comparison.complete_pairs, 8);
assert.strictEqual(result.comparison.quality.breadth.wins, 4);
assert.strictEqual(result.comparison.quality.breadth.ties, 4);
assert.strictEqual(result.comparison.quality.breadth.losses, 0);
assert.ok(result.comparison.operations.avg_latency_ms_delta > 0);
assert.match(result.claim, /No comparative performance claim/);
assert.match(renderMarkdown(result), /Complete pairs: 8/);
assert.match(renderMarkdown(result), /Generation: model-backed \(fixture-provider\/fixture-model\)/);
assert.match(renderMarkdown(result), /Judge: model \(fixture-provider\/fixture-judge; independent rubric scoring\)/);
assert.match(renderMarkdown(result), /Grade reason: Fixture evidence is for contract testing only\./);
assert.match(renderMarkdown(result), /\| breadth \| 0\.625 \| 4 \| 4 \| 0 \|/);
assert.match(renderMarkdown(result), /Open-ended non-abstention rate: 1/);
assert.deepStrictEqual(parseArgs(['--root', root, '--evidence', evidence, '--json']), { root, evidence, json: true, help: false });
assert.throws(() => parseArgs([]), /Missing required argument/);
assert.throws(() => parseArgs(['--evidence', evidence, '--evidence', evidence]), /Duplicate argument/);
assert.throws(() => parseArgs(['--evidence', evidence, '--json', '--json']), /Duplicate argument/);

const valid = require(evidence);
const badMetric = JSON.parse(JSON.stringify(valid));
badMetric.runs[0].metrics.breadth = 6;
assert.throws(() => validateEvidence(badMetric), /breadth must be an integer from 0 to 5/);
const extraKey = JSON.parse(JSON.stringify(valid));
extraKey.unexpected = true;
assert.throws(() => validateEvidence(extraKey), /keys must be exactly/);
const duplicate = JSON.parse(JSON.stringify(valid));
duplicate.runs.push(JSON.parse(JSON.stringify(duplicate.runs[0])));
assert.throws(() => validateEvidence(duplicate), /duplicate run/);
const unpaired = JSON.parse(JSON.stringify(valid));
unpaired.runs.pop();
assert.throws(() => validateEvidence(unpaired), /missing paired run/);
const missingJudge = JSON.parse(JSON.stringify(valid));
missingJudge.source.judge.method = '';
assert.throws(() => validateEvidence(missingJudge), /judge provenance/);
const mislabeledJudge = JSON.parse(JSON.stringify(valid));
mislabeledJudge.source.judge.kind = 'human-rated-model';
assert.throws(() => validateEvidence(mislabeledJudge), /must be model or human/);
const thin = JSON.parse(JSON.stringify(valid));
thin.source.fixture = false;
assert.strictEqual(require('./render-research-divergence-eval-results').evidenceGrade(thin).grade, 'thin');

console.log('research divergence eval results: ok');
