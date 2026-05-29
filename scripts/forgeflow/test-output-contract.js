#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildOutputContract, parseArgs, renderMarkdown } = require('./output-contract');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-output-contract-'));
const projectDir = path.join(root, '.forgeflow', path.basename(root));
fs.mkdirSync(projectDir, { recursive: true });
fs.writeFileSync(path.join(root, 'forgeflow-version'), `${'b'.repeat(40)}\n`);
const result = buildOutputContract({ root, projectDir, home: root });
const defaultHome = buildOutputContract({ root, projectDir });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--home', root, '--json']);

const checks = [
  ['passes representative helpers', result.status === 'pass' && result.checked_count >= 4],
  ['defaults home to claude install root', defaultHome.status === 'pass' && defaultHome.root === root],
  ['renders markdown', markdown.includes('# Forgeflow Output Contract') && markdown.includes('Why:')],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.home === root && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('output contract: ok');
