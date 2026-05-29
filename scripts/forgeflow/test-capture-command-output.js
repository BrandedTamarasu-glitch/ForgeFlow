#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { captureCommandOutput, parseArgs, renderMarkdown } = require('./capture-command-output');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-capture-command-output-'));
const out = path.join(root, 'failure-digest.md');
const input = 'PASS a.test.ts\nFAIL b.test.ts\nExpected true\nReceived false\n';
const result = captureCommandOutput(input, { mode: 'test', command: 'vitest', out, root: process.cwd() });
const raw = captureCommandOutput('diff --git a/a b/a\n+change\n', { mode: 'test', command: 'git diff', root: process.cwd() });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--mode', 'test', '--command', 'vitest', '--out', out, '--json']);

const checks = [
  ['captures compact output', result.status === 'captured' && result.omitted_lines > 0],
  ['writes digest', result.digest_written === true && fs.existsSync(out) && fs.readFileSync(out, 'utf8').includes('# Forgeflow Failure Digest')],
  ['preserves raw unsafe output', raw.status === 'raw-preserved' && raw.raw_required === true],
  ['renders boundary', markdown.includes('does not execute commands')],
  ['parses args', opts.mode === 'test' && opts.command === 'vitest' && opts.out === out && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('command output capture: ok');
