#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildContextWave, parseArgs, renderMarkdown } = require('./build-context-wave');

function makeContext(tokens) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-build-context-wave-'));
  const contextDir = path.join(root, '.forgeflow', path.basename(root), 'context', 'latest');
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.mkdirSync(contextDir, { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'auth.ts'), 'export const auth = true;\n');
  fs.writeFileSync(path.join(root, 'src', 'service.ts'), 'export const service = true;\n');
  fs.writeFileSync(path.join(root, 'docs', 'readme.md'), '# Docs\n');
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
    estimated_compact_tokens: tokens,
  }, null, 2));
  fs.writeFileSync(path.join(contextDir, 'synthesis-input.json'), JSON.stringify({
    schema_version: '1',
    agent_packets: { smith: 'smith.md' },
  }, null, 2));
  return { root, contextDir };
}

const over = makeContext(24000);
const built = buildContextWave({ root: over.root, contextDir: over.contextDir, targetTokens: 8000 });
const markdown = renderMarkdown(built);
const under = makeContext(4000);
const currentOk = buildContextWave({ root: under.root, contextDir: under.contextDir, targetTokens: 8000 });
const missingContext = makeContext(24000);
const missing = buildContextWave({ root: missingContext.root, contextDir: missingContext.contextDir, targetTokens: 8000, wave: 'missing' });
const opts = parseArgs(['--root', over.root, '--context-dir', over.contextDir, '--target-tokens', '8000', '--wave', 'risk-core', '--json']);

const builtOut = built.built_wave ? path.join(over.root, built.built_wave.out_dir) : '';
const checks = [
  ['builds first wave', built.status === 'built' && built.built_wave.name === 'risk-core'],
  ['writes wave file', fs.existsSync(path.join(over.contextDir, 'waves', 'risk-core-files.txt'))],
  ['writes focused packet', fs.existsSync(path.join(builtOut, 'synthesis-input.json')) && fs.existsSync(path.join(builtOut, 'file-manifest.json'))],
  ['does not build under-budget pack', currentOk.status === 'current-packet-ok' && !currentOk.built_wave],
  ['does not write under-budget wave files', !fs.existsSync(path.join(under.contextDir, 'waves'))],
  ['handles missing wave', missing.status === 'wave-not-found' && missing.next.includes('risk-core')],
  ['does not write missing requested wave files', !fs.existsSync(path.join(missingContext.contextDir, 'waves'))],
  ['renders summary', markdown.includes('Context pack:') && markdown.includes('does not spawn reviewers')],
  ['parses args', opts.root === over.root && opts.contextDir === over.contextDir && opts.targetTokens === 8000 && opts.wave === 'risk-core' && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('build context wave: ok');
