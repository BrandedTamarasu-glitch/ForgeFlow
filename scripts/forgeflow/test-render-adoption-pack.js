#!/usr/bin/env node
const {
  adoptionNextAction,
  buildAdoptionPack,
  renderMarkdown,
} = require('./render-adoption-pack');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const pack = buildAdoptionPack({ runtime: 'codex', projectName: 'Demo' });
const maintainer = buildAdoptionPack({ runtime: 'claude-code', projectName: 'Demo', path: 'maintainer' });
const quoted = buildAdoptionPack({ runtime: 'codex', projectName: 'demo"; touch /tmp/pwned; echo "' });
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
  'notes: Review example.internal/team and raw customer notes should stay local',
  '',
].join('\n'));
fs.writeFileSync(path.join(evidenceDir, 'two.yml'), [
  'pilot_id: two',
  'runtime: codex',
  'project_type: docs-config',
  'health_result: pass',
  'adoption_decision: repeat-pilot',
  'confirmed_findings: 0',
  'rejected_findings: 0',
  'deferred_findings: 0',
  'review_minutes: 4',
  'support_categories: example.internal/team',
  '',
].join('\n'));
const withEvidence = buildAdoptionPack({ runtime: 'codex', projectName: 'Demo' });
const withEvidenceMarkdown = renderMarkdown(withEvidence);
const expandAction = adoptionNextAction({
  pilot_count: 1,
  blocked_first_review_count: 0,
  repeat_issue_count: 0,
  support_categories: {},
  adoption_decisions: { 'expand-small-team': 1 },
}, { runtime: 'codex', path: 'new-user', project_name: 'Demo' });
const repeatAction = adoptionNextAction({
  pilot_count: 2,
  blocked_first_review_count: 0,
  repeat_issue_count: 1,
  support_categories: { docs: 2 },
  adoption_decisions: { 'repeat-pilot': 2 },
  next_fix_layer: 'move the missing step closer to the start path',
}, { runtime: 'codex', path: 'new-user', project_name: 'Demo' });
const deferAction = adoptionNextAction({
  pilot_count: 1,
  blocked_first_review_count: 0,
  repeat_issue_count: 0,
  support_categories: {},
  adoption_decisions: { defer: 1 },
}, { runtime: 'claude-code', path: 'maintainer', project_name: 'Demo' });
const claudeExpandAction = adoptionNextAction({
  pilot_count: 1,
  blocked_first_review_count: 0,
  repeat_issue_count: 0,
  support_categories: {},
  adoption_decisions: { 'expand-small-team': 1 },
}, { runtime: 'claude-code', path: 'new-user', project_name: 'Demo' });
const customProjectAction = adoptionNextAction(null, { runtime: 'codex', path: 'maintainer', project_name: 'Custom Project' });
process.chdir(originalCwd);

const checks = [
  ['schema version', pack.schema_version === '1'],
  ['defaults to new user path', pack.path === 'new-user'],
  ['captures why', pack.thesis.includes('maintainer judgment')],
  ['includes best fit', pack.best_fit.length >= 3],
  ['includes not fit', pack.not_a_fit_yet.length >= 3],
  ['includes four trial steps', pack.first_trial.length === 4],
  ['empty evidence is explicit', pack.trial_evidence.status === 'not-recorded'],
  ['ingests existing pilot evidence', withEvidence.trial_evidence.status === 'available' && withEvidence.trial_evidence.pilot_count === 2 && withEvidence.trial_evidence.decision === 'fix-now'],
  ['renders evidence section', withEvidenceMarkdown.includes('## Existing Trial Evidence') && withEvidenceMarkdown.includes('Current rollup decision: fix-now')],
  ['renders public safe summary', withEvidence.public_safe_summary.sharing_level === 'public-safe' && withEvidence.public_safe_summary.pilot_count === 2 && withEvidence.public_safe_summary.decision === 'stop-and-fix' && withEvidence.public_safe_summary.confirmed_findings === 1 && withEvidence.public_safe_summary.blocker === 'docs' && pack.public_safe_summary.decision === 'repeat-pilot' && pack.public_safe_summary.recommended_action === 'run-first-trial' && !Object.prototype.hasOwnProperty.call(withEvidence.public_safe_summary, 'project_name') && withEvidenceMarkdown.includes('## Public-Safe Summary') && withEvidenceMarkdown.includes('Share aggregate counts and decisions only') && !withEvidenceMarkdown.includes('example.internal') && !withEvidenceMarkdown.includes('raw customer notes')],
  ['renders small-team handoff', pack.small_team_handoff.status === 'not-ready-yet' && pack.small_team_handoff.command.includes("--project-name 'Demo'") && maintainer.small_team_handoff.command === "/forgeflow-pilot --runtime claude-code --project-name 'Demo' --path maintainer" && expandAction.action === 'expand-small-team' && markdown.includes('## Small-Team Handoff') && markdown.includes('one or two maintainers') && markdown.includes('Record pilot evidence after each trial')],
  ['quotes project name in commands', quoted.small_team_handoff.command === "scripts/forgeflow/render-pilot-script.js --runtime codex --project-name 'demo\"; touch /tmp/pwned; echo \"' --path maintainer"],
  ['empty evidence has next action', pack.trial_evidence.next_action.action === 'run-first-trial' && markdown.includes('Recommended next action')],
  ['blocked evidence has next action', withEvidence.trial_evidence.next_action.action === 'fix-blocked-first-review' && withEvidence.trial_evidence.next_action.blocker === 'docs'],
  ['renders concrete next action', withEvidenceMarkdown.includes('- Action: fix-blocked-first-review') && withEvidenceMarkdown.includes('- Blocker: docs') && withEvidenceMarkdown.includes('- Fix layer: move the missing step closer to the start path')],
  ['expand evidence has next action', expandAction.action === 'expand-small-team' && expandAction.owner === 'team-lead' && expandAction.command.includes('render-pilot-script.js --runtime codex') && expandAction.command.includes('--path maintainer')],
  ['claude expand uses slash pilot', claudeExpandAction.command === "/forgeflow-pilot --runtime claude-code --project-name 'Demo' --path maintainer"],
  ['repeat friction keeps prose out of command', repeatAction.action === 'fix-repeated-friction' && repeatAction.command.includes('render-adoption-pack.js') && repeatAction.fix_layer.includes('missing step')],
  ['defer preserves runtime and path', deferAction.action === 'defer-rollout' && deferAction.command === "/forgeflow-adoption --runtime claude-code --project-name 'Demo' --path maintainer"],
  ['next action preserves custom project', customProjectAction.command.includes("--project-name 'Custom Project'")],
  ['includes decision rubric and template', Object.keys(pack.decision_rubric).includes('expand_small_team') && markdown.includes('## Decision Template') && pack.decision_template.decision.includes('expand-small-team')],
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
