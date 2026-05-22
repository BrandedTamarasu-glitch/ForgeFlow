#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { runHealthCheck } = require('./health-check');
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
const downstreamRoot = path.join(tmp, 'downstream-project');
const patternsDir = path.join(downstreamRoot, 'forgeflow-patterns');
fs.mkdirSync(downstreamRoot, { recursive: true });
fs.mkdirSync(patternsDir, { recursive: true });
const fakeHelperRoot = path.join(tmp, 'installed-helper-root');
fs.mkdirSync(fakeHelperRoot, { recursive: true });

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

git(downstreamRoot, ['init']);
git(downstreamRoot, ['config', 'user.email', 'forgeflow@example.invalid']);
git(downstreamRoot, ['config', 'user.name', 'Forgeflow Test']);
write(path.join(downstreamRoot, 'README.md'), '# Downstream\n');
write(path.join(downstreamRoot, 'src/app.ts'), 'export const value = 1;\n');
git(downstreamRoot, ['add', 'README.md', 'src/app.ts']);
git(downstreamRoot, ['commit', '-m', 'init']);
write(path.join(downstreamRoot, 'src/app.ts'), 'export const value = 2;\n');
runHealthCheck({ root: downstreamRoot, fix: true });
process.chdir(downstreamRoot);

const result = smokeCheck({
  root: downstreamRoot,
  patternsDir,
});
const sourceResult = smokeCheck({
  root: repoRoot,
  mode: 'source',
  patternsDir,
});
const fullResult = smokeCheck({
  root: downstreamRoot,
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
  ['resolves health refresh warning', healthStatus({ status: 'pass', recommendations: [{ action: 'refresh-project-trends' }] }, { refresh: { status: 'pass' }, latest_insights: { freshness: { status: 'current' } } }) === 'pass'],
  ['keeps legacy refresh action compatible', healthStatus({ status: 'pass', recommendations: [{ action: 'refresh-latest-insights' }] }, { refresh: { status: 'pass' }, latest_insights: { freshness: { status: 'current' } } }) === 'pass'],
  ['keeps unresolved health warning', healthStatus({ status: 'pass', recommendations: [{ action: 'inspect-settings' }] }, { refresh: { status: 'pass' }, latest_insights: { freshness: { status: 'current' } } }) === 'warn'],
  ['runs without failure', result.status === 'pass' || result.status === 'warn'],
  ['default is downstream mode', result.mode === 'downstream'],
  ['includes downstream checks', ['health', 'trends-refresh', 'report-refresh', 'code-map'].every((name) => result.checks.some((item) => item.name === name))],
  ['default excludes source checks', !result.checks.some((item) => item.name === 'doc-links' || item.name === 'release-version')],
  ['source mode includes release checks', sourceResult.mode === 'source' && ['command-coverage', 'doc-links', 'plugin-manifest', 'release-version', 'install-manifest', 'update-forgeflow', 'dogfood-self-test', 'installed-runtime-dogfood'].every((name) => sourceResult.checks.some((item) => item.name === name))],
  ['full mode includes both check groups', fullResult.mode === 'full' && ['health', 'code-map', 'doc-links', 'release-version'].every((name) => fullResult.checks.some((item) => item.name === name))],
  ['trends refresh present', result.checks.find((item) => item.name === 'trends-refresh').refresh_status === 'pass'],
  ['trends exposes failure digest freshness', Boolean(result.checks.find((item) => item.name === 'trends-refresh').failure_digest_freshness)],
  ['report refresh present', result.checks.find((item) => item.name === 'report-refresh').refresh_status === 'pass'],
  ['report exposes failure digest freshness', Boolean(result.checks.find((item) => item.name === 'report-refresh').failure_digest_freshness)],
  ['markdown renders table', markdown.includes('# Forgeflow Smoke Check (downstream)') && markdown.includes('| Check | Status | Command | Summary |')],
  ['skips repo tests when unavailable downstream', downstreamDocLinks.status === 'skip' && downstreamDocLinks.reason.includes('source-tree test not available')],
  ['source mode skips repo tests when unavailable downstream', skippedSourceChecks.every((item) => item.status === 'skip')],
  ['does not fall back to helper repo for source checks', resolveNodeTestRoot(tmp, 'scripts/forgeflow/test-doc-links.js', repoRoot) === null],
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
