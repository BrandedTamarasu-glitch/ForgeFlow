#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  combineStatus,
  renderMarkdown,
  smokeCheck,
} = require('./smoke-check');

const repoRoot = path.resolve(__dirname, '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-smoke-check-'));
const patternsDir = path.join(tmp, 'forgeflow-patterns');
fs.mkdirSync(patternsDir, { recursive: true });

const result = smokeCheck({
  root: repoRoot,
  patternsDir,
});
const markdown = renderMarkdown(result);

const checks = [
  ['combines pass', combineStatus([{ status: 'pass' }, { status: 'pass' }]) === 'pass'],
  ['combines warn', combineStatus([{ status: 'pass' }, { status: 'warn' }]) === 'warn'],
  ['combines fail', combineStatus([{ status: 'warn' }, { status: 'fail' }]) === 'fail'],
  ['runs without failure', result.status === 'pass' || result.status === 'warn'],
  ['includes core checks', ['health', 'trends-refresh', 'report-refresh', 'code-map', 'doc-links', 'release-version'].every((name) => result.checks.some((item) => item.name === name))],
  ['trends refresh present', result.checks.find((item) => item.name === 'trends-refresh').refresh_status === 'pass'],
  ['report refresh present', result.checks.find((item) => item.name === 'report-refresh').refresh_status === 'pass'],
  ['markdown renders table', markdown.includes('# Forgeflow Smoke Check') && markdown.includes('| Check | Status | Command | Summary |')],
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

console.log('smoke check: ok');
