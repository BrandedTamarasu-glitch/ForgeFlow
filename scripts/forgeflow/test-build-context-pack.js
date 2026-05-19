#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildContextPack } = require('./build-context-pack');

const repoRoot = path.resolve(__dirname, '..', '..');
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-pack-'));
const result = buildContextPack({
  filesPath: path.join(repoRoot, 'fixtures/context-pack/review.files'),
  linesChanged: 80,
  task: 'Review login flow token load context packing',
  out: outDir,
  modeOverride: '',
  calibrationPath: '',
  ci: false,
  maxMemoryChars: 12000,
  maxDiffChars: 18000,
});
const noisyOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-pack-noisy-'));
const noisyResult = buildContextPack({
  filesPath: path.join(repoRoot, 'fixtures/review-route/noisy.files'),
  linesChanged: 20,
  task: 'Review noisy file list handling',
  out: noisyOutDir,
  modeOverride: '',
  calibrationPath: '',
  ci: false,
  maxMemoryChars: 12000,
  maxDiffChars: 18000,
});

const route = JSON.parse(fs.readFileSync(path.join(outDir, 'route.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'file-manifest.json'), 'utf8'));
const synthesis = JSON.parse(fs.readFileSync(path.join(outDir, 'synthesis-input.json'), 'utf8'));
const telemetry = JSON.parse(fs.readFileSync(path.join(outDir, 'context-telemetry.json'), 'utf8'));
const noisyManifest = JSON.parse(fs.readFileSync(path.join(noisyOutDir, 'file-manifest.json'), 'utf8'));
const wardenPacket = fs.readFileSync(path.join(repoRoot, synthesis.agent_packets.warden_reviewer), 'utf8');

const checks = [
  ['result out dir', result.out_dir === outDir],
  ['deep mode for auth path', route.mode === 'deep-mode'],
  ['aegis included', route.agents.included.includes('aegis')],
  ['manifest has three files', manifest.files.length === 3],
  ['security kind detected', manifest.files.some((file) => file.kind === 'security')],
  ['frontend kind detected', manifest.files.some((file) => file.kind === 'frontend')],
  ['warden packet exists', Boolean(synthesis.agent_packets.warden_reviewer)],
  ['aegis packet exists', Boolean(synthesis.agent_packets.aegis)],
  ['memory hits written', fs.existsSync(path.join(outDir, 'memory-hits.md'))],
  ['latest insights written', fs.existsSync(path.join(outDir, 'latest-insights.md'))],
  ['diff summary written', fs.existsSync(path.join(outDir, 'diff-summary.md'))],
  ['telemetry written', fs.existsSync(path.join(outDir, 'context-telemetry.json'))],
  ['telemetry linked', synthesis.context_telemetry_path.endsWith('context-telemetry.json')],
  ['latest insights linked', synthesis.latest_insights_path.endsWith('latest-insights.md')],
  ['agent packet includes latest insights', wardenPacket.includes('## Latest Insights')],
  ['telemetry token estimate', Number.isInteger(telemetry.estimated_compact_tokens)],
  ['noisy manifest sanitized', noisyManifest.files.length === 3],
  ['no noisy decoration in manifest', !noisyManifest.files.some((file) => file.path.includes('Changes') || file.path.includes('|'))],
  ['noisy result full mode', noisyResult.route.mode === 'full-mode'],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log('context pack: ok');
