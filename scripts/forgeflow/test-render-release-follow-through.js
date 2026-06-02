#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildReleaseFollowThrough, consumerUpdateStatus, parseArgs, readinessSummary, releaseConsumptionVerdict, releaseVerifyChecklistStatus, renderMarkdown, snapshotPathFor } = require('./render-release-follow-through');

const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-release-follow-through-install-'));
fs.writeFileSync(path.join(installRoot, 'forgeflow-version'), '0000000\n');
const passRunner = () => ({ status: 0, stdout: '', stderr: '' });
const result = buildReleaseFollowThrough({ root: process.cwd(), installRoot, runner: passRunner });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', '.', '--save', '--json']);
const snapshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-release-follow-through-snapshot-'));
const snapshotProjectDir = path.join(snapshotRoot, '.forgeflow', 'SnapshotProject');
const savedResult = buildReleaseFollowThrough({ root: snapshotRoot, projectDir: snapshotProjectDir, installRoot, runner: passRunner, save: true });
const savedSnapshot = JSON.parse(fs.readFileSync(savedResult.snapshot.path, 'utf8'));
const symlinkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-release-follow-through-symlink-'));
const symlinkProjectDir = path.join(symlinkRoot, '.forgeflow', 'SymlinkProject');
const symlinkSnapshotDir = path.join(symlinkProjectDir, 'release-follow-through');
fs.mkdirSync(symlinkSnapshotDir, { recursive: true });
const outsideSnapshot = path.join(symlinkRoot, 'outside.json');
fs.writeFileSync(outsideSnapshot, '{}\n');
fs.symlinkSync(outsideSnapshot, path.join(symlinkSnapshotDir, 'latest.json'));
let symlinkWriteBlocked = false;
try {
  buildReleaseFollowThrough({ root: symlinkRoot, projectDir: symlinkProjectDir, installRoot, runner: passRunner, save: true });
} catch (err) {
  symlinkWriteBlocked = err.message.includes('symlinked file');
}
const ready = readinessSummary([{ name: 'release', status: 'pass' }, { name: 'update', status: 'info' }]);
const installAttention = readinessSummary([{ name: 'post-publish-release-verify', status: 'install-attention' }]);
const consumed = releaseConsumptionVerdict([{ name: 'release', status: 'pass' }, { name: 'update', status: 'pass' }], readinessSummary([{ name: 'release', status: 'pass' }, { name: 'update', status: 'pass' }]));
const consumedFollowUp = releaseConsumptionVerdict([{ name: 'release', status: 'pass' }, { name: 'update', status: 'info' }], ready);
const notConsumed = releaseConsumptionVerdict([{ name: 'release', status: 'attention', next: '/fix' }], readinessSummary([{ name: 'release', status: 'attention', next: '/fix' }]));
const infoMarkdown = renderMarkdown({
  ...result,
  readiness: {
    status: 'ready-to-install',
    install_ready: true,
    summary: 'Ready with restart follow-up.',
    blockers: [],
    informational: ['consumer-update-verify'],
  },
  release_consumption: consumedFollowUp,
});

const checks = [
  ['builds follow through', result.schema_version === '1' && result.checklist.length === 3],
  ['readiness summary present', result.readiness && ['ready-to-install', 'needs-follow-through'].includes(result.readiness.status) && typeof result.readiness.install_ready === 'boolean'],
  ['release consumption present', result.release_consumption && typeof result.release_consumption.consumed === 'boolean' && result.release_consumption.summary],
  ['readiness helper maps install ready', ready.status === 'ready-to-install' && ready.install_ready === true && ready.informational.includes('update')],
  ['readiness blocks install attention', installAttention.status === 'needs-follow-through' && installAttention.install_ready === false && installAttention.blockers.includes('post-publish-release-verify')],
  ['release verify checklist status maps info drift', releaseVerifyChecklistStatus({ status: 'install-attention', local_consumability: { status: 'info' } }) === 'info' && releaseVerifyChecklistStatus({ status: 'install-attention', local_consumability: { status: 'attention' } }) === 'install-attention'],
  ['maps consumption verdicts', consumed.status === 'consumed' && consumed.confidence === 'high' && consumedFollowUp.status === 'consumed-with-follow-up' && notConsumed.status === 'not-consumed' && notConsumed.next === '/fix'],
  ['maps update verify statuses', consumerUpdateStatus('ready') === 'pass' && consumerUpdateStatus('restart') === 'info' && consumerUpdateStatus('repair') === 'attention'],
  ['keeps read-only boundary', result.boundary.includes('does not tag') && result.boundary.includes('repair installs')],
  ['renders checklist', markdown.includes('# Forgeflow Release Follow-Through') && markdown.includes('## Checklist') && markdown.includes('## Install Readiness') && markdown.includes('## Release Consumption')],
  ['renders snapshot status', markdown.includes('Snapshot: (not saved)')],
  ['renders informational follow-ups', infoMarkdown.includes('Informational follow-ups: consumer-update-verify') && infoMarkdown.includes('consumed-with-follow-up')],
  ['suggests next action', result.next && result.next_reason],
  ['parses args', opts.root === path.resolve('.') && opts.save === true && opts.json === true],
  ['snapshot path stable', snapshotPathFor(snapshotRoot, snapshotProjectDir) === savedResult.snapshot.path],
  ['saves snapshot when requested', savedResult.snapshot.saved === true && savedSnapshot.schema_version === '1' && savedSnapshot.snapshot.saved === true],
  ['blocks symlink snapshot destination', symlinkWriteBlocked],
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
