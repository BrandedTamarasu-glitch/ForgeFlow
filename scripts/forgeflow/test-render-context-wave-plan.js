#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildContextWavePlan, parseArgs, renderMarkdown } = require('./render-context-wave-plan');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-wave-plan-'));
const contextDir = path.join(root, '.forgeflow', path.basename(root), 'context', 'latest');
fs.mkdirSync(contextDir, { recursive: true });
fs.writeFileSync(path.join(contextDir, 'file-manifest.json'), JSON.stringify({
  schema_version: '1',
  files: [
    { path: 'src/auth.ts', kind: 'security', size_bytes: 1200 },
    { path: 'src/service.ts', kind: 'service', size_bytes: 1200 },
    { path: 'docs/readme.md', kind: 'docs', size_bytes: 1200 },
  ],
}, null, 2));
fs.writeFileSync(path.join(contextDir, 'context-telemetry.json'), JSON.stringify({
  schema_version: '1',
  kind: 'context-pack',
  estimated_compact_tokens: 24000,
}, null, 2));
fs.writeFileSync(path.join(contextDir, 'synthesis-input.json'), JSON.stringify({ agent_packets: { smith: 'smith.md' } }, null, 2));
const result = buildContextWavePlan({ root, targetTokens: 8000 });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--context-dir', contextDir, '--target-tokens', '8000', '--json']);

const checks = [
  ['splits over budget', result.status === 'split-recommended' && result.waves.length > 1],
  ['prioritizes security first', result.waves[0].files[0] === 'src/auth.ts'],
  ['renders commands', markdown.includes('build-context-pack --files')],
  ['parses args', opts.root === root && opts.contextDir === contextDir && opts.targetTokens === 8000 && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('context wave plan: ok');
