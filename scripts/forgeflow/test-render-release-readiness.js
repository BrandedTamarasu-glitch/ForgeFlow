#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  allowedCommand,
  buildReleaseReadiness,
  releaseCheckEnv,
  releaseReadinessCommands,
  renderMarkdown,
} = require('./render-release-readiness');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-release-readiness-'));
fs.mkdirSync(path.join(root, 'commands'), { recursive: true });
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
const planned = buildReleaseReadiness({ root, planOnly: true, runner });
const markdown = renderMarkdown(result);
const readinessCommands = releaseReadinessCommands(fs.readFileSync(path.join(root, 'commands', 'forgeflow-release-check.md'), 'utf8'));
const missingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-release-readiness-missing-'));
const missingResult = buildReleaseReadiness({ root: missingRoot, runner });
process.env.NODE_OPTIONS = '--require=/tmp/forgeflow-should-not-load.js';
process.env.NODE_PATH = '/tmp/forgeflow-should-not-be-used';
const strippedEnv = releaseCheckEnv();
delete process.env.NODE_OPTIONS;
delete process.env.NODE_PATH;

const checks = [
  ['schema version', result.schema_version === '1'],
  ['blocked when command fails', result.status === 'blocked' && result.blockers.length === 1],
  ['blocker has exact command', result.blockers[0].command === 'node scripts/forgeflow/test-install-smoke.js'],
  ['categories are grouped', result.categories.metadata.total === 1 && result.categories['install-runtime'].failed === 1 && result.categories['project-context'].total === 1 && result.categories['source-smoke'].total === 1 && result.categories.whitespace.total === 1],
  ['readiness includes full release checklist commands', readinessCommands.some((command) => command.startsWith('node scripts/forgeflow/render-evaluation-report.js --outcomes')) && result.categories.quality.total === 2],
  ['plan-only does not run', planned.status === 'planned' && planned.checks.every((item) => item.status === 'planned')],
  ['missing release check fails closed', missingResult.status === 'blocked' && missingResult.blockers[0].command === 'read commands/forgeflow-release-check.md'],
  ['markdown renders blockers', markdown.includes('# Forgeflow Release Readiness') && markdown.includes('install helper missing') && markdown.includes('Release readiness is advisory')],
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
