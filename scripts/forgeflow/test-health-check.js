#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  expectedRuntimeSources,
  expectedTemplateSources,
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
].join('\n'));
const withProjectLearnings = runHealthCheck({ root, fix: false });
const withProjectLearningsMarkdown = renderMarkdown(withProjectLearnings);
const again = runHealthCheck({ root, fix: true });
const installed = runHealthCheck({ root, installRoot, fix: false });
fs.unlinkSync(manifestEntry('scripts/forgeflow/health-check.js', installRoot).destination);
const missingInstalled = runHealthCheck({ root, installRoot, fix: false });
fs.writeFileSync(manifestEntry('scripts/forgeflow/health-check.js', installRoot).destination, 'helper\n');
fs.chmodSync(manifestEntry('scripts/forgeflow/health-check.js', installRoot).destination, 0o755);
fs.unlinkSync(manifestEntry('templates/ship-presentation.html', installRoot).destination);
const missingTemplate = runHealthCheck({ root, installRoot, fix: false });
const nonGit = runHealthCheck({ root: nonGitRoot, fix: true });

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
  ['latest project learnings renders', withProjectLearningsMarkdown.includes('## Latest Project Learnings') && withProjectLearningsMarkdown.includes('Check docs-drift risks early.')],
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
