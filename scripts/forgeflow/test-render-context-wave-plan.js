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
const opts = parseArgs(['--root', root, '--context-dir', contextDir, '--target-tokens', '8000', '--write-wave-files', '--json']);
const readOnlyNoFile = result.wave_files_written === false && !fs.existsSync(path.join(contextDir, 'waves'));
const written = buildContextWavePlan({ root, contextDir, targetTokens: 8000, writeWaveFiles: true });
const writtenMarkdown = renderMarkdown(written);
let unsafeWriteBlocked = false;
try {
  buildContextWavePlan({ root, contextDir, targetTokens: 8000, writeWaveFiles: true, waveDir: path.join(os.tmpdir(), 'outside-forgeflow-waves') });
} catch (err) {
  unsafeWriteBlocked = /outside repo root/.test(err.message);
}

const checks = [
  ['splits over budget', result.status === 'split-recommended' && result.waves.length > 1],
  ['prioritizes security first', result.waves[0].files[0] === 'src/auth.ts'],
  ['renders commands', markdown.includes('build-context-pack --files')],
  ['read-only by default', readOnlyNoFile],
  ['writes requested wave files', written.wave_files_written === true && fs.existsSync(path.join(contextDir, 'waves', 'risk-core-files.txt'))],
  ['written command references file', written.waves[0].command.includes('risk-core-files.txt') && writtenMarkdown.includes('File list:')],
  ['blocks unsafe write dir', unsafeWriteBlocked],
  ['parses args', opts.root === root && opts.contextDir === contextDir && opts.targetTokens === 8000 && opts.writeWaveFiles === true && opts.json === true],
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
