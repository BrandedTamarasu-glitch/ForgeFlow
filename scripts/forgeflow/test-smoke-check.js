#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { runHealthCheck } = require('./health-check');
const {
  combineStatus,
  codeMapGapSummary,
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
write(path.join(downstreamRoot, 'src/config.json'), '{"enabled":true}\n');
git(downstreamRoot, ['add', 'README.md', 'src/app.ts']);
git(downstreamRoot, ['commit', '-m', 'init']);
write(path.join(downstreamRoot, 'src/app.ts'), "import config from './config.json';\nexport const value = config.enabled ? 2 : 1;\n");
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
const healthCheck = result.checks.find((item) => item.name === 'health');
const codeMapCheck = result.checks.find((item) => item.name === 'code-map');
const trendsCheck = result.checks.find((item) => item.name === 'trends-refresh');
const reportCheck = result.checks.find((item) => item.name === 'report-refresh');
const downstreamDocLinks = runOptionalNodeTest(tmp, 'scripts/forgeflow/test-doc-links.js', 'node scripts/forgeflow/test-doc-links.js', fakeHelperRoot);
const skippedSourceChecks = runSourceSmoke(tmp, fakeHelperRoot);
const allSkippedSourceResult = smokeCheck({
  root: tmp,
  mode: 'source',
  patternsDir,
});

const checks = [
  ['combines pass', combineStatus([{ status: 'pass' }, { status: 'pass' }]) === 'pass'],
  ['combines warn', combineStatus([{ status: 'pass' }, { status: 'warn' }]) === 'warn'],
  ['combines fail', combineStatus([{ status: 'warn' }, { status: 'fail' }]) === 'fail'],
  ['resolves health refresh warning', healthStatus({ status: 'pass', recommendations: [{ action: 'refresh-project-trends' }] }, { refresh: { status: 'pass' }, latest_insights: { freshness: { status: 'current' } } }) === 'pass'],
  ['keeps legacy refresh action compatible', healthStatus({ status: 'pass', recommendations: [{ action: 'refresh-latest-insights' }] }, { refresh: { status: 'pass' }, latest_insights: { freshness: { status: 'current' } } }) === 'pass'],
  ['keeps unresolved health warning', healthStatus({ status: 'pass', recommendations: [{ action: 'inspect-settings' }] }, { refresh: { status: 'pass' }, latest_insights: { freshness: { status: 'current' } } }) === 'warn'],
  ['code map gap summary separates expected from review', codeMapGapSummary({ limits: { production_total: 2, test_fixture_total: 1 }, triage: { expected_total: 2, needs_review_total: 0 } }).explanation.includes('informational') && codeMapGapSummary({ limits: { production_total: 3 }, triage: { expected_total: 1, needs_review_total: 2 } }).explanation.includes('need review')],
  ['runs without failure', result.status === 'pass' || result.status === 'warn'],
  ['default is downstream mode', result.mode === 'downstream'],
  ['includes downstream checks', ['health', 'trends-refresh', 'report-refresh', 'code-map'].every((name) => result.checks.some((item) => item.name === name))],
  ['code-map passes expected production gaps', codeMapCheck.status === 'pass' && codeMapCheck.production_total >= 1 && codeMapCheck.expected_total >= 1 && codeMapCheck.needs_review_total === 0 && codeMapCheck.import_gap_explanation.includes('informational') && codeMapCheck.summary.includes('no import gaps currently need review')],
  ['default excludes source checks', !result.checks.some((item) => item.name === 'doc-links' || item.name === 'release-version')],
  ['source mode includes release checks', sourceResult.mode === 'source' && ['command-coverage', 'doc-links', 'plugin-manifest', 'release-version', 'install-manifest', 'update-forgeflow', 'dogfood-self-test', 'installed-runtime-dogfood'].every((name) => sourceResult.checks.some((item) => item.name === name))],
  ['full mode includes both check groups', fullResult.mode === 'full' && ['health', 'code-map', 'doc-links', 'release-version'].every((name) => fullResult.checks.some((item) => item.name === name))],
  ['trends refresh present', trendsCheck.refresh_status === 'pass'],
  ['trends exposes failure digest freshness', Boolean(trendsCheck.failure_digest_freshness)],
  ['report refresh present', reportCheck.refresh_status === 'pass'],
  ['report exposes failure digest freshness', Boolean(reportCheck.failure_digest_freshness)],
  ['check recommendations include explanation', [healthCheck, trendsCheck, reportCheck].filter((item) => item.recommendations.length > 0).every((item) => item.reason && item.evidence && item.clears && item.next_actions.length > 0)],
  ['warn fail checks include explanation', result.checks.filter((item) => item.status === 'warn' || item.status === 'fail').every((item) => item.reason && item.evidence && item.clears && item.next_actions.length > 0)],
  ['markdown renders recommendation evidence', markdown.includes('Evidence:') && markdown.includes('Clears:') && markdown.includes('Next:')],
  ['markdown warning does not lead with pass summary', !markdown.includes('| health | warn | forgeflow-health | pass ')],
  ['markdown renders table', markdown.includes('# Forgeflow Smoke Check (downstream)') && markdown.includes('| Check | Status | Command | Summary |')],
  ['skips repo tests when unavailable downstream', downstreamDocLinks.status === 'skip' && downstreamDocLinks.reason.includes('source-tree test not available')],
  ['source mode skips repo tests when unavailable downstream', skippedSourceChecks.every((item) => item.status === 'skip')],
  ['source mode fails when all release guards skip', allSkippedSourceResult.status === 'fail' && allSkippedSourceResult.checks.some((item) => item.name === 'source-release-guards' && item.reason && item.evidence && item.clears && item.next_actions.length > 0)],
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
