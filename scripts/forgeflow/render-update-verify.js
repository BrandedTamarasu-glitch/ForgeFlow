#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildRuntimeDriftSnapshot } = require('./runtime-drift-snapshot');
const { versionPath } = require('./update-forgeflow');

function usage() {
  console.error('Usage: render-update-verify.js [--root <dir>] [--home <dir>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: '', home: path.join(os.homedir(), '.claude'), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--home') {
      opts.home = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function readInstalledVersion(home) {
  const file = versionPath(home);
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8').trim();
}

function gitDirForRoot(root) {
  const gitPath = path.join(root, '.git');
  if (!fs.existsSync(gitPath)) return '';
  const stat = fs.statSync(gitPath);
  if (stat.isDirectory()) return gitPath;
  const content = fs.readFileSync(gitPath, 'utf8').trim();
  const match = content.match(/^gitdir:\s*(.+)$/);
  if (!match) return '';
  const gitDir = match[1];
  return path.resolve(root, gitDir);
}

function packedRefVersion(gitDir, ref) {
  const packedRefs = path.join(gitDir, 'packed-refs');
  if (!fs.existsSync(packedRefs)) return '';
  const lines = fs.readFileSync(packedRefs, 'utf8').split(/\r?\n/);
  const line = lines.find((item) => item.endsWith(` ${ref}`));
  return line ? line.split(/\s+/)[0] : '';
}

function readSourceVersion(root) {
  const gitDir = gitDirForRoot(root);
  if (!gitDir) return '';
  const headFile = path.join(gitDir, 'HEAD');
  if (!fs.existsSync(headFile)) return '';
  const head = fs.readFileSync(headFile, 'utf8').trim();
  if (!head.startsWith('ref:')) return head;
  const ref = head.replace(/^ref:\s*/, '');
  const refFile = path.join(gitDir, ref);
  if (fs.existsSync(refFile)) return fs.readFileSync(refFile, 'utf8').trim();
  return packedRefVersion(gitDir, ref);
}

function defaultSourceRoot(home) {
  const helperRoot = path.resolve(__dirname, '..', '..');
  const installedRoot = path.join(path.resolve(home), 'forgeflow');
  if (helperRoot === installedRoot || helperRoot.startsWith(`${installedRoot}${path.sep}`)) return installedRoot;
  return helperRoot;
}

function statusFor(version, drift) {
  if (!version) return 'repair';
  if (drift.status === 'attention') return 'repair';
  if (drift.status === 'info') return 'restart';
  return 'ready';
}

function versionsMatch(version, sourceVersion) {
  if (!version || !sourceVersion) return false;
  return version === sourceVersion || version.startsWith(sourceVersion) || sourceVersion.startsWith(version);
}

function driftGuidanceFor(version, drift, status, sourceVersion = '') {
  if (!version) {
    return {
      status: 'repair-required',
      summary: 'Installed version metadata is missing, so repair must restore the managed runtime.',
      expected_post_release: false,
      clears_with: '/update-forgeflow --repair',
    };
  }
  if (status === 'ready') {
    return {
      status: 'current',
      summary: 'Installed runtime matches the managed manifest.',
      expected_post_release: false,
      clears_with: '/forgeflow-health',
    };
  }
  if (status === 'restart') {
    return {
      status: 'restart-required',
      summary: 'Only reload-sensitive drift was found; restart Claude Code before rechecking health.',
      expected_post_release: false,
      clears_with: 'restart Claude Code, then /forgeflow-health',
    };
  }
  const sourceDrift = sourceVersion && !versionsMatch(version, sourceVersion);
  return {
    status: sourceDrift ? 'source-install-drift' : 'runtime-drift-repair',
    summary: sourceDrift
      ? 'Managed runtime drift requires repair. This is expected immediately after a source checkout or release advances before the installed copy has been repaired.'
      : 'Managed runtime drift requires repair even though the installed version metadata matches the checked source or source provenance is unavailable.',
    expected_post_release: Boolean(sourceDrift),
    clears_with: '/update-forgeflow --repair',
    drift_counts: {
      missing: drift.missing_installed || 0,
      content: drift.content_drift || 0,
      mode: drift.mode_drift || 0,
    },
  };
}

function buildUpdateVerify(opts = {}) {
  const home = path.resolve(opts.home || path.join(os.homedir(), '.claude'));
  const root = path.resolve(opts.root || defaultSourceRoot(home));
  const version = readInstalledVersion(home);
  const sourceVersion = opts.sourceVersion || readSourceVersion(root);
  const drift = buildRuntimeDriftSnapshot({ root, installRoot: home });
  const status = statusFor(version, drift);
  const driftGuidance = driftGuidanceFor(version, drift, status, sourceVersion);
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    home,
    root,
    status,
    installed_version: version,
    source_version: sourceVersion,
    drift_guidance: driftGuidance,
    checks: [
      { name: 'version-file', status: version ? 'pass' : 'fail', detail: version ? version.slice(0, 12) : 'missing' },
      { name: 'runtime-drift', status: drift.status, detail: `${drift.missing_installed || 0} missing, ${drift.content_drift || 0} content drift, ${drift.mode_drift || 0} mode drift` },
    ],
    next: status === 'ready' || status === 'restart' ? '/forgeflow-health' : '/update-forgeflow --repair',
    next_reason: status === 'ready'
      ? 'Run health after update verification to confirm command and hook inventory.'
      : status === 'restart'
        ? 'Restart Claude Code to reload commands and hooks, then run health.'
        : 'Repair missing or content-drifted managed runtime files before using Forgeflow.',
    boundary: 'Update verification is read-only. It checks installed version and runtime drift only; it does not update, repair, or edit settings.json.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Update Verification',
    '',
    `Status: ${result.status}`,
    `Source root: ${result.root}`,
    `Install root: ${result.home}`,
    `Installed version: ${result.installed_version || '(missing)'}`,
    `Source version: ${result.source_version || '(unknown)'}`,
    '',
    result.boundary,
    '',
    '## Checks',
    '',
  ];
  for (const check of result.checks) lines.push(`- ${check.name}: ${check.status} (${check.detail})`);
  lines.push('', '## Drift Guidance', '', `Status: ${result.drift_guidance.status}`, `Expected after release: ${result.drift_guidance.expected_post_release ? 'yes' : 'no'}`, `Clears with: ${result.drift_guidance.clears_with}`, `Summary: ${result.drift_guidance.summary}`);
  lines.push('', `Next: ${result.next}`, `Why: ${result.next_reason}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildUpdateVerify(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(1);
  }
}

module.exports = {
  buildUpdateVerify,
  driftGuidanceFor,
  gitDirForRoot,
  parseArgs,
  readSourceVersion,
  renderMarkdown,
  versionsMatch,
};
