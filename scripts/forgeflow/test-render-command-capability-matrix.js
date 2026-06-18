#!/usr/bin/env node
const path = require('path');
const {
  buildCommandCapabilityMatrix,
  parseArgs,
  renderMarkdown,
  skillNameForCommand,
} = require('./render-command-capability-matrix');

const root = path.resolve(__dirname, '..', '..');
const result = buildCommandCapabilityMatrix({ root });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--json']);

const leanPrime = result.rows.find((row) => row.command === 'forgeflow-lean-prime');
const review = result.rows.find((row) => row.command === 'review');

const checks = [
  ['matrix passes for command wrappers', result.status === 'pass' && result.summary.commands > 100],
  ['lean prime has required host command coverage', leanPrime && leanPrime.policy === 'required-host-parity' && leanPrime.forgeflow_command && leanPrime.pi_alias && leanPrime.opencode_command && leanPrime.gaps.length === 0],
  ['core review maps to skill', review && review.skill && skillNameForCommand('review') === 'forgeflow-review'],
  ['renders policy table', markdown.includes('# Forgeflow Command Capability Matrix') && markdown.includes('| Command | Policy | Forgeflow | Pi | OpenCode | Skill | Gaps |')],
  ['parses args', opts.root === root && opts.json],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('command capability matrix: ok');
