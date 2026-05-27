#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { recordFirstRunResult } = require('./record-first-run-result');
const { buildRollup, rollupFirstRunResults, renderMarkdown } = require('./rollup-first-run-results');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-first-run-rollup-'));
recordFirstRunResult({ projectDir: tmp, runtime: 'codex', health: 'pass', smoke: 'pass', profile: 'pass', decision: 'continue', friction: 'docs', notes: 'Needed docs clarification.' });
recordFirstRunResult({ projectDir: tmp, runtime: 'claude-code', health: 'warn', smoke: 'pass', profile: 'warn', decision: 'fix-first', friction: 'settings', nextAction: 'Run health check.' });
const result = rollupFirstRunResults({ projectDir: tmp });
const empty = buildRollup([]);
const markdown = renderMarkdown(result);

const checks = [
  ['counts records', result.records === 2 && result.runtime.codex === 1 && result.runtime['claude-code'] === 1],
  ['counts decisions', result.decision.continue === 1 && result.decision['fix-first'] === 1],
  ['recommends fix on friction', result.recommendation === 'fix-first-run-friction'],
  ['empty recommends recording', empty.recommendation === 'record-first-run-result'],
  ['writes markdown', fs.existsSync(result.out) && markdown.includes('First-Run Results Rollup') && markdown.includes('Share aggregate counts only')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('first run rollup: ok');
