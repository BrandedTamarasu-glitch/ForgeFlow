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
fs.writeFileSync(path.join(contextDir, 'code-topology.json'), JSON.stringify({
  schema_version: '1',
  high_fan_in: [{ path: 'src/service.ts', fan_in: 8, fan_out: 2 }],
  high_fan_out: [],
  changed_file_neighbors: [{ path: 'src/auth.ts', read_next: [{ path: 'src/service.ts', direction: 'dependent' }] }],
}, null, 2));
const result = buildContextWavePlan({ root, targetTokens: 8000 });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--context-dir', contextDir, '--target-tokens', '8000', '--write-wave-files', '--json']);
const readOnlyNoFile = result.wave_files_written === false && !fs.existsSync(path.join(contextDir, 'waves'));
const written = buildContextWavePlan({ root, contextDir, targetTokens: 8000, writeWaveFiles: true });
const writtenMarkdown = renderMarkdown(written);
const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-wave-empty-'));
const emptyContextDir = path.join(emptyRoot, '.forgeflow', path.basename(emptyRoot), 'context', 'latest');
fs.mkdirSync(emptyContextDir, { recursive: true });
fs.writeFileSync(path.join(emptyContextDir, 'file-manifest.json'), JSON.stringify({ schema_version: '1', files: [] }, null, 2));
fs.writeFileSync(path.join(emptyContextDir, 'context-telemetry.json'), JSON.stringify({ schema_version: '1', kind: 'context-pack', estimated_compact_tokens: 0 }, null, 2));
fs.writeFileSync(path.join(emptyContextDir, 'synthesis-input.json'), JSON.stringify({ agent_packets: {} }, null, 2));
const empty = buildContextWavePlan({ root: emptyRoot, contextDir: emptyContextDir, targetTokens: 8000 });
const emptyMarkdown = renderMarkdown(empty);
const missingSynthesisRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-wave-missing-synthesis-'));
const missingSynthesisContextDir = path.join(missingSynthesisRoot, '.forgeflow', path.basename(missingSynthesisRoot), 'context', 'latest');
fs.mkdirSync(missingSynthesisContextDir, { recursive: true });
fs.writeFileSync(path.join(missingSynthesisContextDir, 'file-manifest.json'), JSON.stringify({
  schema_version: '1',
  files: [{ path: 'src/auth.ts', kind: 'security', size_bytes: 1200 }],
}, null, 2));
fs.writeFileSync(path.join(missingSynthesisContextDir, 'context-telemetry.json'), JSON.stringify({ schema_version: '1', kind: 'context-pack', estimated_compact_tokens: 1000 }, null, 2));
const missingSynthesis = buildContextWavePlan({ root: missingSynthesisRoot, contextDir: missingSynthesisContextDir, targetTokens: 8000 });
let unsafeWriteBlocked = false;
try {
  buildContextWavePlan({ root, contextDir, targetTokens: 8000, writeWaveFiles: true, waveDir: path.join(os.tmpdir(), 'outside-forgeflow-waves') });
} catch (err) {
  unsafeWriteBlocked = /outside repo root/.test(err.message);
}

const checks = [
  ['splits over budget', result.status === 'split-recommended' && result.waves.length > 1],
  ['prioritizes security first', result.waves[0].files[0] === 'src/auth.ts'],
  ['adds priority reasons', result.waves[0].priority_reasons.includes('security-sensitive-path') && result.waves[0].priority_reasons.includes('changed-neighborhood')],
  ['tracks proof files', result.proof_file_count === 1 && result.waves.some((wave) => wave.proof_files.includes('docs/readme.md'))],
  ['flags incomplete empty packets', empty.status === 'incomplete' && empty.incomplete_reasons.length === 2 && empty.next.includes('Rebuild') && emptyMarkdown.includes('Incomplete because:')],
  ['flags missing synthesis packets', missingSynthesis.status === 'incomplete' && missingSynthesis.incomplete_reasons.includes('synthesis input is missing agent packets')],
  ['renders shell-safe commands', markdown.includes("build-context-pack --files '<risk-core-files.txt>'")],
  ['renders priority context', markdown.includes('Priority:') && markdown.includes('Proof files: docs/readme.md')],
  ['read-only by default', readOnlyNoFile],
  ['writes requested wave files', written.wave_files_written === true && fs.existsSync(path.join(contextDir, 'waves', 'risk-core-files.txt'))],
  ['written command references quoted file', written.waves[0].command.includes("'") && written.waves[0].command.includes('risk-core-files.txt') && writtenMarkdown.includes('File list:')],
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
