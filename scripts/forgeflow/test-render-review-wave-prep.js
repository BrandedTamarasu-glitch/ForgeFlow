#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildReviewWavePrep, parseArgs, renderMarkdown } = require('./render-review-wave-prep');

function makeContext(tokens) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-review-wave-prep-'));
  const contextDir = path.join(root, '.forgeflow', path.basename(root), 'context', 'latest');
  fs.mkdirSync(contextDir, { recursive: true });
  fs.writeFileSync(path.join(contextDir, 'file-manifest.json'), JSON.stringify({
    files: [
      { path: 'src/auth.ts', kind: 'security', size_bytes: 1200 },
      { path: 'src/service.ts', kind: 'service', size_bytes: 1200 },
      { path: 'docs/readme.md', kind: 'docs', size_bytes: 1200 },
    ],
  }));
  fs.writeFileSync(path.join(contextDir, 'context-telemetry.json'), JSON.stringify({ estimated_compact_tokens: tokens }));
  fs.writeFileSync(path.join(contextDir, 'synthesis-input.json'), JSON.stringify({ agent_packets: { smith: 'smith.md' } }));
  return { root, contextDir };
}

const over = makeContext(24000);
const split = buildReviewWavePrep({ root: over.root, contextDir: over.contextDir, targetTokens: 8000, writeWaveFiles: true });
const markdown = renderMarkdown(split);
const under = makeContext(4000);
const ok = buildReviewWavePrep({ root: under.root, contextDir: under.contextDir, targetTokens: 8000 });
const opts = parseArgs(['--root', over.root, '--context-dir', over.contextDir, '--target-tokens', '8000', '--write-wave-files', '--json']);

const checks = [
  ['splits before review', split.status === 'split-before-review' && split.next.includes('risk-core-files.txt')],
  ['writes wave file', fs.existsSync(path.join(over.contextDir, 'waves', 'risk-core-files.txt'))],
  ['under budget ok', ok.status === 'current-packet-ok' && ok.next.includes('current context pack')],
  ['renders boundary', markdown.includes('does not rebuild packets')],
  ['parses args', opts.writeWaveFiles === true && opts.json === true && opts.targetTokens === 8000],
];

let failed = 0;
for (const [name, okValue] of checks) {
  if (!okValue) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('review wave prep: ok');
