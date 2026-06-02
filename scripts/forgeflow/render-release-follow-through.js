#!/usr/bin/env node
const path = require('path');
const { buildReleaseVerify } = require('./render-release-verify');
const { buildUpdateVerify } = require('./render-update-verify');

function usage() {
  console.error('Usage: render-release-follow-through.js [--root <repo>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
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

function safeCall(fn, fallback) {
  try {
    return fn();
  } catch (err) {
    return { ...fallback, error: err.message };
  }
}

function consumerUpdateStatus(status) {
  if (status === 'ready') return 'pass';
  if (status === 'restart') return 'info';
  return 'attention';
}

function readinessSummary(checklist) {
  const blockers = checklist.filter((item) => item.status !== 'pass' && item.status !== 'info');
  const informational = checklist.filter((item) => item.status === 'info');
  return {
    status: blockers.length === 0 ? 'ready-to-install' : 'needs-follow-through',
    blockers: blockers.map((item) => item.name),
    informational: informational.map((item) => item.name),
    install_ready: blockers.length === 0,
    summary: blockers.length === 0
      ? 'Release follow-through is clear enough for consumer install/update validation.'
      : `Clear ${blockers[0].name} before treating the release as install-ready.`,
  };
}

function buildReleaseFollowThrough(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const installRoot = opts.installRoot || opts.home;
  const releaseVerify = safeCall(() => buildReleaseVerify({ root, runner: opts.runner, installRoot }), { status: 'missing', evidence: [] });
  const updateVerify = safeCall(() => buildUpdateVerify({ root, home: installRoot }), { status: 'missing', evidence: [] });
  const checklist = [
    {
      name: 'post-publish-release-verify',
      status: releaseVerify.status === 'pass' || releaseVerify.status === 'install-attention' ? releaseVerify.status : 'attention',
      next: '/forgeflow-release-verify --save',
    },
    {
      name: 'consumer-update-verify',
      status: consumerUpdateStatus(updateVerify.status),
      next: '/forgeflow-update-verify',
    },
    {
      name: 'runtime-consumability',
      status: releaseVerify.local_consumability && releaseVerify.local_consumability.status !== 'attention' ? releaseVerify.local_consumability.status : 'attention',
      next: '/update-forgeflow --repair',
    },
  ];
  const attention = checklist.filter((item) => item.status !== 'pass' && item.status !== 'info');
  const readiness = readinessSummary(checklist);
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    status: attention.length ? 'attention' : 'pass',
    version: releaseVerify.version || updateVerify.version || '',
    tag: releaseVerify.tag || '',
    checklist,
    readiness,
    release_verify_status: releaseVerify.status,
    update_verify_status: updateVerify.status,
    next: attention.length ? attention[0].next : '/forgeflow-smoke --source',
    next_reason: attention.length
      ? `Clear ${attention[0].name} before treating the release as fully consumed.`
      : 'Release verification and update verification are both clear.',
    boundary: 'Release follow-through is local and read-only. It does not tag, push, publish, call GitHub, repair installs, or change settings.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Release Follow-Through',
    '',
    `Status: ${result.status}`,
    `Version: ${result.version || '(missing)'}`,
    `Tag: ${result.tag || '(missing)'}`,
    '',
    result.boundary,
    '',
    '## Checklist',
    '',
  ];
  for (const item of result.checklist) {
    lines.push(`- ${item.name}: ${item.status}`);
    if (item.status !== 'pass') lines.push(`  - Next: ${item.next}`);
  }
  lines.push(
    '',
    '## Install Readiness',
    '',
    `- Status: ${result.readiness.status}`,
    `- Install ready: ${result.readiness.install_ready ? 'yes' : 'no'}`,
    `- Summary: ${result.readiness.summary}`,
  );
  if (result.readiness.blockers.length > 0) {
    lines.push(`- Blockers: ${result.readiness.blockers.join(', ')}`);
  }
  if (result.readiness.informational.length > 0) {
    lines.push(`- Informational follow-ups: ${result.readiness.informational.join(', ')}`);
  }
  lines.push('', `Next: ${result.next}`, `Why: ${result.next_reason}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildReleaseFollowThrough(opts);
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

module.exports = { buildReleaseFollowThrough, consumerUpdateStatus, parseArgs, readinessSummary, renderMarkdown };
