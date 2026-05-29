#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildUpdateVerify, parseArgs, renderMarkdown } = require('./render-update-verify');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-update-verify-'));
fs.mkdirSync(home, { recursive: true });
fs.writeFileSync(path.join(home, 'forgeflow-version'), `${'a'.repeat(40)}\n`);
const result = buildUpdateVerify({ home });
const rooted = buildUpdateVerify({ root: path.resolve(__dirname, '..', '..'), home });
const missing = buildUpdateVerify({ home: path.join(home, 'missing') });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', path.resolve(__dirname, '..', '..'), '--home', home, '--json']);

const checks = [
  ['reads installed version', result.installed_version === 'a'.repeat(40)],
  ['uses explicit source root', rooted.root === path.resolve(__dirname, '..', '..')],
  ['returns status', ['ready', 'restart', 'repair'].includes(result.status)],
  ['restart next remains command-like', result.status !== 'restart' || result.next === '/forgeflow-health'],
  ['missing version repairs', missing.status === 'repair' && missing.next === '/update-forgeflow --repair'],
  ['renders next reason', markdown.includes('Next:') && markdown.includes('Why:')],
  ['parses args', opts.root === path.resolve(__dirname, '..', '..') && opts.home === home && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('update verify: ok');
