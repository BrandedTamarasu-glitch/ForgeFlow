#!/usr/bin/env node
const path = require('path');
const {
  evaluateLeanBehavior,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-behavior-eval');

const good = evaluateLeanBehavior({
  root: '.',
  text: [
    'function readTemp(raw) { if (raw > 0) return raw + offset; }',
    'const offset = 0; // calibration offset, measure your own reference thermometer',
    'assert(readTemp(1) === 1);',
    'Used native platform and existing dependency checks before custom code.',
  ].join('\n'),
});
const badHardware = evaluateLeanBehavior({ root: '.', text: 'function moveServo(ms) { if (ms) return ms; } // servo timer' });
const requested = evaluateLeanBehavior({
  root: '.',
  requestedExplanation: true,
  text: [
    '- Replaced the custom wrapper because the platform API covers the current behavior.',
    '- Kept the validation branch so trust-boundary input still fails closed.',
    '- Left one assert so the parser has a runnable check.',
    '- Deferred the broader abstraction until a second caller appears.',
    '- This is intentionally longer because the user requested the explanation.',
  ].join(' '),
});
const newDep = evaluateLeanBehavior({ root: '.', text: 'npm install left-pad\nfunction x() { return 1; }\nassert(x() === 1);' });
const requirementRisk = evaluateLeanBehavior({ root: '.', text: 'Skipped the explicit accessibility requirement to keep this short.' });
const markdown = renderMarkdown(good);
const opts = parseArgs(['--root', '.', '--text', 'hello', '--requested-explanation', '--json']);

const checks = [
  ['good behavior passes', good.status === 'pass' && good.probes['calibration-boundary'].status === 'pass' && good.probes['one-runnable-check'].status === 'pass'],
  ['hardware without calibration fails', badHardware.status === 'fail' && badHardware.probes['calibration-boundary'].status === 'fail'],
  ['requested explanation passes when substantive', requested.probes['requested-explanation'].status === 'pass'],
  ['new dependency fails without justification', newDep.status === 'fail' && newDep.probes['no-new-dependency'].status === 'fail'],
  ['explicit requirement risk fails', requirementRisk.probes['explicit-requirement-preserved'].status === 'fail'],
  ['renders markdown', markdown.includes('# Forgeflow Lean Behavior Eval') && markdown.includes('calibration-boundary')],
  ['parses args', opts.root === path.resolve('.') && opts.text === 'hello' && opts.requestedExplanation && opts.json],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('lean behavior eval: ok');
