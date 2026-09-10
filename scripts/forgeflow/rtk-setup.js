const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const INSTALL_ARGS = ['install', '--git', 'https://github.com/rtk-ai/rtk', '--tag', 'v0.48.0', '--locked', 'rtk'];
const FALLBACK = 'RTK is optional. Run commands directly; use rtk proxy <command> when raw output is needed.';

function inspectRtk({ run = spawnSync, executable = 'rtk' } = {}) {
  const options = { encoding: 'utf8', timeout: 5000, maxBuffer: 128 * 1024, windowsHide: true };
  const version = run(executable, ['--version'], options);
  if (version.error?.code === 'ENOENT') return { status: 'missing', action: FALLBACK };
  if (version.error || version.status !== 0 || !/^rtk\s+\d+\.\d+\.\d+/i.test((version.stdout || '').trim())) {
    return { status: 'unverified', action: `Could not verify Rust Token Killer with ${executable} --version. ${FALLBACK}` };
  }
  const gain = run(executable, ['gain'], options);
  if (gain.error || gain.status !== 0) {
    return { status: 'unverified', action: `The gain check failed; this may be a different RTK tool or a local runtime problem. ${FALLBACK}` };
  }
  return { status: 'ready', executable, version: version.stdout.trim().split(/\r?\n/)[0], action: FALLBACK };
}

function setupRtk({ install = false, dryRun = false, run = spawnSync } = {}) {
  const detected = inspectRtk({ run });
  if (detected.status === 'ready' || !install) return detected;
  // Never replace a different or broken command found on PATH implicitly.
  if (detected.status !== 'missing') return detected;
  const installedPath = path.join(process.env.CARGO_HOME || path.join(os.homedir(), '.cargo'), 'bin', process.platform === 'win32' ? 'rtk.exe' : 'rtk');
  const local = inspectRtk({ run, executable: installedPath });
  if (local.status !== 'missing') {
    return { ...local, status: local.status === 'ready' ? 'path-required' : local.status, action: `Check ${installedPath} and expose its directory on PATH, then rerun setup. ${FALLBACK}` };
  }
  const command = ['cargo', ...INSTALL_ARGS];
  if (dryRun) return { status: 'planned', command, action: 'Would install RTK v0.48.0 using Cargo. Cargo and a Rust toolchain are required; no download or installation performed.' };
  const result = run('cargo', INSTALL_ARGS, { encoding: 'utf8', timeout: 20 * 60 * 1000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
  if (result.error || result.status !== 0) {
    return { status: 'failed', command, action: `Optional RTK installation failed${result.error?.code ? ` (${result.error.code})` : ` (exit ${result.status})`}. Check Cargo and the Rust toolchain, or use the upstream installation guide. ${FALLBACK}` };
  }
  const verified = inspectRtk({ run });
  if (verified.status === 'ready') return { ...verified, installed: true };
  const installed = inspectRtk({ run, executable: installedPath });
  return { ...installed, status: installed.status === 'ready' ? 'path-required' : 'failed', installed: true, action: `Verify ${installedPath} --version and gain, and add its directory to PATH if needed. ${FALLBACK}` };
}

module.exports = { inspectRtk, setupRtk };
