#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { summarize, validateOutcome } = require('./record-review-outcome');

const repoRoot = path.resolve(__dirname, '..', '..');
const fixture = path.join(repoRoot, 'fixtures/evaluation/sample-outcome.json');
const record = JSON.parse(fs.readFileSync(fixture, 'utf8'));
const errors = validateOutcome(record);

if (errors.length > 0) {
  console.error(`fixture invalid: ${errors.join('; ')}`);
  process.exit(1);
}

const summary = summarize([record]);
const invalidWorkflow = JSON.parse(JSON.stringify(record));
invalidWorkflow.review.workflow = 'many-agents';
const checks = [
  ['records', summary.records === 1],
  ['mode', summary.modes['full-mode'] === 1],
  ['confirmed', summary.totals.findings_confirmed === 2],
  ['rejected', summary.totals.findings_rejected === 1],
  ['verifier confirmed', summary.totals.verifier_confirmed === 1],
  ['accessibility class', summary.classes.accessibility.findings_confirmed === 1],
  ['invalid workflow rejected', validateOutcome(invalidWorkflow).some((error) => error.includes('review.workflow'))],
];

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-outcome-'));
const outFile = path.join(tmpDir, 'outcomes.jsonl');
const script = path.join(repoRoot, 'scripts/forgeflow/record-review-outcome.js');
const result = spawnSync(script, ['--input', fixture, '--out', outFile, '--json'], {
  encoding: 'utf8',
});

checks.push(['cli exit', result.status === 0]);
checks.push(['cli wrote jsonl', fs.existsSync(outFile) && fs.readFileSync(outFile, 'utf8').trim().length > 0]);

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length > 0) {
  console.error(`review outcome test failed: ${failed.join(', ')}`);
  process.exit(1);
}

console.log('review outcome: ok');
