#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildChecks,
  buildReleaseConsumptionRollup,
  parseArgs,
  renderMarkdown,
  rollupStatus,
  snapshotPathFor,
} = require('./render-release-consumption-rollup');

function followThrough(overrides = {}) {
  return {
    status: 'pass',
    version: '4.3.44',
    tag: 'v4.3.44',
    release_consumption: {
      status: 'consumed',
      consumed: true,
      confidence: 'high',
      next: '/forgeflow-post-release-install-verify',
      summary: 'Consumed.',
    },
    readiness: {
      status: 'ready-to-install',
      install_ready: true,
      summary: 'Ready.',
      blockers: [],
      informational: [],
    },
    checklist: [
      { name: 'post-publish-release-verify', status: 'pass', next: '/forgeflow-release-verify --save' },
      { name: 'consumer-update-verify', status: 'pass', next: '/forgeflow-update-verify' },
      { name: 'runtime-consumability', status: 'pass', next: '/update-forgeflow --repair' },
    ],
    release_verify_status: 'pass',
    update_verify_status: 'ready',
    next: '/forgeflow-post-release-install-verify',
    next_reason: 'Ready.',
    ...overrides,
  };
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-release-consumption-'));
const projectDir = path.join(root, '.forgeflow', 'ReleaseConsumption');
const pass = buildReleaseConsumptionRollup({ root, projectDir, followThrough: followThrough() });
const markdown = renderMarkdown(pass);
const attention = buildReleaseConsumptionRollup({
  root,
  projectDir,
  followThrough: followThrough({
    status: 'attention',
    release_consumption: {
      status: 'not-consumed',
      consumed: false,
      confidence: 'low',
      next: '/forgeflow-release-follow-through',
      summary: 'Needs follow-through.',
    },
    next: '/forgeflow-release-follow-through',
    next_reason: 'Needs follow-through.',
  }),
});
const smokeAttention = buildReleaseConsumptionRollup({
  root,
  projectDir,
  followThrough: followThrough(),
  smoke: {
    status: 'warn',
    command: '/forgeflow-smoke',
    mode: 'downstream',
    summary: 'Smoke warning.',
  },
});
const smokePass = buildReleaseConsumptionRollup({
  root,
  projectDir,
  withSmoke: true,
  followThrough: followThrough(),
  smoke: {
    status: 'pass',
    command: '/forgeflow-smoke',
    mode: 'downstream',
    summary: 'Smoke passed.',
    checks: 3,
  },
});
const saveRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-release-consumption-save-'));
const saveProjectDir = path.join(saveRoot, '.forgeflow', 'SaveProject');
const saved = buildReleaseConsumptionRollup({ root: saveRoot, projectDir: saveProjectDir, followThrough: followThrough(), save: true });
const savedSnapshot = JSON.parse(fs.readFileSync(saved.snapshot.path, 'utf8'));
const symlinkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-release-consumption-symlink-'));
const symlinkProjectDir = path.join(symlinkRoot, '.forgeflow', 'SymlinkProject');
const symlinkSnapshotDir = path.join(symlinkProjectDir, 'release-consumption');
fs.mkdirSync(symlinkSnapshotDir, { recursive: true });
const outsideSnapshot = path.join(symlinkRoot, 'outside.json');
fs.writeFileSync(outsideSnapshot, '{}\n');
fs.symlinkSync(outsideSnapshot, path.join(symlinkSnapshotDir, 'latest.json'));
let symlinkWriteBlocked = false;
try {
  buildReleaseConsumptionRollup({ root: symlinkRoot, projectDir: symlinkProjectDir, followThrough: followThrough(), save: true });
} catch (err) {
  symlinkWriteBlocked = err.message.includes('symlinked file');
}
const opts = parseArgs(['--root', '.', '--project-dir', projectDir, '--with-smoke', '--save', '--json']);
const checks = buildChecks(followThrough(), { status: 'not-run', command: '/forgeflow-smoke' });

const assertions = [
  ['builds pass rollup', pass.schema_version === '1' && pass.status === 'pass' && pass.checks.length === 3],
  ['default does not run smoke', pass.downstream_smoke.status === 'not-run' && pass.downstream_smoke.summary.includes('--with-smoke')],
  ['attention when release not consumed', attention.status === 'attention' && attention.next === '/forgeflow-release-follow-through'],
  ['attention when smoke warns', smokeAttention.status === 'attention' && smokeAttention.downstream_smoke.status === 'warn'],
  ['with-smoke can record smoke evidence', smokePass.status === 'pass' && smokePass.downstream_smoke.checks === 3],
  ['checks summarize release and smoke', checks[0].name === 'release-follow-through' && checks[1].status === 'pass' && checks[2].next === '/forgeflow-smoke'],
  ['rollup status helper maps pass and attention', rollupStatus(followThrough(), { status: 'not-run' }) === 'pass' && rollupStatus(followThrough({ release_consumption: { consumed: false } }), { status: 'pass' }) === 'attention'],
  ['renders markdown sections', markdown.includes('# Forgeflow Release Consumption Rollup') && markdown.includes('## Evidence') && markdown.includes('## Rollup Checks')],
  ['keeps read-only boundary', pass.boundary.includes('read-only unless --save') && pass.boundary.includes('does not tag')],
  ['parses args', opts.root === path.resolve('.') && opts.projectDir === path.resolve(projectDir) && opts.withSmoke === true && opts.save === true && opts.json === true],
  ['snapshot path stable', snapshotPathFor(saveRoot, saveProjectDir) === saved.snapshot.path],
  ['saves snapshot when requested', saved.snapshot.saved === true && savedSnapshot.schema_version === '1' && savedSnapshot.snapshot.saved === true],
  ['blocks symlink snapshot destination', symlinkWriteBlocked],
];

let failed = 0;
for (const [name, ok] of assertions) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('release consumption rollup: ok');
