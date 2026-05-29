#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildNextActionContract, isCommandOnly, parseArgs, renderMarkdown, walkNextValues } = require('./next-action-contract');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-next-action-'));
const projectDir = path.join(root, '.forgeflow', path.basename(root));
fs.mkdirSync(path.join(projectDir, 'context', 'latest'), { recursive: true });

const result = buildNextActionContract({
  root,
  projectDir,
});
const markdown = renderMarkdown(result);
const values = walkNextValues({ a: { next: '/forgeflow-health' }, b: [{ next_action: '/forgeflow-smoke' }] }, 'sample');
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--json']);

const checks = [
  ['command-only accepts slash and &&', isCommandOnly('/forgeflow-version && /forgeflow-health')],
  ['command-only rejects prose', !isCommandOnly('/update-forgeflow --repair, then rerun /forgeflow-health')],
  ['walk finds next values', values.length === 2 && values.some((item) => item.source === 'sample.a.next')],
  ['audit passes known helpers', result.status === 'pass' && result.checked_count > 0],
  ['renders markdown', markdown.includes('# Forgeflow Next Action Audit') && markdown.includes('read-only')],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('next action contract: ok');
