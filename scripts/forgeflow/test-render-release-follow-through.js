#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildReleaseFollowThrough, consumerUpdateStatus, parseArgs, renderMarkdown } = require('./render-release-follow-through');

const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-release-follow-through-install-'));
fs.writeFileSync(path.join(installRoot, 'forgeflow-version'), '0000000\n');
const passRunner = () => ({ status: 0, stdout: '', stderr: '' });
const result = buildReleaseFollowThrough({ root: process.cwd(), installRoot, runner: passRunner });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', '.', '--json']);

const checks = [
  ['builds follow through', result.schema_version === '1' && result.checklist.length === 3],
  ['maps update verify statuses', consumerUpdateStatus('ready') === 'pass' && consumerUpdateStatus('restart') === 'info' && consumerUpdateStatus('repair') === 'attention'],
  ['keeps read-only boundary', result.boundary.includes('does not tag') && result.boundary.includes('repair installs')],
  ['renders checklist', markdown.includes('# Forgeflow Release Follow-Through') && markdown.includes('## Checklist')],
  ['suggests next action', result.next && result.next_reason],
  ['parses args', opts.root === path.resolve('.') && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('release follow-through: ok');
