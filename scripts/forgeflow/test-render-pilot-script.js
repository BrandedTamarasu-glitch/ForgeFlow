#!/usr/bin/env node
const {
  buildPilotScript,
  renderMarkdown,
} = require('./render-pilot-script');

const codex = buildPilotScript({ runtime: 'codex', projectName: 'Demo' });
const claude = buildPilotScript({ runtime: 'claude-code', projectName: 'Demo' });
const markdown = renderMarkdown(codex);

const checks = [
  ['schema version', codex.schema_version === '1'],
  ['has four phases', codex.steps.length === 4],
  ['includes smoke helper', codex.steps.some((step) => step.commands.some((command) => command.includes('smoke-check.js')))],
  ['includes claude smoke command', claude.steps.some((step) => step.commands.includes('/forgeflow-smoke'))],
  ['includes evidence recorder', codex.steps.some((step) => step.commands.some((command) => command.includes('record-pilot-evidence.js')))],
  ['includes rollup helper', codex.steps.some((step) => step.commands.some((command) => command.includes('rollup-pilot-evidence.js')))],
  ['template has adoption decision', Object.prototype.hasOwnProperty.call(codex.public_safe_template, 'adoption_decision')],
  ['markdown renders public template', markdown.includes('# Forgeflow Maintainer Pilot Script') && markdown.includes('```yaml')],
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
