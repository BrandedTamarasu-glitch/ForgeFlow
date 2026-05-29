#!/usr/bin/env node
const path = require('path');
const { buildValidationFailureCapture, modeForCommand, parseArgs, renderMarkdown } = require('./render-validation-failure-capture');

const root = path.resolve(__dirname, '..', '..');
const test = buildValidationFailureCapture({ root, command: 'pnpm test' });
const typecheck = modeForCommand('npm run typecheck');
const lint = modeForCommand('eslint src');
const build = modeForCommand('npm run build');
const logs = modeForCommand('docker logs app');
const raw = buildValidationFailureCapture({ root, command: 'git diff --name-only' });
const markdown = renderMarkdown(test);
const opts = parseArgs(['--root', root, '--args', '--command "npm run build" --json']);

const checks = [
  ['maps test', test.status === 'capture-ready' && test.mode === 'test' && test.capture_command.includes('--mode test')],
  ['maps typecheck', typecheck.mode === 'typecheck'],
  ['maps lint', lint.mode === 'lint'],
  ['maps build', build.mode === 'build'],
  ['maps logs', logs.mode === 'logs'],
  ['keeps exact output raw', raw.status === 'raw-required' && raw.next.includes('raw')],
  ['renders boundary', markdown.includes('does not execute')],
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
