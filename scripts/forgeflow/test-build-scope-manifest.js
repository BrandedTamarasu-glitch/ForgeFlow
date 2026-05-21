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
  ['warden packet written', fs.existsSync(path.join(packetDir, 'warden.md'))],
  ['lumen packet written', fs.existsSync(path.join(packetDir, 'lumen.md'))],
  ['telemetry written', fs.existsSync(telemetryOut)],
  ['telemetry kind', telemetry.kind === 'scope-manifest'],
  ['telemetry estimates tokens', Number.isInteger(telemetry.estimated_compact_tokens)],
  ['smith service', manifest.lanes.smith.some((entry) => entry.path === 'src/services/user-service.ts')],
  ['warden auth', manifest.lanes.warden.some((entry) => entry.path === 'src/auth/session.ts')],
  ['lumen frontend', manifest.lanes.lumen.some((entry) => entry.path === 'src/components/LoginForm.tsx')],
  ['compass test', manifest.lanes.compass.some((entry) => entry.path === 'src/components/LoginForm.test.tsx')],
  ['atlas docs', manifest.lanes.atlas.some((entry) => entry.path === 'docs/login-plan.md')],
  ['forgeflow docs atlas', manifest.lanes.atlas.some((entry) => entry.path === 'commands/review.md')],
  ['deny env', manifest.denied.some((entry) => entry.path === '.env')],
  ['deny token', manifest.denied.some((entry) => entry.path === 'config/api-token.txt')],
  ['shared array present', Array.isArray(sharedPaths)],
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
