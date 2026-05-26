#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildRollup,
  parseArgs,
  parseFlatYaml,
  publicSafeCounts,
  rollupPilotEvidence,
  splitCategories,
} = require('./rollup-pilot-evidence');

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
  'project_intelligence_readiness: ready',
  'living_project_map_status: useful',
  'agent_feedback_signal: positive',
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
  'project_intelligence_readiness: needs-triage',
  'living_project_map_status: missing',
  'agent_feedback_signal: unclear',
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
const stateIssueRollup = buildRollup([
  {
    runtime: 'codex',
    support_categories: 'docs',
    adoption_decision: 'repeat-pilot',
    project_intelligence_readiness: 'blocked',
    living_project_map_status: 'useful',
    agent_feedback_signal: 'positive',
  },
], []);
const cliResult = rollupPilotEvidence(parseArgs([
  '--project-dir',
  projectDir,
  '--json',
], { exitOnError: false }));
let missingValue = { status: 0, stderr: '' };
try {
  parseArgs(['--project-dir'], { exitOnError: false });
} catch (err) {
  missingValue = { status: err.exitCode || 1, stderr: err.message };
}

const checks = [
  ['rolls up pilot count', result.pilot_count === 2],
  ['counts runtimes', result.runtimes.codex === 1 && result.runtimes['claude-code'] === 1],
  ['counts repeated support category', result.support_categories.health === 2 && result.repeat_issue_count === 1],
  ['sums findings and minutes', result.findings.confirmed === 3 && result.findings.rejected === 1 && result.review_minutes === 32],
  ['recommends fix now for blocker', result.decision === 'fix-now'],
  ['state signals are decision relevant', stateIssueRollup.decision === 'fix-now' && stateIssueRollup.decision_explanation.project_intelligence === 'attention'],
  ['explains adoption decision', result.decision_explanation.setup_friction === 'attention' && result.decision_explanation.project_intelligence === 'attention' && result.decision_explanation.living_project_map === 'attention' && result.decision_explanation.agent_feedback === 'attention'],
  ['rolls up readiness signals', result.project_intelligence_readiness.ready === 1 && result.project_intelligence_readiness['needs-triage'] === 1 && result.living_project_map_status.missing === 1 && result.agent_feedback_signal.unclear === 1],
  ['maps next fix layer', result.next_fix_layer.includes('/forgeflow-health')],
  ['writes markdown rollup', rendered.includes('# Pilot Evidence Rollup') && rendered.includes('- health: 2')],
  ['markdown support categories are public safe', publicSafeCounts({ 'example.internal/team': 1 })['unclassified-support-category'] === 1 && !rendered.includes('example.internal')],
  ['markdown includes summary metrics', rendered.includes('Blocked first reviews: 1') && rendered.includes('Findings: 3 confirmed, 1 rejected, 1 deferred')],
  ['markdown includes decision explanation and readiness signals', rendered.includes('Decision explanation:') && rendered.includes('Project intelligence: attention') && rendered.includes('## Readiness Signals') && rendered.includes('- needs-triage: 1') && rendered.includes('- missing: 1') && rendered.includes('- unclear: 1')],
  ['markdown includes health and runtime counts', rendered.includes('## Health Results') && rendered.includes('- codex: 1')],
  ['empty evidence is safe', empty.pilot_count === 0 && empty.decision === 'run-another-pilot'],
  ['parses quoted scalar', parsed.next_action === 'Contains # marker'],
  ['splits category strings', splitCategories('docs, health settings').length === 3],
  ['manual repeated issue counts', manual.repeat_issue_count === 1],
  ['cli emits json', cliResult.pilot_count === 2],
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
