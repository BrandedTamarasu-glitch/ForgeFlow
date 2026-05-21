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
  runSourceSmoke,
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
const sourceResult = smokeCheck({
  root: repoRoot,
  mode: 'source',
  patternsDir,
});
const fullResult = smokeCheck({
  root: repoRoot,
  mode: 'full',
  patternsDir,
});
const markdown = renderMarkdown(result);
const downstreamDocLinks = runOptionalNodeTest(tmp, 'scripts/forgeflow/test-doc-links.js', 'node scripts/forgeflow/test-doc-links.js', fakeHelperRoot);
const skippedSourceChecks = runSourceSmoke(tmp, fakeHelperRoot);

const checks = [
  ['combines pass', combineStatus([{ status: 'pass' }, { status: 'pass' }]) === 'pass'],
  ['combines warn', combineStatus([{ status: 'pass' }, { status: 'warn' }]) === 'warn'],
  ['combines fail', combineStatus([{ status: 'warn' }, { status: 'fail' }]) === 'fail'],
  ['resolves health refresh warning', healthStatus({ status: 'pass', recommendations: [{ action: 'refresh-latest-insights' }] }, { refresh: { status: 'pass' }, latest_insights: { freshness: { status: 'current' } } }) === 'pass'],
  ['keeps unresolved health warning', healthStatus({ status: 'pass', recommendations: [{ action: 'inspect-settings' }] }, { refresh: { status: 'pass' }, latest_insights: { freshness: { status: 'current' } } }) === 'warn'],
  ['runs without failure', result.status === 'pass' || result.status === 'warn'],
  ['default is downstream mode', result.mode === 'downstream'],
  ['includes downstream checks', ['health', 'trends-refresh', 'report-refresh', 'code-map'].every((name) => result.checks.some((item) => item.name === name))],
  ['default excludes source checks', !result.checks.some((item) => item.name === 'doc-links' || item.name === 'release-version')],
  ['source mode includes release checks', sourceResult.mode === 'source' && ['command-coverage', 'doc-links', 'plugin-manifest', 'release-version', 'install-manifest', 'update-forgeflow'].every((name) => sourceResult.checks.some((item) => item.name === name))],
  ['full mode includes both check groups', fullResult.mode === 'full' && ['health', 'code-map', 'doc-links', 'release-version'].every((name) => fullResult.checks.some((item) => item.name === name))],
  ['trends refresh present', result.checks.find((item) => item.name === 'trends-refresh').refresh_status === 'pass'],
  ['report refresh present', result.checks.find((item) => item.name === 'report-refresh').refresh_status === 'pass'],
  ['markdown renders table', markdown.includes('# Forgeflow Smoke Check (downstream)') && markdown.includes('| Check | Status | Command | Summary |')],
  ['skips repo tests when unavailable downstream', downstreamDocLinks.status === 'skip' && downstreamDocLinks.reason.includes('source-tree test not available')],
  ['source mode skips repo tests when unavailable downstream', skippedSourceChecks.every((item) => item.status === 'skip')],
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
