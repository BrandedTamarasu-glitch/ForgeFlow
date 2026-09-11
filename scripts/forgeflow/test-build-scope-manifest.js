#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildScopeManifest } = require('./build-scope-manifest');

const repoRoot = path.resolve(__dirname, '..', '..');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-scope-manifest-'));
const out = path.join(tmpDir, 'scope-manifest.json');
const packetDir = path.join(tmpDir, 'scope-packets');
const telemetryOut = path.join(tmpDir, 'scope-telemetry.json');
const result = buildScopeManifest({
  root: repoRoot,
  filesPath: path.join(repoRoot, 'fixtures/scope-manifest/files.txt'),
  query: 'login session auth frontend validation',
  out,
  packetDir,
  telemetryOut,
  maxFilesPerLane: 20,
});
const untrackedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-scope-untracked-'));
spawnSync('git', ['init'], { cwd: untrackedRoot, encoding: 'utf8' });
fs.writeFileSync(path.join(untrackedRoot, 'new-work-item.js'), 'export const work = true;\n');
const untrackedResult = buildScopeManifest({
  root: untrackedRoot,
  out: path.join(untrackedRoot, '.forgeflow', path.basename(untrackedRoot), 'context', 'scope-manifest.json'),
  packetDir: path.join(untrackedRoot, '.forgeflow', path.basename(untrackedRoot), 'context', 'scope-packets'),
  telemetryOut: path.join(untrackedRoot, '.forgeflow', path.basename(untrackedRoot), 'context', 'scope-telemetry.json'),
});

const manifest = JSON.parse(fs.readFileSync(out, 'utf8'));
const telemetry = JSON.parse(fs.readFileSync(telemetryOut, 'utf8'));
const sharedPaths = manifest.lanes.shared.map((entry) => entry.path);
const untrackedManifestEntries = Object.values(untrackedResult.manifest.lanes).flat();
const checks = [
  ['result path', result.out === out],
  ['manifest written', fs.existsSync(out)],
  ['packet dir returned', result.packet_dir === packetDir],
  ['guardian packet written', fs.existsSync(path.join(packetDir, 'guardian.md'))],
  ['designer packet written', fs.existsSync(path.join(packetDir, 'designer.md'))],
  ['telemetry written', fs.existsSync(telemetryOut)],
  ['telemetry kind', telemetry.kind === 'scope-manifest'],
  ['telemetry estimates tokens', Number.isInteger(telemetry.estimated_compact_tokens)],
  ['builder service', manifest.lanes.builder.some((entry) => entry.path === 'src/services/user-service.ts')],
  ['guardian auth', manifest.lanes.guardian.some((entry) => entry.path === 'src/auth/session.ts')],
  ['designer frontend', manifest.lanes.designer.some((entry) => entry.path === 'src/components/LoginForm.tsx')],
  ['product_lead test', manifest.lanes.product_lead.some((entry) => entry.path === 'src/components/LoginForm.test.tsx')],
  ['coordinator docs', manifest.lanes.coordinator.some((entry) => entry.path === 'docs/login-plan.md')],
  ['forgeflow docs coordinator', manifest.lanes.coordinator.some((entry) => entry.path === 'commands/review.md')],
  ['deny env', manifest.denied.some((entry) => entry.path === '.env')],
  ['deny token', manifest.denied.some((entry) => entry.path === 'config/api-token.txt')],
  ['shared array present', Array.isArray(sharedPaths)],
  ['records bounded omitted files', result.manifest.max_files_per_lane === 20 && result.manifest.omitted_counts && Object.values(result.manifest.omitted_counts).every(Number.isInteger)],
  ['untracked file auto-discovered', untrackedManifestEntries.some((entry) => entry.path === 'new-work-item.js')],
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

console.log('scope manifest: ok');

// Old persisted lane names still render current-role scope without losing files.
{
  const assert = require('node:assert/strict');
  const { renderScopePacket } = require('./build-scope-manifest');
  const oldManifest = { ...manifest, lanes: { shared: [], smith: manifest.lanes.builder } };
  assert.equal(renderScopePacket('smith', oldManifest), renderScopePacket('builder', oldManifest));
  assert.ok(renderScopePacket('builder', oldManifest).includes('src/services/user-service.ts'));
}
