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
  estimated_compact_tokens: 12000,
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
const skewedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-wave-skewed-'));
const skewedContextDir = path.join(skewedRoot, '.forgeflow', path.basename(skewedRoot), 'context', 'latest');
fs.mkdirSync(skewedContextDir, { recursive: true });
fs.writeFileSync(path.join(skewedContextDir, 'file-manifest.json'), JSON.stringify({
  files: [
    { path: 'src/auth.ts', kind: 'security', size_bytes: 7000 },
    { path: 'src/service.ts', kind: 'service', size_bytes: 2000 },
    { path: 'docs/readme.md', kind: 'docs', size_bytes: 1000 },
  ],
}, null, 2));
fs.writeFileSync(path.join(skewedContextDir, 'context-telemetry.json'), JSON.stringify({ estimated_compact_tokens: 5000 }, null, 2));
fs.writeFileSync(path.join(skewedContextDir, 'synthesis-input.json'), JSON.stringify({ agent_packets: { smith: 'smith.md' } }, null, 2));
const skewed = buildContextWavePlan({ root: skewedRoot, contextDir: skewedContextDir, targetTokens: 8000 });
const oversized = buildContextWavePlan({ root: skewedRoot, contextDir: skewedContextDir, targetTokens: 4000 });
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
  ['adds wave budget status', result.waves.every((wave) => wave.budget_status && wave.budget_status.target_compact_tokens === 8000 && wave.verification_command === 'node scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json')],
  ['packs by token forecast, not file count', skewed.waves.length === 2 && skewed.waves[0].files[0] === 'src/auth.ts' && skewed.waves.every((wave) => wave.budget_status.estimated_compact_tokens <= 8000)],
  ['labels forecasts and requires measurement', skewed.waves.every((wave) => wave.estimation_basis.includes('Forecast only') && wave.budget_status.post_build_verification_required === true)],
  ['flags an oversized single file', oversized.status === 'needs-narrower-scope' && oversized.waves[0].budget_status.status === 'needs-narrower-scope' && oversized.next.includes('Manually narrow')],
  ['adds proof contract', result.waves.some((wave) => wave.proof_contract && wave.proof_contract.status === 'proof-present')],
  ['flags incomplete empty packets', empty.status === 'incomplete' && empty.incomplete_reasons.length === 2 && empty.next.includes('Rebuild') && emptyMarkdown.includes('Incomplete because:')],
  ['flags missing synthesis packets', missingSynthesis.status === 'incomplete' && missingSynthesis.incomplete_reasons.includes('synthesis input is missing agent packets')],
  ['renders shell-safe commands', markdown.includes("build-context-wave.js --wave 'risk-core'")],
  ['renders priority context', markdown.includes('Priority:') && markdown.includes('Proof files: docs/readme.md') && markdown.includes('Budget:') && markdown.includes('Proof contract:') && markdown.includes('Verify:')],
  ['read-only by default', readOnlyNoFile],
  ['writes requested wave files', written.wave_files_written === true && fs.existsSync(path.join(contextDir, 'waves', 'risk-core-files.txt'))],
  ['written command references quoted wave', written.waves[0].command.includes("'risk-core'") && written.waves[0].command.includes('build-context-wave.js') && writtenMarkdown.includes('File list:')],
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
