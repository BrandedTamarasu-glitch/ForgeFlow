#!/usr/bin/env node
const { buildFirstRunGuide, parseArgs, renderMarkdown } = require('./render-first-run-guide');
const { normalizeEntry } = require('./user-profile');

const codex = buildFirstRunGuide({ runtime: 'codex', projectName: 'Demo' });
const claude = buildFirstRunGuide({ runtime: 'claude-code', projectName: 'Demo' });
const markdown = renderMarkdown(codex);
const parsed = parseArgs(['--runtime', 'claude-code', '--project-name', 'Demo', '--json']);
const recordExample = codex.steps
  .flatMap((step) => step.commands)
  .find((command) => command.includes('record-user-profile.js --scope global'));
const preferenceMatch = recordExample.match(/--preference "([^"]+)"/);

let invalidRuntime = false;
try {
  parseArgs(['--runtime', 'terminal']);
} catch (err) {
  invalidRuntime = err.message.includes('Invalid --runtime');
}
let missingProjectName = false;
try {
  parseArgs(['--project-name', '--json']);
} catch (err) {
  missingProjectName = err.message.includes('Missing value');
}

const checks = [
  ['codex schema', codex.schema_version === '1' && codex.runtime === 'codex'],
  ['codex steps', codex.steps.length === 4 && codex.steps[0].commands.includes('scripts/forgeflow/health-check.js --json') && codex.steps[0].commands.includes('scripts/forgeflow/smoke-check.js --json')],
  ['codex includes profile check', codex.steps.some((step) => step.commands.some((command) => command.includes('check-user-profile.js')))],
  ['codex includes record example', codex.steps.some((step) => step.commands.some((command) => command.includes('record-user-profile.js --scope global')))],
  ['record example is valid preference', normalizeEntry({ scope: 'global', category: 'communication', preference: preferenceMatch && preferenceMatch[1] }).preference.includes('validation status')],
  ['claude slash commands', claude.steps[0].commands.includes('/forgeflow-health') && claude.steps.some((step) => step.commands.includes('/forgeflow-profile --check'))],
  ['stop conditions protect safety', codex.stop_conditions.some((item) => item.includes('security')) && codex.stop_conditions.some((item) => item.includes('too broad'))],
  ['markdown renders guide', markdown.includes('# Forgeflow First-Run Guide') && markdown.includes('## Stop Conditions')],
  ['args parse', parsed.runtime === 'claude-code' && parsed.projectName === 'Demo' && parsed.json === true],
  ['invalid runtime rejected', invalidRuntime],
  ['missing project name rejected', missingProjectName],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('first run guide: ok');
