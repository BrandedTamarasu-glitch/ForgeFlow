#!/usr/bin/env node
const {
  buildLearningCaptureNudge,
  parseArgs,
  renderMarkdown,
  templateForEvent,
} = require('./render-learning-capture-nudge');

const review = buildLearningCaptureNudge({ event: 'review' });
const firstRun = buildLearningCaptureNudge({ event: 'first-run' });
const markdown = renderMarkdown(firstRun);
const opts = parseArgs(['--event', 'next-work', '--json']);
let invalid = false;
try {
  parseArgs(['--event', 'unknown']);
} catch (err) {
  invalid = err.message.includes('Invalid --event');
}

const checks = [
  ['review command routes to workflow capture', review.command === '/forgeflow-workflow-ending-capture --event review'],
  ['first-run requires observed values', firstRun.requires_observed_values === true && firstRun.command.includes('<pass|warn|fail>')],
  ['template helper returns agent feedback', templateForEvent('agent-feedback').command.includes('agent-feedback')],
  ['renders markdown', markdown.includes('# Forgeflow Learning Capture Nudge') && markdown.includes('Requires observed values: yes')],
  ['parses args', opts.event === 'next-work' && opts.json === true],
  ['rejects invalid event', invalid],
  ['boundary read-only', firstRun.boundary.includes('read-only') && firstRun.boundary.includes('does not write')],
  ['stop rule protects inferred evidence', firstRun.stop_rule.includes('Do not record inferred')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('learning capture nudge: ok');
