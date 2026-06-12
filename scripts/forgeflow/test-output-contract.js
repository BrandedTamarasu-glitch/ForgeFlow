#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildOutputContract,
  parseArgs,
  renderMarkdown,
  leanOutputIssues,
  isRawRequiredText,
} = require('./output-contract');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-output-contract-'));
const projectDir = path.join(root, '.forgeflow', path.basename(root));
fs.mkdirSync(projectDir, { recursive: true });
fs.writeFileSync(path.join(root, 'forgeflow-version'), `${'b'.repeat(40)}\n`);
const leanFile = path.join(root, 'lean-handoff.md');
fs.writeFileSync(leanFile, [
  'This change starts with setup prose instead of the result.',
  '',
  '- skipped one',
  '- skipped two',
  '- skipped three',
  '- skipped four',
  '',
  Array.from({ length: 95 }, (_, i) => `word${i}`).join(' '),
].join('\n'));
const result = buildOutputContract({ root, projectDir, home: root });
const defaultHome = buildOutputContract({ root, projectDir });
const leanResult = buildOutputContract({ root, projectDir, home: root, leanFiles: [leanFile] });
const markdown = renderMarkdown(result);
const leanMarkdown = renderMarkdown(leanResult);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--home', root, '--lean-file', leanFile, '--json']);
const rawDiffIssues = leanOutputIssues('diff.patch', 'diff --git a/a b/a\n+exact\n');
const rawFailureIssues = leanOutputIssues('failure.txt', 'stderr\nAssertionError: expected true\n');

const checks = [
  ['passes representative helpers', result.status === 'pass' && result.checked_count >= 4],
  ['defaults home to claude install root', defaultHome.status === 'pass' && defaultHome.root === root],
  ['warns on lean prose budget', leanResult.status === 'warn' && leanResult.lean_checked_count === 1 && leanResult.issues.some((item) => item.code === 'lean-bullet-budget') && leanResult.issues.some((item) => item.code === 'lean-long-paragraph') && leanResult.issues.some((item) => item.code === 'lean-result-not-first')],
  ['raw-required lean text is exempt', rawDiffIssues.length === 0 && rawFailureIssues.length === 0 && isRawRequiredText('```diff\n+x\n```')],
  ['renders markdown', markdown.includes('# Forgeflow Output Contract') && markdown.includes('Why:')],
  ['renders lean warning details', leanMarkdown.includes('lean-bullet-budget') && leanMarkdown.includes('Lean files checked: 1')],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.home === root && opts.leanFiles[0] === leanFile && opts.json === true],
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
