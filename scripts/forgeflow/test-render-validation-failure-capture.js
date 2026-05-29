#!/usr/bin/env node
const path = require('path');
const { buildValidationFailureCapture, modeForCommand, parseArgs, renderMarkdown } = require('./render-validation-failure-capture');

const root = path.resolve(__dirname, '..', '..');
const test = buildValidationFailureCapture({ root, command: 'pnpm test' });
const forgeflowTest = modeForCommand('node scripts/forgeflow/test-render-validation-plan.js');
const forgeflowFullSuite = modeForCommand('for test_file in scripts/forgeflow/test-*.js; do node "$test_file" || exit 1; done');
const sourceSmoke = modeForCommand('node scripts/forgeflow/smoke-check.js --mode source --json');
const typecheck = modeForCommand('npm run typecheck');
const lint = modeForCommand('eslint src');
const build = modeForCommand('npm run build');
const logs = modeForCommand('docker logs app');
const raw = buildValidationFailureCapture({ root, command: 'git diff --name-only' });
const markdown = renderMarkdown(test);
const opts = parseArgs(['--root', root, '--args', '--command "npm run build" --json']);

const checks = [
  ['maps test', test.status === 'capture-ready' && test.mode === 'test' && test.capture_command.includes('--mode test')],
  ['quotes digest output path', test.capture_command.includes("--out '.forgeflow/Forgeflow/context/latest/failure-digest.md'")],
  ['adds first-run prompt', test.first_run_action.status === 'ready' && test.recorder_prompt.includes('Do not rerun')],
  ['maps forgeflow helper tests', forgeflowTest.mode === 'test'],
  ['maps forgeflow full suite loop', forgeflowFullSuite.mode === 'test'],
  ['maps source smoke', sourceSmoke.mode === 'test'],
  ['maps typecheck', typecheck.mode === 'typecheck'],
  ['maps lint', lint.mode === 'lint'],
  ['maps build', build.mode === 'build'],
  ['maps logs', logs.mode === 'logs'],
  ['keeps exact output raw', raw.status === 'raw-required' && raw.next.includes('raw')],
  ['renders boundary', markdown.includes('does not execute') && markdown.includes('Capture note:')],
  ['parses quoted raw args', opts.command === 'npm run build' && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('validation failure capture: ok');
