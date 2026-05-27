#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { normalizeOutcome, readNextWorkOutcomes, recordNextWorkOutcome } = require('./record-next-work-outcome');

const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-next-work-outcome-'));
const first = recordNextWorkOutcome({
  projectDir,
  title: 'Review profile guidance before implementation',
  source: 'user-profile',
  outcome: 'useful',
  summary: 'Helped scope agent prompts.',
  confidence: 'high',
});
recordNextWorkOutcome({
  projectDir,
  title: 'Triage stale signal',
  source: 'review-outcomes',
  outcome: 'incorrect',
  confidence: 'medium',
});
const rollup = readNextWorkOutcomes(projectDir);
let invalid = false;
try {
  normalizeOutcome({ projectDir, title: 'Bad path src/app.ts', source: 'test', outcome: 'useful' });
} catch (err) {
  invalid = err.message.includes('private or source-specific');
}

const checks = [
  ['writes file', fs.existsSync(first.file)],
  ['rolls up outcomes', rollup.records === 2 && rollup.by_outcome.useful === 1 && rollup.by_outcome.incorrect === 1],
  ['recommends calibration', rollup.recommendation === 'calibrate-next-work-selection'],
  ['rejects source-specific text', invalid],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('next work outcome: ok');
