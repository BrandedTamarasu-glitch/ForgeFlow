#!/usr/bin/env node
const {
  buildPilotScript,
  parseArgs,
  projectDirSegment,
  renderMarkdown,
} = require('./render-pilot-script');

const codex = buildPilotScript({ runtime: 'codex', projectName: 'Demo' });
const claude = buildPilotScript({ runtime: 'claude-code', projectName: 'Demo' });
const newUser = buildPilotScript({ runtime: 'codex', projectName: 'Demo', path: 'new-user' });
const markdown = renderMarkdown(codex);
const newUserMarkdown = renderMarkdown(newUser);
const newUserCliJson = buildPilotScript(parseArgs([
  '--path',
  'new-user',
  '--runtime',
  'codex',
  '--project-name',
  'Demo',
  '--json',
]));
const traversalName = buildPilotScript({ runtime: 'codex', projectName: '../../tmp/loot' });
const projectLearningsCommands = newUser.steps
  .flatMap((step) => step.commands)
  .filter((command) => command.includes('show-project-learnings.js'));
const evidenceCommands = newUser.steps
  .flatMap((step) => step.commands)
  .filter((command) => command.includes('record-pilot-evidence.js'));
const finalDecisionStep = newUser.steps.find((step) => step.name === 'Decide whether to keep using Forgeflow') || { evidence: '' };

const checks = [
  ['schema version', codex.schema_version === '1'],
  ['defaults to maintainer path', codex.path === 'maintainer'],
  ['has four phases', codex.steps.length === 4],
  ['includes smoke helper', codex.steps.some((step) => step.commands.some((command) => command.includes('smoke-check.js')))],
  ['includes claude smoke command', claude.steps.some((step) => step.commands.includes('/forgeflow-smoke'))],
  ['includes evidence recorder', codex.steps.some((step) => step.commands.some((command) => command.includes('record-pilot-evidence.js')))],
  ['includes rollup helper', codex.steps.some((step) => step.commands.some((command) => command.includes('rollup-pilot-evidence.js')))],
  ['template has adoption decision', Object.prototype.hasOwnProperty.call(codex.public_safe_template, 'adoption_decision')],
  ['markdown renders public template', markdown.includes('# Forgeflow Maintainer Pilot Script') && markdown.includes('```yaml')],
  ['new-user path selected', newUser.path === 'new-user'],
  ['new-user has four phases', newUser.steps.length === 4],
  ['new-user includes readiness smoke', newUser.steps[0].commands.some((command) => command.includes('smoke'))],
  ['new-user includes repair and release readiness', newUser.steps[0].commands.some((command) => command.includes('render-guided-repair.js')) && newUser.steps[0].commands.some((command) => command.includes('render-release-readiness.js --plan-only --json'))],
  ['new-user includes project guidance checks', newUser.steps.some((step) => step.commands.some((command) => command.includes('show-project-trends.js'))) && newUser.steps.some((step) => step.commands.some((command) => command.includes('show-code-map.js'))) && newUser.steps.some((step) => step.commands.some((command) => command.includes('show-project-learnings.js'))) && newUser.steps.some((step) => step.commands.some((command) => command.includes('build-project-intelligence.js'))) && newUser.steps.some((step) => step.commands.some((command) => command.includes('rollup-agent-feedback.js')))],
  ['new-user evidence is state aware', newUser.steps.some((step) => step.evidence.includes('living project-map categories')) && finalDecisionStep.evidence.includes('project-intelligence readiness') && finalDecisionStep.evidence.includes('living project-map status') && finalDecisionStep.evidence.includes('agent-feedback signal') && Object.prototype.hasOwnProperty.call(newUser.public_safe_template, 'project_intelligence_readiness') && Object.prototype.hasOwnProperty.call(newUser.public_safe_template, 'living_project_map_status') && Object.prototype.hasOwnProperty.call(newUser.public_safe_template, 'agent_feedback_signal')],
  ['new-user project learnings command uses supported flags', projectLearningsCommands.length === 1 && projectLearningsCommands[0].includes('--check') && projectLearningsCommands[0].includes('--json') && !projectLearningsCommands[0].includes('--project ')],
  ['new-user evidence command remains executable example', evidenceCommands.length === 1 && evidenceCommands[0].includes('--adoption-decision repeat-pilot') && !/[<>|]/.test(evidenceCommands[0])],
  ['new-user evidence text tells user to choose decision', newUser.steps.some((step) => step.evidence.includes('choose repeat-pilot, expand-small-team, stop-and-fix, or defer'))],
  ['new-user includes first work item lifecycle', newUser.steps.some((step) => step.commands.some((command) => command.includes('$discuss'))) && newUser.steps.some((step) => step.commands.some((command) => command.includes('$plan'))) && newUser.steps.some((step) => step.commands.some((command) => command.includes('$implement'))) && newUser.steps.some((step) => step.commands.some((command) => command.includes('$forge-review')))],
  ['new-user markdown title', newUserMarkdown.includes('# Forgeflow New-User Trial Script') && newUserMarkdown.includes('Path: new-user')],
  ['new-user cli renders json', newUserCliJson.path === 'new-user' && newUserCliJson.steps.length === 4],
  ['project dir segment blocks traversal', traversalName.project_name === '../../tmp/loot' && traversalName.project_dir === '.forgeflow/.-.-tmp-loot' && projectDirSegment('GitLab CI') === 'GitLab CI'],
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

console.log('pilot script: ok');
