#!/usr/bin/env node
const path = require('path');
const {
  HOST_COMMANDS,
  HOST_PARITY_POLICY,
  buildLeanHostCommandParity,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-host-command-parity');

const root = path.resolve(__dirname, '..', '..');
const result = buildLeanHostCommandParity({ root });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--json']);

const checks = [
  ['host command parity passes', result.status === 'pass' && result.summary.commands === HOST_COMMANDS.length],
  ['policy exports required commands', result.policy.required_host_parity.length === HOST_COMMANDS.length && HOST_PARITY_POLICY.optional_reason.includes('adoption evidence')],
  ['checks opencode command files', result.checks.some((item) => item.name.includes('OpenCode') && item.status === 'pass')],
  ['checks pi registration', result.checks.some((item) => item.name.includes('pi registered') && item.status === 'pass')],
  ['renders markdown', markdown.includes('# Forgeflow Lean Host Command Parity') && markdown.includes('read-only')],
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
console.log('lean host command parity: ok');
