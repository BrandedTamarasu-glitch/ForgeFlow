#!/usr/bin/env node
const { buildCommandWrapperContract, checkWrapper, helperReferences, parseArgs, renderMarkdown } = require('./command-wrapper-contract');

const passMarkdown = [
  'HELPER_DIR="${ROOT}/scripts/forgeflow"',
  'if [ ! -x "${HELPER_DIR}/helper.js" ]; then',
  '  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"',
  'fi',
  'echo "Helper missing. Run /update-forgeflow --repair."',
  'SAFE_ARGS=(--root "${ROOT}")',
  'env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/helper.js" "${SAFE_ARGS[@]}"',
].join('\n');
const failMarkdown = [
  'HELPER_DIR="${ROOT}/scripts/forgeflow"',
  'node "${HELPER_DIR}/helper.js" ${ARGUMENTS}',
].join('\n');
const pass = checkWrapper('commands/example.md', passMarkdown);
const fail = checkWrapper('commands/bad.md', failMarkdown);
const refs = helperReferences(passMarkdown);
const result = buildCommandWrapperContract({ root: process.cwd() });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', '.', '--json']);

const checks = [
  ['extracts helper refs', refs.includes('helper.js')],
  ['passes complete wrapper', pass.status === 'pass' && pass.issues.length === 0],
  ['flags incomplete wrapper', fail.status === 'attention' && fail.issues.includes('missing-installed-fallback') && fail.issues.includes('missing-safe-args')],
  ['repo wrappers produce baseline', ['pass', 'baseline'].includes(result.status) && result.wrapper_count > 10 && result.issue_count >= 0],
  ['groups issue counts', result.by_issue && Object.values(result.by_issue).reduce((sum, count) => sum + count, 0) === result.issue_count],
  ['next batch is ranked', Array.isArray(result.next_batch) && result.next_batch.length <= 5 && result.next_batch.every((item) => item.source && item.next)],
  ['renders markdown', markdown.includes('# Forgeflow Command Wrapper Contract') && markdown.includes('read-only')],
  ['renders next batch actions', result.next_batch.length === 0 || markdown.includes('  - Next: Update ')],
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
console.log('command wrapper contract: ok');
