#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  allowedCommand,
  blockerKind,
  buildReleaseReadiness,
  clearingAction,
  compareReleaseReadiness,
  parseArgs,
  releaseToInstallPreflight,
  releaseCheckEnv,
  releaseReadinessCommands,
  renderMarkdown,
} = require('./render-release-readiness');
const { RUNTIME_HELPERS } = require('./install-manifest');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-release-readiness-'));
fs.mkdirSync(path.join(root, 'commands'), { recursive: true });
for (const source of RUNTIME_HELPERS) {
  const file = path.join(root, source);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source.endsWith('.sh') ? '#!/bin/sh\n' : '#!/usr/bin/env node\n');
}
fs.writeFileSync(path.join(root, 'commands', 'forgeflow-release-check.md'), [
  '```bash',
  'node scripts/forgeflow/test-release-version.js',
  'node scripts/forgeflow/test-install-smoke.js',
  'node scripts/forgeflow/test-build-code-topology.js',
  'node scripts/forgeflow/test-record-agent-feedback.js',
  'node scripts/forgeflow/render-evaluation-report.js --outcomes fixtures/evaluation/sample-outcomes.jsonl --public --out /tmp/forgeflow-public-evaluation-summary.md',
  'node scripts/forgeflow/smoke-check.js --mode source --json',
  'git diff --check',
  '```',
].join('\n'));

const runner = (bin, args) => {
  const command = [bin, ...args].join(' ');
  if (command.includes('test-install-smoke.js')) {
    return { status: 1, stdout: '', stderr: 'install helper missing' };
  }
  return { status: 0, stdout: `${command} ok`, stderr: '' };
};

const result = buildReleaseReadiness({ root, runner });
const savedResult = buildReleaseReadiness({ root, runner, saveCurrent: true });
const baselineRunner = (bin, args) => {
  const command = [bin, ...args].join(' ');
  if (command.includes('test-release-version.js')) {
    return { status: 1, stdout: '', stderr: 'version drift' };
  }
  return { status: 0, stdout: `${command} ok`, stderr: '' };
};
const baseline = buildReleaseReadiness({ root, runner: baselineRunner });
const baselinePath = path.join(root, 'baseline-release-readiness.json');
fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
const comparedResult = buildReleaseReadiness({ root, runner, baseline: baselinePath });
const compareLastResult = buildReleaseReadiness({ root, runner: baselineRunner, compareLast: true });
const badBaselinePath = path.join(root, 'bad-baseline.json');
fs.writeFileSync(badBaselinePath, '{not-json');
const badBaselineResult = buildReleaseReadiness({ root, runner, baseline: badBaselinePath });
const planned = buildReleaseReadiness({ root, planOnly: true, runner });
const markdown = renderMarkdown(result);
const comparedMarkdown = renderMarkdown(comparedResult);
const badBaselineMarkdown = renderMarkdown(badBaselineResult);
const parsedCompareLast = parseArgs(['--compare-last', '--save-current', '--json']);
const readinessCommands = releaseReadinessCommands(fs.readFileSync(path.join(root, 'commands', 'forgeflow-release-check.md'), 'utf8'));
const missingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-release-readiness-missing-'));
const missingHelperRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-release-readiness-helper-missing-'));
fs.cpSync(root, missingHelperRoot, { recursive: true });
fs.unlinkSync(path.join(missingHelperRoot, RUNTIME_HELPERS[0]));
const missingHelperPreflight = releaseToInstallPreflight(missingHelperRoot);
const symlinkHelperRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-release-readiness-helper-symlink-'));
const externalHelperDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-release-readiness-external-helper-'));
fs.cpSync(root, symlinkHelperRoot, { recursive: true });
fs.writeFileSync(path.join(externalHelperDir, path.basename(RUNTIME_HELPERS[1])), '#!/usr/bin/env node\n');
fs.unlinkSync(path.join(symlinkHelperRoot, RUNTIME_HELPERS[1]));
fs.symlinkSync(path.join(externalHelperDir, path.basename(RUNTIME_HELPERS[1])), path.join(symlinkHelperRoot, RUNTIME_HELPERS[1]));
const symlinkHelperPreflight = releaseToInstallPreflight(symlinkHelperRoot);
const missingResult = buildReleaseReadiness({ root: missingRoot, runner });
const spawnError = buildReleaseReadiness({
  root,
  runner: (bin, args) => ({ status: 0, stdout: '', stderr: '', error: new Error(`spawnSync ${bin} EPERM ${args.length}`) }),
});
const spawnMissingCommand = buildReleaseReadiness({
  root,
  runner: (bin, args) => ({ status: null, stdout: '', stderr: '', error: new Error(`spawnSync ${bin} ENOENT ${args.length}`) }),
});
process.env.NODE_OPTIONS = '--require=/tmp/forgeflow-should-not-load.js';
process.env.NODE_PATH = '/tmp/forgeflow-should-not-be-used';
const strippedEnv = releaseCheckEnv();
delete process.env.NODE_OPTIONS;
delete process.env.NODE_PATH;

const checks = [
  ['schema version', result.schema_version === '1'],
  ['parse compare-last flags', parsedCompareLast.compareLast === true && parsedCompareLast.saveCurrent === true && parsedCompareLast.json === true],
  ['blocked when command fails', result.status === 'blocked' && result.blockers.length === 1],
  ['blocker has exact command', result.blockers[0].command === 'node scripts/forgeflow/test-install-smoke.js'],
  ['categories are grouped', result.categories.metadata.total === 1 && result.categories['install-runtime'].failed === 1 && result.categories['project-context'].total === 1 && result.categories['source-smoke'].total === 1 && result.categories.whitespace.total === 1],
  ['release-to-install preflight passes with helper sources', result.install_preflight.status === 'pass' && result.install_preflight.checked === RUNTIME_HELPERS.length && result.install_preflight.present === RUNTIME_HELPERS.length && result.install_preflight.managed === RUNTIME_HELPERS.length && result.checks.some((item) => item.command === 'release-to-install preflight' && item.status === 'pass')],
  ['comparison defaults to no baseline', result.comparison.status === 'no-baseline' && result.comparison.baseline.reason === 'no baseline provided'],
  ['save current writes standard snapshot', savedResult.snapshot.saved === true && savedResult.boundary.includes('wrote the requested local readiness snapshot') && fs.existsSync(savedResult.snapshot.path) && savedResult.snapshot.path.endsWith(path.join('.forgeflow', path.basename(root), 'release-readiness', 'last.json')) && JSON.parse(fs.readFileSync(savedResult.snapshot.path, 'utf8')).schema_version === '1'],
  ['comparison detects newly failing and cleared blockers', comparedResult.comparison.status === 'regressed' && comparedResult.comparison.baseline.path === baselinePath && comparedResult.comparison.baseline.generated_at === baseline.generated_at && comparedResult.comparison.newly_failing.some((item) => item.command === 'node scripts/forgeflow/test-install-smoke.js') && comparedResult.comparison.cleared_blockers.some((item) => item.command === 'node scripts/forgeflow/test-release-version.js') && comparedResult.comparison.category_movement.some((item) => item.category === 'metadata' && item.failed_delta === -1) && comparedResult.comparison.category_movement.some((item) => item.category === 'install-runtime' && item.failed_delta === 1)],
  ['compare-last reads standard snapshot', compareLastResult.comparison.baseline.path === savedResult.snapshot.path && compareLastResult.comparison.newly_failing.some((item) => item.command === 'node scripts/forgeflow/test-release-version.js') && compareLastResult.comparison.cleared_blockers.some((item) => item.command === 'node scripts/forgeflow/test-install-smoke.js')],
  ['bad baseline does not abort readiness', badBaselineResult.status === result.status && badBaselineResult.comparison.status === 'no-baseline' && badBaselineResult.comparison.baseline.path === badBaselinePath && badBaselineResult.comparison.baseline.reason.length > 0],
  ['comparison helper reports unchanged', compareReleaseReadiness(result, result).status === 'unchanged'],
  ['release-to-install preflight catches missing helper source', missingHelperPreflight.status === 'fail' && missingHelperPreflight.missing.includes(RUNTIME_HELPERS[0]) && missingHelperPreflight.present === RUNTIME_HELPERS.length - 1 && missingHelperPreflight.managed === RUNTIME_HELPERS.length && missingHelperPreflight.repair.includes('before tagging')],
  ['release-to-install preflight rejects out-of-tree helper source', symlinkHelperPreflight.status === 'fail' && symlinkHelperPreflight.out_of_tree.includes(RUNTIME_HELPERS[1]) && symlinkHelperPreflight.present === RUNTIME_HELPERS.length - 1],
  ['readiness includes full release checklist commands', readinessCommands.some((command) => command.startsWith('node scripts/forgeflow/render-evaluation-report.js --outcomes')) && result.categories.quality.total === 2],
  ['plan-only does not run commands', planned.status === 'planned' && planned.checks.filter((item) => item.command !== 'release-to-install preflight').every((item) => item.status === 'planned') && planned.install_preflight.status === 'pass'],
  ['missing release check fails closed', missingResult.status === 'blocked' && missingResult.blockers[0].command === 'read commands/forgeflow-release-check.md'],
  ['spawn error fails closed even with zero status', spawnError.status === 'blocked' && spawnError.blockers.length === 7 && spawnError.blockers.every((item) => item.kind === 'execution-environment' && item.output.includes('EPERM') && item.clears.includes('trusted local environment'))],
  ['spawn missing command reports missing-command blockers', spawnMissingCommand.status === 'blocked' && spawnMissingCommand.blockers.length === 7 && spawnMissingCommand.blockers.every((item) => item.kind === 'missing-command' && item.output.includes('ENOENT') && item.clears.includes('Install or restore the missing local command'))],
  ['classifies blocker kinds', blockerKind({ command: 'node scripts/forgeflow/test.js', stderr: 'spawnSync node EPERM' }) === 'execution-environment' && blockerKind({ command: 'node scripts/forgeflow/test.js', stderr: 'spawnSync node ENOENT' }) === 'missing-command' && blockerKind({ command: 'release-to-install preflight', stderr: 'runtime-helper-source-missing' }) === 'release-to-install-preflight' && blockerKind({ command: 'read commands/forgeflow-release-check.md', stderr: 'missing' }) === 'release-check-source' && clearingAction({ command: 'node scripts/forgeflow/test.js', stderr: 'spawnSync node EPERM' }).includes('trusted local environment') && clearingAction({ command: 'node scripts/forgeflow/test.js', stderr: 'spawnSync node ENOENT' }).includes('Install or restore the missing local command') && clearingAction({ command: 'release-to-install preflight', stderr: 'runtime-helper-source-missing' }).includes('before tagging')],
  ['markdown renders blockers', markdown.includes('# Forgeflow Release Readiness') && markdown.includes('install helper missing') && markdown.includes('Kind: command-failure') && markdown.includes('## Baseline Comparison') && markdown.includes('No baseline compared: no baseline provided') && markdown.includes('## Release To Install Preflight') && markdown.includes('present,') && markdown.includes('Release readiness is advisory') && markdown.includes('unless --save-current is passed')],
  ['markdown renders baseline comparison', comparedMarkdown.includes('Status: regressed') && comparedMarkdown.includes('Newly failing: 1') && comparedMarkdown.includes('Cleared blockers: 1') && comparedMarkdown.includes('metadata: fail -> pass') && comparedMarkdown.includes('install-runtime: pass -> fail')],
  ['markdown renders bad baseline reason', badBaselineMarkdown.includes('No baseline compared:') && badBaselineMarkdown.includes('Baseline path:') && badBaselineMarkdown.includes(badBaselinePath)],
  ['allows release commands', allowedCommand('node scripts/forgeflow/test-release-version.js') && allowedCommand('node scripts/forgeflow/smoke-check.js --mode source --json') && allowedCommand('node scripts/forgeflow/render-evaluation-report.js --outcomes fixtures/evaluation/sample-outcomes.jsonl --public --out /tmp/forgeflow-public-evaluation-summary.md') && allowedCommand('git diff --check')],
  ['rejects unsafe commands', !allowedCommand('curl https://example.com') && !allowedCommand('node scripts/forgeflow/test-release-version.js; rm -rf /')],
  ['release checks strip node preload env', strippedEnv.NODE_OPTIONS === undefined && strippedEnv.NODE_PATH === undefined],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('release readiness: ok');
