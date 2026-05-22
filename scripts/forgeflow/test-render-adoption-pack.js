#!/usr/bin/env node
const {
  buildAdoptionPack,
  renderMarkdown,
} = require('./render-adoption-pack');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const pack = buildAdoptionPack({ runtime: 'codex', projectName: 'Demo' });
const maintainer = buildAdoptionPack({ runtime: 'claude-code', projectName: 'Demo', path: 'maintainer' });
const markdown = renderMarkdown(pack);
const commandDoc = fs.readFileSync(path.join(repoRoot, 'commands', 'forgeflow-adoption.md'), 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-adoption-pack-'));
const originalCwd = process.cwd();
process.chdir(tmp);
const evidenceDir = path.join(tmp, '.forgeflow', 'Demo', 'pilot-evidence');
fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, 'one.yml'), [
  'pilot_id: one',
  'runtime: codex',
  'project_type: docs-config',
  'health_result: warn',
  'adoption_decision: stop-and-fix',
  'confirmed_findings: 1',
  'rejected_findings: 2',
  'deferred_findings: 1',
  'review_minutes: 18',
  'support_categories: docs health',
  '',
].join('\n'));
const withEvidence = buildAdoptionPack({ runtime: 'codex', projectName: 'Demo' });
const withEvidenceMarkdown = renderMarkdown(withEvidence);
process.chdir(originalCwd);

const checks = [
  ['schema version', pack.schema_version === '1'],
  ['defaults to new user path', pack.path === 'new-user'],
  ['captures why', pack.thesis.includes('maintainer judgment')],
  ['includes best fit', pack.best_fit.length >= 3],
  ['includes not fit', pack.not_a_fit_yet.length >= 3],
  ['includes four trial steps', pack.first_trial.length === 4],
  ['empty evidence is explicit', pack.trial_evidence.status === 'not-recorded'],
  ['ingests existing pilot evidence', withEvidence.trial_evidence.status === 'available' && withEvidence.trial_evidence.pilot_count === 1 && withEvidence.trial_evidence.decision === 'fix-now'],
  ['renders evidence section', withEvidenceMarkdown.includes('## Existing Trial Evidence') && withEvidenceMarkdown.includes('Current rollup decision: fix-now')],
  ['includes decision rubric', Object.keys(pack.decision_rubric).includes('expand_small_team')],
  ['includes proof boundary', pack.proof_boundary.some((item) => item.includes('guidance until verified'))],
  ['includes evidence commands as placeholders', pack.follow_up_commands.some((command) => command.includes('record-pilot-evidence.js') && command.includes('<pass|warn|fail>'))],
  ['maintainer path supported', maintainer.path === 'maintainer' && maintainer.runtime === 'claude-code'],
  ['markdown renders title', markdown.includes('# Forgeflow Adoption Pack') && markdown.includes('## Decision Rubric')],
  ['json serializable', JSON.parse(JSON.stringify(pack)).project_name === 'Demo'],
  ['command avoids raw argument shell pass-through', !commandDoc.includes('render-adoption-pack.js" $ARGUMENTS') && commandDoc.includes('"${ARGS[@]}"')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('adoption pack: ok');
