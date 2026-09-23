const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const source = path.resolve(__dirname, '../../fixtures/native-release/application.c');
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const compiler = spawnSync('cc', ['--version'], { encoding: 'utf8', timeout: 10000 });
if (process.platform !== 'linux' || compiler.error || compiler.status !== 0) {
  console.error('UNVERIFIED: native fixture requires Linux /proc and an available cc compiler.');
  process.exit(2);
}
const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-native-release-evidence-'));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-native-release-work-'));
const build = path.join(temporary, 'build');
const install = path.join(temporary, 'installed');
const profile = path.join(temporary, 'profile');
const unrelated = path.join(temporary, 'unrelated');
const otherProfile = path.join(temporary, 'other-profile');
const binary = path.join(install, 'sample-app');
const state = path.join(profile, 'state.txt');
const sentinel = path.join(install, 'unrelated-user-file.txt');
const report = {
  provenance: 'authored-synthetic-fixture', source_sha256: digest(source),
  environment: { platform: process.platform, architecture: process.arch, kernel: os.release(), compiler: compiler.stdout.split('\n')[0] },
  evidence_levels: { build: 'unverified', installed: 'unverified', actual_host: 'unverified', human: 'unverified',
    installer: 'simulated file-copy lifecycle', desktop_ui: 'unverified', windows: 'unverified', macos: 'unverified', public_release: 'unverified' },
  started_at: new Date().toISOString(), artifacts: [], observations: [], cleanup: 'pending', status: 'running',
};
function observe(name, command, args, expectedExit = 0) {
  const result = spawnSync(command, args, { cwd: unrelated, encoding: 'utf8', timeout: 10000 });
  report.observations.push({ name, command, args, exit: result.status, signal: result.signal,
    installed_sha256: command === binary ? digest(binary) : null,
    stdout: result.stdout || '', stderr: result.stderr || '', error_code: result.error?.code || null });
  assert.ifError(result.error);
  assert.equal(result.status, expectedExit, `${name}: ${result.stderr}`);
  assert.equal(result.signal, null);
  return result;
}
function deploy(artifact) {
  const staged = `${binary}.next`;
  fs.copyFileSync(artifact, staged);
  fs.chmodSync(staged, 0o755);
  fs.renameSync(staged, binary);
}
function launch(name, version, launches) {
  assert.equal(digest(binary), report.artifacts.find(artifact => artifact.version === version).sha256);
  const result = observe(name, binary, [profile]);
  const expected = `version=${version}\nschema=${version}\nlaunches=${launches}\nexecutable=${fs.realpathSync(binary)}\n`;
  assert.equal(result.stdout, expected);
  assert.equal(fs.readFileSync(state, 'utf8'), `${version} ${launches}\n`);
}

try {
  for (const directory of [build, install, profile, unrelated, otherProfile]) fs.mkdirSync(directory);
  fs.writeFileSync(sentinel, 'preserve me\n');
  fs.writeFileSync(path.join(otherProfile, 'state.txt'), '1 17\n');
  const artifacts = [1, 2].map(version => {
    const artifact = path.join(build, `sample-v${version}`);
    observe(`build-v${version}`, 'cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', `-DRELEASE_VERSION=${version}`, source, '-o', artifact]);
    assert.equal(fs.readFileSync(artifact).subarray(0, 4).toString('hex'), '7f454c46', 'must compile a native ELF binary');
    report.artifacts.push({ version, sha256: digest(artifact) });
    return artifact;
  });
  report.evidence_levels.build = 'pass';
  deploy(artifacts[0]);
  assert.equal(digest(binary), report.artifacts[0].sha256);
  assert.equal(fs.existsSync(state), false);
  launch('first-run', 1, 1);
  launch('restart-separate-process', 1, 2);
  const snapshot = fs.readFileSync(state);
  // A good v2 build does not prove the installed program was updated.
  assert.notEqual(digest(binary), report.artifacts[1].sha256);
  report.observations.push({ name: 'stale-install-negative-control', result: 'detected', expected_sha256: report.artifacts[1].sha256, installed_sha256: digest(binary) });

  deploy(artifacts[1]);
  assert.equal(digest(binary), report.artifacts[1].sha256);
  launch('update-migrates-and-preserves-count', 2, 3);
  launch('updated-restart', 2, 4);
  const migrated = fs.readFileSync(state);
  deploy(artifacts[0]);
  assert.equal(digest(binary), report.artifacts[0].sha256);
  const incompatible = observe('binary-only-rollback-rejected', binary, [profile], 5);
  assert.equal(incompatible.stderr, 'unsupported-profile-version\n');
  assert.deepEqual(fs.readFileSync(state), migrated, 'rejected rollback must preserve incompatible data');
  // This fixture intentionally chooses snapshot recovery, discarding two post-update launches.
  fs.writeFileSync(state, snapshot);
  launch('snapshot-rollback-recovery', 1, 3);
  report.observations.push({ name: 'snapshot-recovery-boundary', discarded_post_update_launches: 2, data_loss_policy: 'explicit fixture snapshot restore' });

  const recovered = fs.readFileSync(state);
  fs.writeFileSync(state, 'malformed profile\n');
  const malformed = observe('malformed-profile-preserved', binary, [profile], 4);
  assert.equal(malformed.stderr, 'invalid-profile\n');
  assert.equal(fs.readFileSync(state, 'utf8'), 'malformed profile\n');
  fs.writeFileSync(state, recovered);
  fs.chmodSync(binary, 0o644);
  const blocked = spawnSync(binary, [profile], { cwd: unrelated, encoding: 'utf8', timeout: 10000 });
  assert.equal(blocked.error?.code, 'EACCES', 'installed executable must actually launch');
  assert.deepEqual(fs.readFileSync(state), recovered);
  report.observations.push({ name: 'non-executable-negative-control', result: 'detected', error_code: blocked.error.code });
  fs.chmodSync(binary, 0o755);

  // Simulated uninstall owns the executable only; user data remains intact.
  fs.unlinkSync(binary);
  assert.equal(fs.existsSync(binary), false);
  const removed = spawnSync(binary, [profile], { cwd: unrelated, encoding: 'utf8', timeout: 10000 });
  assert.equal(removed.error?.code, 'ENOENT');
  assert.deepEqual(fs.readFileSync(state), recovered);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'preserve me\n');
  assert.equal(fs.readFileSync(path.join(otherProfile, 'state.txt'), 'utf8'), '1 17\n');
  report.observations.push({ name: 'uninstall-preserves-user-data-and-unrelated-profile', result: 'pass', error_code: removed.error.code });
  deploy(artifacts[0]);
  launch('reinstall-retains-profile', 1, 4);
  report.evidence_levels.installed = 'pass';
  report.evidence_levels.actual_host = 'pass';
  report.status = 'pass';
} catch (error) {
  report.status = 'fail';
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  try {
    fs.rmSync(temporary, { recursive: true, force: true });
    assert.equal(fs.existsSync(temporary), false);
    report.cleanup = 'pass';
  } catch (error) {
    report.cleanup = 'fail'; report.status = 'fail'; report.cleanup_error = error.message; process.exitCode = 1;
  }
  fs.writeFileSync(path.join(evidenceDir, 'observations.json'), JSON.stringify(report, null, 2));
  console.log(`Native fixture: ${report.status}; owned resources cleanup: ${report.cleanup}. Evidence: ${evidenceDir}`);
  if (report.failure) console.error(report.failure);
}
