#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildContextPack } = require('./build-context-pack');
const { runHealthCheck } = require('./health-check');
const { buildReport } = require('./render-forgeflow-report');
const { recordProjectLearning } = require('./record-project-learning');
const { showCodeMap } = require('./show-code-map');
const { showProjectLearnings } = require('./show-project-learnings');
const { showProjectTrends } = require('./show-project-trends');
const { smokeCheck } = require('./smoke-check');

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-dogfood-'));
const callerCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-dogfood-caller-'));
const projectDir = path.join(root, '.forgeflow', path.basename(root));
const patternsDir = path.join(root, 'forgeflow-patterns');

git(root, ['init']);
git(root, ['config', 'user.email', 'forgeflow@example.invalid']);
git(root, ['config', 'user.name', 'Forgeflow Test']);
write(path.join(root, 'README.md'), '# Dogfood Fixture\n');
write(path.join(root, 'src/shared.ts'), [
  'export function label(value: string) {',
  '  return value.trim();',
  '}',
  '',
].join('\n'));
write(path.join(root, 'src/app.ts'), [
  "import { label } from './shared';",
  '',
  "export const message = label('dogfood');",
  '',
].join('\n'));
git(root, ['add', 'README.md', 'src/app.ts', 'src/shared.ts']);
git(root, ['commit', '-m', 'init']);

write(path.join(root, 'src/shared.ts'), [
  'export function label(value: string) {',
  "  return value.trim().toUpperCase();",
  '}',
  '',
].join('\n'));

process.chdir(callerCwd);

const health = runHealthCheck({ root, fix: true });
recordProjectLearning({
  projectDir,
  category: 'validation-pattern',
  learning: 'Run dogfood self-test before release claims.',
  source: 'Compass',
  evidence: 'Disposable project exercised health, learnings, context, topology, trends, report, and smoke.',
  confidence: 'high',
  evidenceCount: 2,
  applicationGuidance: 'Use after focused helper tests pass.',
});
recordProjectLearning({
  projectDir,
  category: 'recommended-approach',
  learning: 'Old dogfood path used release checks only.',
  source: 'Atlas',
  status: 'superseded',
  supersededBy: 'Use the packaged dogfood self-test before release claims.',
});

const learnings = showProjectLearnings({ projectDir, check: true });
const latestDir = path.join(projectDir, 'context', 'latest');
const previousCwd = process.cwd();
process.chdir(root);
let contextPack;
try {
  contextPack = buildContextPack({
    out: latestDir,
    task: 'Dogfood Forgeflow self-test',
    maxMemoryChars: 4000,
    maxDiffChars: 8000,
  });
} finally {
  process.chdir(previousCwd);
}
const latestInsightsReport = JSON.parse(fs.readFileSync(path.join(latestDir, 'latest-insights-report.json'), 'utf8'));
const codeMap = showCodeMap({ root, projectDir, recordHistory: true });
const trends = showProjectTrends({ root, projectDir, refresh: true });
const report = buildReport({ root, projectDir, patternsDir, refresh: true, noDrift: true, record: false });
const smoke = smokeCheck({ root, projectDir, patternsDir, mode: 'downstream' });

const checks = [
  ['health repair passes', health.status === 'pass'],
  ['dogfood runs from unrelated cwd', process.cwd() === callerCwd],
  ['project learnings check passes', learnings.check && learnings.check.status === 'pass'],
  ['project learnings smoke stays external', learnings.context_smoke && learnings.context_smoke.status === 'skipped'],
  ['context pack writes packets', Object.keys(contextPack.synthesis_input.agent_packets || {}).length > 0 && latestInsightsReport.status === 'injected'],
  ['code map sees source graph', codeMap.summary.summary.source_files >= 2 && codeMap.summary.summary.local_edges >= 1],
  ['trends refresh passes', trends.refresh && trends.refresh.status === 'pass' && trends.latest_insights.status === 'injected'],
  ['report consumes trends', report.project_trends && report.project_trends.refresh && report.project_trends.refresh.status === 'pass'],
  ['smoke downstream runs readiness checks', ['pass', 'warn'].includes(smoke.status) && ['health', 'trends-refresh', 'report-refresh', 'code-map'].every((name) => smoke.checks.some((item) => item.name === name))],
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

console.log('dogfood self-test: ok');
