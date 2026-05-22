#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  expectedInstallSources,
  gitignoreState,
  renderMarkdown,
  runHealthCheck,
} = require('./health-check');
const { manifestEntry } = require('./install-manifest');
const { spawnSync } = require('child_process');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-health-'));
spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' });
const project = path.basename(root);
const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-health-install-'));
const nonGitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-health-nongit-'));
fs.writeFileSync(path.join(root, '.gitignore'), 'node_modules/\n');
for (const source of expectedInstallSources()) {
  const entry = manifestEntry(source, installRoot);
  fs.mkdirSync(path.dirname(entry.destination), { recursive: true });
  fs.writeFileSync(entry.destination, `${entry.category}\n`);
  fs.chmodSync(entry.destination, entry.executable ? 0o755 : 0o644);
}

const before = runHealthCheck({ root, fix: false });
const fixed = runHealthCheck({ root, fix: true });
const notesCheckPath = path.join(root, '.forgeflow', project, 'ship', 'implementation-notes-check.json');
fs.mkdirSync(path.dirname(notesCheckPath), { recursive: true });
fs.writeFileSync(notesCheckPath, JSON.stringify({
  status: 'warn',
  issues: [
    { severity: 'warn', code: 'notes-empty' },
    { severity: 'fail', code: 'sensitive-content' },
  ],
}, null, 2));
const withNotesCheck = runHealthCheck({ root, fix: false });
const withNotesCheckMarkdown = renderMarkdown(withNotesCheck);
const pilotRollupPath = path.join(root, '.forgeflow', project, 'pilot-evidence-rollup.md');
fs.writeFileSync(pilotRollupPath, [
  '# Pilot Evidence Rollup',
  '',
  'Pilot count: 2',
  'Decision: fix-now',
  'Next fix layer: improve /forgeflow-health diagnostics or settings docs',
  '',
].join('\n'));
const withPilotRollup = runHealthCheck({ root, fix: false });
const withPilotRollupMarkdown = renderMarkdown(withPilotRollup);
const projectLearningsPath = path.join(root, '.forgeflow', project, 'project-learnings.md');
fs.writeFileSync(projectLearningsPath, [
  '# Project Learnings',
  '',
  'Project learnings are guidance only. Verify current findings against current code, tests, and artifacts.',
  '',
  '## Sources',
  '',
  '- Generated at: 2026-05-20T00:00:00Z',
  '',
  '## Recurring Pitfalls',
  '',
  '- Release-helper changes need matching manifest and docs updates.',
  '',
  '## Risk Areas',
  '',
  '- docs-drift: 2',
  '',
  '## Recommended Approach For Next Work',
  '',
  '- Check docs-drift risks early.',
  '',
  '## Validation Patterns',
  '',
  '- Run docs checks before release checks.',
  '',
  '## Hot Files And Modules',
  '',
  '- scripts/forgeflow/health-check.js',
  '',
  '## Stable Decisions',
  '',
  '- Keep health insight summaries compact.',
  '',
  '## Repeated Follow-ups',
  '',
  '- Re-run project-learning checks after insight changes.',
  '',
].join('\n'));
const withProjectLearnings = runHealthCheck({ root, fix: false });
const withProjectLearningsMarkdown = renderMarkdown(withProjectLearnings);
fs.writeFileSync(projectLearningsPath, [
  '# Project Learnings',
  '',
  '## Recurring Pitfalls',
  '',
  '- token: SHOULD_NOT_PRINT',
  '',
].join('\n'));
const withBadProjectLearnings = runHealthCheck({ root, fix: false });
const withBadProjectLearningsMarkdown = renderMarkdown(withBadProjectLearnings);
const latestInsightsReportPath = path.join(root, '.forgeflow', project, 'context', 'latest', 'latest-insights-report.json');
fs.mkdirSync(path.dirname(latestInsightsReportPath), { recursive: true });
fs.writeFileSync(latestInsightsReportPath, JSON.stringify({
  schema_version: '1',
  status: 'injected',
  reason: 'quality-check-passing',
  generated_at: '2026-05-20T00:00:00.000Z',
  git: {
    available: false,
    commit_short: '',
    dirty: true,
  },
  check_status: 'pass',
  issue_count: 0,
}, null, 2));
const withInsightsReadiness = runHealthCheck({ root, fix: false });
const withInsightsReadinessMarkdown = renderMarkdown(withInsightsReadiness);
const failureDigestPath = path.join(root, '.forgeflow', project, 'context', 'latest', 'failure-digest.md');
fs.writeFileSync(failureDigestPath, [
  '# Forgeflow Failure Digest',
  '',
  'Generated at: 2026-05-20T00:01:00Z',
  'Git available: no',
  'Git commit: (unknown)',
  'Git dirty: yes',
  'Mode: failed-test',
  'Status: compact',
  'Raw required: no',
  'Reason: health fixture failure summarized',
  'Input lines: 20',
  'Output lines: 4',
  'Omitted lines: 16',
  '',
  '## Evidence References',
  '- src/bad.test.ts:12',
  '',
  '## Compact Output',
  '```text',
  'FAIL health fixture',
  '```',
  '',
].join('\n'));
const withFailureDigest = runHealthCheck({ root, fix: false });
const withFailureDigestMarkdown = renderMarkdown(withFailureDigest);
fs.writeFileSync(latestInsightsReportPath, JSON.stringify({
  schema_version: '1',
  status: 'injected',
  reason: 'quality-check-passing',
  generated_at: '2026-05-20T00:00:00.000Z',
  git: {
    available: true,
    commit_short: 'stale',
    dirty: false,
  },
  check_status: 'pass',
  issue_count: 0,
}, null, 2));
const withStaleInsights = runHealthCheck({ root, fix: false });
const withStaleInsightsMarkdown = renderMarkdown(withStaleInsights);
fs.writeFileSync(latestInsightsReportPath, JSON.stringify({
  schema_version: '1',
  status: 'blocked',
  reason: 'quality-check-not-passing',
  generated_at: '2026-05-20T00:00:00.000Z',
  git: {
    available: false,
    commit_short: '',
    dirty: true,
  },
  check_status: 'fail',
  issue_count: 1,
}, null, 2));
const withBlockedInsights = runHealthCheck({ root, fix: false });
const withBlockedInsightsMarkdown = renderMarkdown(withBlockedInsights);
const customInsightsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-health-custom-root-'));
spawnSync('git', ['init'], { cwd: customInsightsRoot, encoding: 'utf8' });
fs.writeFileSync(path.join(customInsightsRoot, 'README.md'), '# Custom\n');
spawnSync('git', ['add', 'README.md'], { cwd: customInsightsRoot, encoding: 'utf8' });
spawnSync('git', ['commit', '-m', 'init'], { cwd: customInsightsRoot, encoding: 'utf8' });
const customProjectDir = path.join(root, '.forgeflow', 'CustomExternal');
const customLatestDir = path.join(customProjectDir, 'context', 'latest');
fs.mkdirSync(customLatestDir, { recursive: true });
fs.writeFileSync(path.join(customLatestDir, 'latest-insights-report.json'), JSON.stringify({
  schema_version: '1',
  status: 'injected',
  reason: 'quality-check-passing',
  generated_at: '2026-05-20T00:00:00.000Z',
  git: {
    available: true,
    commit_short: 'stale',
    dirty: false,
  },
  check_status: 'pass',
  issue_count: 0,
}, null, 2));
const customInsights = runHealthCheck({ root: customInsightsRoot, projectDir: customProjectDir, fix: false });
const again = runHealthCheck({ root, fix: true });
const installed = runHealthCheck({ root, installRoot, fix: false });
fs.unlinkSync(manifestEntry('scripts/forgeflow/health-check.js', installRoot).destination);
const missingInstalled = runHealthCheck({ root, installRoot, fix: false });
fs.writeFileSync(manifestEntry('scripts/forgeflow/health-check.js', installRoot).destination, 'helper\n');
fs.chmodSync(manifestEntry('scripts/forgeflow/health-check.js', installRoot).destination, 0o755);
const symlinkInstalledTarget = path.join(installRoot, 'outside-health-check.js');
fs.writeFileSync(symlinkInstalledTarget, 'helper\n');
fs.chmodSync(symlinkInstalledTarget, 0o755);
fs.unlinkSync(manifestEntry('scripts/forgeflow/health-check.js', installRoot).destination);
fs.symlinkSync(symlinkInstalledTarget, manifestEntry('scripts/forgeflow/health-check.js', installRoot).destination);
const symlinkInstalled = runHealthCheck({ root, installRoot, fix: false });
fs.unlinkSync(manifestEntry('scripts/forgeflow/health-check.js', installRoot).destination);
fs.writeFileSync(manifestEntry('scripts/forgeflow/health-check.js', installRoot).destination, 'helper\n');
fs.chmodSync(manifestEntry('scripts/forgeflow/health-check.js', installRoot).destination, 0o755);
fs.unlinkSync(manifestEntry('templates/ship-presentation.html', installRoot).destination);
const missingTemplate = runHealthCheck({ root, installRoot, fix: false });
const nonGit = runHealthCheck({ root: nonGitRoot, fix: true });
const verbose = spawnSync(process.execPath, [path.join(__dirname, 'health-check.js'), '--root', root, '--verbose'], { encoding: 'utf8' });
const symlinkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-health-symlink-'));
spawnSync('git', ['init'], { cwd: symlinkRoot, encoding: 'utf8' });
let symlinkGitignoreCheck = { status: 'skip' };
let symlinkGitignoreState = { safe: true };
try {
  fs.writeFileSync(path.join(symlinkRoot, 'target-gitignore'), 'node_modules/\n');
  fs.symlinkSync(path.join(symlinkRoot, 'target-gitignore'), path.join(symlinkRoot, '.gitignore'));
  symlinkGitignoreState = gitignoreState(symlinkRoot);
  symlinkGitignoreCheck = runHealthCheck({ root: symlinkRoot, fix: true }).checks.find((item) => item.name === 'gitignore .forgeflow/');
} catch (_err) {
  symlinkGitignoreCheck = { status: 'skip' };
}
const symlinkProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-health-project-symlink-'));
spawnSync('git', ['init'], { cwd: symlinkProjectRoot, encoding: 'utf8' });
const symlinkProjectTarget = path.join(symlinkProjectRoot, 'outside-project-target');
const symlinkProjectDir = path.join(symlinkProjectRoot, '.forgeflow', 'SymlinkProject');
fs.mkdirSync(path.dirname(symlinkProjectDir), { recursive: true });
fs.mkdirSync(symlinkProjectTarget, { recursive: true });
fs.symlinkSync(symlinkProjectTarget, symlinkProjectDir);
let symlinkProjectHealthBlocked = false;
try {
  runHealthCheck({ root: symlinkProjectRoot, projectDir: symlinkProjectDir, fix: true });
} catch (err) {
  symlinkProjectHealthBlocked = err.message.includes('symlinked directory');
}

const checks = [
  ['before fails', before.status === 'fail'],
  ['fixed passes', fixed.status === 'pass'],
  ['forgeflow dir created', fs.existsSync(path.join(root, '.forgeflow', project))],
  ['agent notes created', fs.existsSync(path.join(root, '.forgeflow', project, 'agent-notes'))],
  ['gitignore updated', fs.readFileSync(path.join(root, '.gitignore'), 'utf8').includes('.forgeflow/')],
  ['budget seeded', fs.existsSync(path.join(root, '.forgeflow-budget.json'))],
  ['latest notes check summarized', withNotesCheck.latest_notes_check.status === 'warn' && withNotesCheck.latest_notes_check.issues === 2],
  ['latest notes check counts failures', withNotesCheck.latest_notes_check.failures === 1 && withNotesCheck.latest_notes_check.warnings === 1],
  ['latest notes check renders', withNotesCheckMarkdown.includes('## Latest Implementation Notes Check') && withNotesCheckMarkdown.includes('Status: warn')],
  ['latest pilot rollup summarized', withPilotRollup.latest_pilot_rollup.pilot_count === 2 && withPilotRollup.latest_pilot_rollup.decision === 'fix-now'],
  ['latest pilot rollup renders', withPilotRollupMarkdown.includes('## Latest Pilot Evidence Rollup') && withPilotRollupMarkdown.includes('Decision: fix-now')],
  ['latest project learnings summarized', withProjectLearnings.latest_project_learnings.recurring_pitfalls === 1 && withProjectLearnings.latest_project_learnings.risk_areas === 1],
  ['latest project learnings check passes', withProjectLearnings.latest_project_learnings_check.status === 'pass'],
  ['latest project learnings renders', withProjectLearningsMarkdown.includes('## Latest Insights') && withProjectLearningsMarkdown.includes('Check docs-drift risks early.')],
  ['latest insights includes command', withProjectLearningsMarkdown.includes('Refresh/view: forgeflow-learnings --project')],
  ['latest insights includes validation and hot file', withProjectLearningsMarkdown.includes('Run docs checks before release checks.') && withProjectLearningsMarkdown.includes('scripts/forgeflow/health-check.js')],
  ['bad project learnings check summarized', withBadProjectLearnings.latest_project_learnings_check.status === 'fail' && withBadProjectLearningsMarkdown.includes('## Latest Project Learnings Check')],
  ['bad project learnings recommends check', withBadProjectLearnings.recommendations.some((item) => item.command === 'forgeflow-learnings --project --check')],
  ['latest insights readiness summarized', withInsightsReadiness.latest_insights_readiness.status === 'injected' && withInsightsReadiness.latest_insights_readiness.check_status === 'pass' && withInsightsReadiness.latest_insights_readiness.freshness.status === 'current'],
  ['latest insights readiness renders', withInsightsReadinessMarkdown.includes('## Latest Insights Readiness') && withInsightsReadinessMarkdown.includes('Status: injected') && withInsightsReadinessMarkdown.includes('Freshness: current')],
  ['latest failure digest summarized', withFailureDigest.latest_failure_digest.status === 'compact' && withFailureDigest.latest_failure_digest.freshness.status === 'current'],
  ['latest failure digest triage summarized', withFailureDigest.latest_failure_digest.triage.state === 'usable' && withFailureDigest.latest_failure_digest.triage.confidence === 'high'],
  ['latest failure digest renders', withFailureDigestMarkdown.includes('## Latest Failure Digest') && withFailureDigestMarkdown.includes('Freshness: current') && withFailureDigestMarkdown.includes('Triage state: usable')],
  ['stale latest insights recommends refresh', withStaleInsights.recommendations.some((item) => item.command === 'forgeflow-trends --refresh') && withStaleInsightsMarkdown.includes('## Recommendations') && withStaleInsightsMarkdown.includes('Evidence:') && withStaleInsightsMarkdown.includes('Clears:')],
  ['blocked latest insights recommends check', withBlockedInsights.recommendations.some((item) => item.command === 'forgeflow-learnings --project --check') && withBlockedInsightsMarkdown.includes('forgeflow-learnings --project --check') && withBlockedInsightsMarkdown.includes('Latest-insights readiness is blocked')],
  ['custom project dir uses health root for insights freshness', customInsights.latest_insights_readiness.freshness.current_commit !== '' && customInsights.latest_insights_readiness.freshness.issues.some((item) => item.code === 'latest-insights-commit-stale')],
  ['idempotent no changes', again.changes.length === 0],
  ['installed runtime passes', installed.status === 'pass'],
  ['missing runtime fails', missingInstalled.status === 'fail'],
  ['symlink runtime fails', symlinkInstalled.status === 'fail'],
  ['runtime check included', installed.checks.some((item) => item.name === 'runtime helper health-check.js')],
  ['template check included', installed.checks.some((item) => item.name === 'template ship-presentation.html')],
  ['agent install check included', installed.checks.some((item) => item.name === 'agent agents/compass-plan.md')],
  ['hook install check included', installed.checks.some((item) => item.name === 'hook forgeflow-gate.js')],
  ['missing template fails', missingTemplate.status === 'fail'],
  ['non git passes with skip', nonGit.status === 'pass'],
  ['non git project check skipped', nonGit.checks.some((item) => item.status === 'skip' && item.name === 'project-local .forgeflow/')],
  ['non git fix does not create forgeflow', !fs.existsSync(path.join(nonGitRoot, '.forgeflow'))],
  ['skip renders next step', renderMarkdown(nonGit).includes('next: cd into a git project')],
  ['verbose accepted by cli', verbose.status === 0],
  ['symlink gitignore unsafe', symlinkGitignoreCheck.status === 'skip' || (symlinkGitignoreState.safe === false && symlinkGitignoreCheck.status === 'fail')],
  ['symlink project dir blocked', symlinkProjectHealthBlocked],
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
