#!/usr/bin/env node
const os = require('os');
const path = require('path');
const { buildReleaseVerify } = require('./render-release-verify');
const { smokeCheck } = require('./smoke-check');

function usage() {
  console.error('Usage: render-post-release-install-verify.js [--root <repo>] [--install-root <dir>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), installRoot: path.join(os.homedir(), '.claude'), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--install-root') {
      opts.installRoot = path.resolve(requireValue(argv, arg, i));
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

function buildPostReleaseInstallVerify(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const installRoot = path.resolve(opts.installRoot || path.join(os.homedir(), '.claude'));
  const release = opts.release || buildReleaseVerify({ root, installRoot, runner: opts.runner });
  const smoke = opts.smoke || smokeCheck({ root, mode: 'downstream' });
  const releaseCheckStatus = release.status === 'published-and-verified'
    ? 'pass'
    : (release.status === 'install-attention' && release.local_consumability.status === 'info' ? 'info' : 'attention');
  const installStatus = release.local_consumability.status === 'pass'
    ? 'pass'
    : (release.local_consumability.status === 'info' ? 'info' : 'attention');
  const checks = [
    { name: 'release-verify', status: releaseCheckStatus, next: release.next_command },
    { name: 'install-consumability', status: installStatus, next: installStatus === 'attention' ? '/update-forgeflow --repair' : '/forgeflow-version && /forgeflow-health' },
    { name: 'downstream-smoke', status: smoke.status === 'pass' ? 'pass' : smoke.status, next: '/forgeflow-smoke' },
  ];
  const status = checks.some((check) => check.status === 'fail')
    ? 'fail'
    : (checks.some((check) => ['attention', 'warn'].includes(check.status))
      ? 'attention'
      : (checks.some((check) => check.status === 'info') ? 'info' : 'pass'));
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    install_root: installRoot,
    status,
    checks,
    release_verify: {
      status: release.status,
      version: release.version,
      tag: release.tag,
      head: release.head,
      local_consumability: release.local_consumability,
    },
    smoke: {
      status: smoke.status,
      checks: smoke.checks.map((check) => ({ name: check.name, status: check.status, command: check.command || '' })),
    },
    next: status === 'pass' || status === 'info' ? '/forgeflow-version && /forgeflow-health' : '/update-forgeflow --repair',
    next_reason: status === 'pass' || status === 'info' ? 'Verify the installed version and health after update.' : 'Repair managed files, then rerun /forgeflow-post-release-install-verify.',
    boundary: 'Post-release install verification is read-only. It does not update, repair, tag, push, publish, call GitHub, or mutate installed files.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Post-Release Install Verify',
    '',
    `Status: ${result.status}`,
    `Version: ${result.release_verify.version || '(missing)'}`,
    `Tag: ${result.release_verify.tag || '(missing)'}`,
    `Install root: ${result.install_root}`,
    '',
    result.boundary,
    '',
    '## Checks',
    '',
  ];
  for (const check of result.checks) lines.push(`- ${check.name}: ${check.status} (next: ${check.next})`);
  lines.push('', `Next: ${result.next}`);
  lines.push(`Why: ${result.next_reason}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildPostReleaseInstallVerify(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  if (result.status === 'fail') process.exit(1);
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

module.exports = { buildPostReleaseInstallVerify, parseArgs, renderMarkdown };
