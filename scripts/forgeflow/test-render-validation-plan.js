#!/usr/bin/env node
const { buildValidationPlan, parseArgs, renderMarkdown } = require('./render-validation-plan');

const result = buildValidationPlan({
  root: process.cwd(),
  files: [
    'scripts/forgeflow/build-context-pack.js',
    'commands/forgeflow-health.md',
    'README.md',
  ],
});
const docsOnly = buildValidationPlan({ root: process.cwd(), files: ['docs/wiki/User-Paths.md'] });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', '.', '--json']);

const checks = [
  ['includes direct script test', result.commands.includes('node scripts/forgeflow/test-build-context-pack.js')],
  ['includes command coverage', result.commands.includes('node scripts/forgeflow/test-command-coverage.js')],
  ['requires full suite for core helper', result.full_suite_required === true],
  ['includes failure capture plans', result.failure_capture_commands.some((item) => item.command === 'node scripts/forgeflow/test-build-context-pack.js' && item.next.includes('forgeflow-capture-output') && item.recorder_prompt.includes('Do not rerun'))],
  ['docs only avoids full suite', docsOnly.full_suite_required === false && docsOnly.commands.includes('node scripts/forgeflow/test-doc-links.js')],
  ['renders markdown', markdown.includes('# Forgeflow Validation Plan') && markdown.includes('## If A Command Fails')],
  ['parses args', opts.root === process.cwd() && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('validation plan: ok');
