#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildCommandWrapperBatch, parseArgs, renderMarkdown } = require('./render-command-wrapper-batch');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-command-wrapper-batch-'));
const root = path.join(tmp, 'repo');
const commandsDir = path.join(root, 'commands');
fs.mkdirSync(commandsDir, { recursive: true });
fs.writeFileSync(path.join(commandsDir, 'bad.md'), [
  '---',
  'name: bad',
  'description: Bad wrapper',
  'allowed-tools:',
  '  - Bash',
  '---',
  '```bash',
  'HELPER_DIR="${ROOT}/scripts/forgeflow"',
  'node "${HELPER_DIR}/example.js" ${ARGUMENTS:-}',
  '```',
  '',
].join('\n'));
fs.writeFileSync(path.join(commandsDir, 'good.md'), [
  '---',
  'name: good',
  'description: Good wrapper',
  'allowed-tools:',
  '  - Bash',
  '---',
  '```bash',
  'HELPER_DIR="${ROOT}/scripts/forgeflow"',
  'SAFE_ARGS=(--json)',
  'env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/example.js" "${SAFE_ARGS[@]}"',
  '```',
  '',
].join('\n'));

const batch = buildCommandWrapperBatch({ root, limit: 1 });
const markdown = renderMarkdown(batch);
const opts = parseArgs(['--root', root, '--limit', '2', '--json']);
let invalidLimitBlocked = false;
try {
  parseArgs(['--limit', 'many']);
} catch (err) {
  invalidLimitBlocked = /Invalid --limit/.test(err.message);
}

const checks = [
  ['plans limited batch', batch.status === 'batch-planned' && batch.batch_count === 1],
  ['prioritizes wrapper source', batch.candidates[0].source === 'commands/bad.md'],
  ['reports issue count', batch.total_issue_count > 0 && batch.candidates[0].issues.length > 0],
  ['renders boundary', markdown.includes('read-only') && markdown.includes('commands/bad.md')],
  ['parses args', opts.root === root && opts.limit === 2 && opts.json === true],
  ['rejects invalid limit', invalidLimitBlocked],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('command wrapper batch: ok');
