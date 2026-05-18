#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { expectedRuntimeSources, expectedTemplateSources, runHealthCheck } = require('./health-check');
const { manifestEntry } = require('./install-manifest');
const { spawnSync } = require('child_process');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-health-'));
spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' });
const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-health-install-'));
const nonGitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-health-nongit-'));
fs.writeFileSync(path.join(root, '.gitignore'), 'node_modules/\n');
for (const source of expectedRuntimeSources()) {
  const entry = manifestEntry(source, installRoot);
  fs.mkdirSync(path.dirname(entry.destination), { recursive: true });
  fs.writeFileSync(entry.destination, 'helper\n');
  fs.chmodSync(entry.destination, 0o755);
}
for (const source of expectedTemplateSources()) {
  const entry = manifestEntry(source, installRoot);
  fs.mkdirSync(path.dirname(entry.destination), { recursive: true });
  fs.writeFileSync(entry.destination, 'template\n');
}

const before = runHealthCheck({ root, fix: false });
const fixed = runHealthCheck({ root, fix: true });
const again = runHealthCheck({ root, fix: true });
const installed = runHealthCheck({ root, installRoot, fix: false });
fs.unlinkSync(manifestEntry('scripts/forgeflow/health-check.js', installRoot).destination);
const missingInstalled = runHealthCheck({ root, installRoot, fix: false });
fs.writeFileSync(manifestEntry('scripts/forgeflow/health-check.js', installRoot).destination, 'helper\n');
fs.chmodSync(manifestEntry('scripts/forgeflow/health-check.js', installRoot).destination, 0o755);
fs.unlinkSync(manifestEntry('templates/ship-presentation.html', installRoot).destination);
const missingTemplate = runHealthCheck({ root, installRoot, fix: false });
const nonGit = runHealthCheck({ root: nonGitRoot, fix: true });

const project = path.basename(root);
const checks = [
  ['before fails', before.status === 'fail'],
  ['fixed passes', fixed.status === 'pass'],
  ['forgeflow dir created', fs.existsSync(path.join(root, '.forgeflow', project))],
  ['agent notes created', fs.existsSync(path.join(root, '.forgeflow', project, 'agent-notes'))],
  ['gitignore updated', fs.readFileSync(path.join(root, '.gitignore'), 'utf8').includes('.forgeflow/')],
  ['budget seeded', fs.existsSync(path.join(root, '.forgeflow-budget.json'))],
  ['idempotent no changes', again.changes.length === 0],
  ['installed runtime passes', installed.status === 'pass'],
  ['missing runtime fails', missingInstalled.status === 'fail'],
  ['runtime check included', installed.checks.some((item) => item.name === 'runtime helper health-check.js')],
  ['template check included', installed.checks.some((item) => item.name === 'template ship-presentation.html')],
  ['missing template fails', missingTemplate.status === 'fail'],
  ['non git passes with skip', nonGit.status === 'pass'],
  ['non git project check skipped', nonGit.checks.some((item) => item.status === 'skip' && item.name === 'project-local .forgeflow/')],
  ['non git fix does not create forgeflow', !fs.existsSync(path.join(nonGitRoot, '.forgeflow'))],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log('health check: ok');
