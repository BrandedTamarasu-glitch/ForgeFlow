#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkProfileCompliance, renderMarkdown } = require('./check-profile-compliance');

const result = checkProfileCompliance({ root: process.cwd() });
const markdown = renderMarkdown(result);
const installedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-profile-compliance-install-'));
for (const source of [
  'scripts/forgeflow/user-profile.js',
  'scripts/forgeflow/render-profile-review.js',
  'commands/forgeflow-profile.md',
  'commands/forgeflow-profile-review.md',
  'agents/atlas-review.md',
  'agents/compass-review.md',
  'agents/lumen-review.md',
  'agents/warden-review.md',
  'agents/smith-review.md',
  'agents/arbiter-review.md',
]) {
  const target = path.join(installedRoot, source);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(process.cwd(), source), target);
}
const installedResult = checkProfileCompliance({ root: installedRoot });
const checks = [
  ['status pass', result.status === 'pass'],
  ['roles checked', result.checks.length >= 6 && result.checks.every((item) => item.status === 'pass')],
  ['boundaries checked', result.boundary_checks.every((item) => item.status === 'pass')],
  ['covers profile review workflow', result.sources.some((file) => file.endsWith('render-profile-review.js')) && result.sources.some((file) => file.endsWith('forgeflow-profile-review.md')) && result.boundary_checks.some((item) => item.name === 'profile-review-covered' && item.status === 'pass')],
  ['installed root passes without wiki docs', installedResult.status === 'pass' && !installedResult.sources.some((file) => file.includes('docs/wiki'))],
  ['markdown renders', markdown.includes('## Roles') && markdown.includes('## Boundaries')],
];
let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('profile compliance: ok');
