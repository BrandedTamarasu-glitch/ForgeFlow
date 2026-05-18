#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  buildRollup,
  parseFlatYaml,
  rollupPilotEvidence,
  splitCategories,
} = require('./rollup-pilot-evidence');

const repoRoot = path.resolve(__dirname, '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-pilot-rollup-'));
const projectDir = path.join(tmp, '.forgeflow', 'Demo');
const evidenceDir = path.join(projectDir, 'pilot-evidence');
fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, 'one.yml'), [
  'pilot_id: one',
  'runtime: codex',
  'project_type: docs-config',
  'health_result: pass',
  'adoption_decision: repeat-pilot',
  'confirmed_findings: 2',
  'rejected_findings: 1',
  'deferred_findings: 0',
  'review_minutes: 12',
  'support_categories: docs health',
  '',
].join('\n'));
fs.writeFileSync(path.join(evidenceDir, 'two.yml'), [
  'pilot_id: two',
  'runtime: claude-code',
  'project_type: api',
  'health_result: fail',
  'adoption_decision: stop-and-fix',
  'confirmed_findings: 1',
  'rejected_findings: 0',
  'deferred_findings: 1',
  'review_minutes: 20',
  'support_categories: health,settings',
  '',
].join('\n'));

const out = path.join(projectDir, 'pilot-evidence-rollup.md');
const result = rollupPilotEvidence({ projectDir, out });
const rendered = fs.readFileSync(out, 'utf8');
const empty = rollupPilotEvidence({ projectDir: path.join(tmp, '.forgeflow', 'Empty') });
const parsed = parseFlatYaml('runtime: codex\nnext_action: "Contains # marker"\n');
const manual = buildRollup([
  { runtime: 'codex', support_categories: 'docs health', adoption_decision: 'repeat-pilot' },
  { runtime: 'codex', support_categories: 'health', adoption_decision: 'repeat-pilot' },
], []);
const cliJson = spawnSync(path.join(repoRoot, 'scripts/forgeflow/rollup-pilot-evidence.js'), [
  '--project-dir',
  projectDir,
  '--json',
], { encoding: 'utf8' });
const missingValue = spawnSync(path.join(repoRoot, 'scripts/forgeflow/rollup-pilot-evidence.js'), [
  '--project-dir',
], { encoding: 'utf8' });
const cliResult = cliJson.status === 0 ? JSON.parse(cliJson.stdout) : {};

const checks = [
  ['rolls up pilot count', result.pilot_count === 2],
  ['counts runtimes', result.runtimes.codex === 1 && result.runtimes['claude-code'] === 1],
  ['counts repeated support category', result.support_categories.health === 2 && result.repeat_issue_count === 1],
  ['sums findings and minutes', result.findings.confirmed === 3 && result.findings.rejected === 1 && result.review_minutes === 32],
  ['recommends fix now for blocker', result.decision === 'fix-now'],
  ['maps next fix layer', result.next_fix_layer.includes('/forgeflow-health')],
  ['writes markdown rollup', rendered.includes('# Pilot Evidence Rollup') && rendered.includes('- health: 2')],
  ['empty evidence is safe', empty.pilot_count === 0 && empty.decision === 'run-another-pilot'],
  ['parses quoted scalar', parsed.next_action === 'Contains # marker'],
  ['splits category strings', splitCategories('docs, health settings').length === 3],
  ['manual repeated issue counts', manual.repeat_issue_count === 1],
  ['cli emits json', cliJson.status === 0 && cliResult.pilot_count === 2],
  ['missing option value exits usage', missingValue.status === 2 && missingValue.stderr.includes('Missing value for --project-dir')],
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

console.log('pilot evidence rollup: ok');
