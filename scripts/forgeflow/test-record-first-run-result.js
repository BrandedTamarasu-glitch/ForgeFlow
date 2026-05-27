#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { normalizeResult, recordFirstRunResult } = require('./record-first-run-result');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-first-run-result-'));
const result = recordFirstRunResult({
  projectDir: tmp,
  runtime: 'codex',
  health: 'pass',
  smoke: 'warn',
  profile: 'pass',
  decision: 'continue',
  friction: 'docs',
  nextAction: 'Try one bounded implementation slice.',
  notes: 'Needed profile setup clarification.',
});
const defaultFriction = normalizeResult({
  projectDir: tmp,
  runtime: 'codex',
  health: 'pass',
  smoke: 'pass',
  profile: 'pass',
  decision: 'continue',
});
const secondResult = recordFirstRunResult({
  projectDir: tmp,
  runtime: 'codex',
  health: 'pass',
  smoke: 'warn',
  profile: 'pass',
  decision: 'continue',
  friction: 'docs',
  nextAction: 'Try one bounded implementation slice.',
  notes: 'Needed profile setup clarification.',
});
let invalid = false;
try {
  normalizeResult({ projectDir: tmp, runtime: 'codex', health: 'ok', smoke: 'pass', decision: 'continue' });
} catch (err) {
  invalid = err.message.includes('Invalid --health');
}
let sensitiveRejected = false;
try {
  recordFirstRunResult({
    projectDir: tmp,
    runtime: 'codex',
    health: 'pass',
    smoke: 'pass',
    profile: 'pass',
    decision: 'continue',
    notes: 'api_key=abc',
  });
} catch (err) {
  sensitiveRejected = err.message.includes('sensitive content');
}
let snippetRejected = false;
try {
  normalizeResult({ projectDir: tmp, runtime: 'codex', health: 'pass', smoke: 'pass', profile: 'pass', decision: 'continue', nextAction: 'const result = getValue();' });
} catch (err) {
  snippetRejected = err.message.includes('source snippet');
}
let customerRejected = false;
try {
  normalizeResult({ projectDir: tmp, runtime: 'codex', health: 'pass', smoke: 'pass', profile: 'pass', decision: 'continue', notes: 'ACME setup issue.' });
} catch (err) {
  customerRejected = err.message.includes('customer');
}
let sourcePathRejected = false;
try {
  normalizeResult({ projectDir: tmp, runtime: 'codex', health: 'pass', smoke: 'pass', profile: 'pass', decision: 'continue', notes: './src/auth.ts during setup.' });
} catch (err) {
  sourcePathRejected = err.message.includes('source snippet');
}
let windowsPathRejected = false;
try {
  normalizeResult({ projectDir: tmp, runtime: 'codex', health: 'pass', smoke: 'pass', profile: 'pass', decision: 'continue', notes: '..\\src\\auth.ts during setup.' });
} catch (err) {
  windowsPathRejected = err.message.includes('path or source snippet');
}
const checks = [
  ['writes json', fs.existsSync(result.json)],
  ['writes markdown', fs.existsSync(result.markdown) && fs.readFileSync(result.markdown, 'utf8').includes('First-Run Result')],
  ['does not overwrite same-second recordings', result.json !== secondResult.json && fs.existsSync(secondResult.json) && fs.existsSync(secondResult.markdown)],
  ['default friction remains none', defaultFriction.friction === 'none'],
  ['normalizes fields', result.record.runtime === 'codex' && result.record.friction === 'docs' && result.record.profile === 'pass' && result.record.next_action.includes('bounded')],
  ['rejects invalid health', invalid],
  ['rejects sensitive notes', sensitiveRejected],
  ['rejects source snippets', snippetRejected],
  ['rejects customer names', customerRejected],
  ['rejects source paths', sourcePathRejected],
  ['rejects windows source paths', windowsPathRejected],
];
let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('first run result: ok');
