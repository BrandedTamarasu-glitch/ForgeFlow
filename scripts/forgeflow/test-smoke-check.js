#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  combineStatus,
  healthStatus,
  renderMarkdown,
  resolveNodeTestRoot,
  runOptionalNodeTest,
  smokeCheck,
} = require('./smoke-check');

const repoRoot = path.resolve(__dirname, '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-smoke-check-'));
const patternsDir = path.join(tmp, 'forgeflow-patterns');
fs.mkdirSync(patternsDir, { recursive: true });
const fakeHelperRoot = path.join(tmp, 'installed-helper-root');
fs.mkdirSync(fakeHelperRoot, { recursive: true });

const result = smokeCheck({
  root: repoRoot,
  patternsDir,
});
const markdown = renderMarkdown(result);
const downstreamDocLinks = runOptionalNodeTest(tmp, 'scripts/forgeflow/test-doc-links.js', 'node scripts/forgeflow/test-doc-links.js', fakeHelperRoot);

const checks = [
  ['combines pass', combineStatus([{ status: 'pass' }, { status: 'pass' }]) === 'pass'],
  ['combines warn', combineStatus([{ status: 'pass' }, { status: 'warn' }]) === 'warn'],
  ['combines fail', combineStatus([{ status: 'warn' }, { status: 'fail' }]) === 'fail'],
  ['resolves health refresh warning', healthStatus({ status: 'pass', recommendations: [{ action: 'refresh-latest-insights' }] }, { refresh: { status: 'pass' }, latest_insights: { freshness: { status: 'current' } } }) === 'pass'],
  ['keeps unresolved health warning', healthStatus({ status: 'pass', recommendations: [{ action: 'inspect-settings' }] }, { refresh: { status: 'pass' }, latest_insights: { freshness: { status: 'current' } } }) === 'warn'],
  ['runs without failure', result.status === 'pass' || result.status === 'warn'],
  ['includes core checks', ['health', 'trends-refresh', 'report-refresh', 'code-map', 'doc-links', 'release-version'].every((name) => result.checks.some((item) => item.name === name))],
  ['trends refresh present', result.checks.find((item) => item.name === 'trends-refresh').refresh_status === 'pass'],
  ['report refresh present', result.checks.find((item) => item.name === 'report-refresh').refresh_status === 'pass'],
  ['markdown renders table', markdown.includes('# Forgeflow Smoke Check') && markdown.includes('| Check | Status | Command | Summary |')],
  ['skips repo tests when unavailable downstream', downstreamDocLinks.status === 'skip' && downstreamDocLinks.reason.includes('source-tree test not available')],
  ['resolves repo tests from helper root', resolveNodeTestRoot(tmp, 'scripts/forgeflow/test-doc-links.js', repoRoot) === repoRoot],
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

console.log('smoke check: ok');
