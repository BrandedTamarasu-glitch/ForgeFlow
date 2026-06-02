#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildReleaseFollowThrough, consumerUpdateStatus, parseArgs, readinessSummary, renderMarkdown } = require('./render-release-follow-through');

const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-release-follow-through-install-'));
fs.writeFileSync(path.join(installRoot, 'forgeflow-version'), '0000000\n');
const passRunner = () => ({ status: 0, stdout: '', stderr: '' });
const result = buildReleaseFollowThrough({ root: process.cwd(), installRoot, runner: passRunner });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', '.', '--json']);
const ready = readinessSummary([{ name: 'release', status: 'pass' }, { name: 'update', status: 'info' }]);
const installAttention = readinessSummary([{ name: 'post-publish-release-verify', status: 'install-attention' }]);
const infoMarkdown = renderMarkdown({
  ...result,
  readiness: {
    status: 'ready-to-install',
    install_ready: true,
    summary: 'Ready with restart follow-up.',
    blockers: [],
    informational: ['consumer-update-verify'],
  },
});

const checks = [
  ['builds follow through', result.schema_version === '1' && result.checklist.length === 3],
  ['readiness summary present', result.readiness && ['ready-to-install', 'needs-follow-through'].includes(result.readiness.status) && typeof result.readiness.install_ready === 'boolean'],
  ['readiness helper maps install ready', ready.status === 'ready-to-install' && ready.install_ready === true && ready.informational.includes('update')],
  ['readiness blocks install attention', installAttention.status === 'needs-follow-through' && installAttention.install_ready === false && installAttention.blockers.includes('post-publish-release-verify')],
  ['maps update verify statuses', consumerUpdateStatus('ready') === 'pass' && consumerUpdateStatus('restart') === 'info' && consumerUpdateStatus('repair') === 'attention'],
  ['keeps read-only boundary', result.boundary.includes('does not tag') && result.boundary.includes('repair installs')],
  ['renders checklist', markdown.includes('# Forgeflow Release Follow-Through') && markdown.includes('## Checklist') && markdown.includes('## Install Readiness')],
  ['renders informational follow-ups', infoMarkdown.includes('Informational follow-ups: consumer-update-verify')],
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
