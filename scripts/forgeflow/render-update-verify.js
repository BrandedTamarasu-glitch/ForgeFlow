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

function buildUpdateVerify(opts = {}) {
  const home = path.resolve(opts.home || path.join(os.homedir(), '.claude'));
  const root = path.resolve(opts.root || defaultSourceRoot(home));
  const version = readInstalledVersion(home);
  const drift = buildRuntimeDriftSnapshot({ root, installRoot: home });
  const status = statusFor(version, drift);
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    home,
    root,
    status,
    installed_version: version,
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
    '',
    result.boundary,
    '',
    '## Checks',
    '',
  ];
  for (const check of result.checks) lines.push(`- ${check.name}: ${check.status} (${check.detail})`);
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

module.exports = { buildUpdateVerify, parseArgs, renderMarkdown };
