#!/usr/bin/env node
const path = require('path');
const { buildReleaseFollowThrough } = require('./render-release-follow-through');
const { smokeCheck } = require('./smoke-check');
const { writeJsonSafe } = require('./file-safety');

function usage() {
  console.error('Usage: render-release-consumption-rollup.js [--root <repo>] [--project-dir <dir>] [--with-smoke] [--save] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', withSmoke: false, save: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--with-smoke') {
      opts.withSmoke = true;
    } else if (arg === '--save') {
      opts.save = true;
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

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function snapshotPathFor(root, projectDir) {
  return path.join(projectDir || defaultProjectDir(root), 'release-consumption', 'latest.json');
}

function buildSmokeEvidence(opts, root, projectDir) {
  if (opts.smoke) return opts.smoke;
  if (!opts.withSmoke) {
    return {
      status: 'not-run',
      command: '/forgeflow-smoke',
      summary: 'Downstream smoke was not run by this rollup. Add --with-smoke to run it explicitly.',
    };
  }
  const smoke = smokeCheck({ root, projectDir, mode: 'downstream' });
  return {
    status: smoke.status,
    command: '/forgeflow-smoke',
    mode: 'downstream',
    summary: `Downstream smoke status is ${smoke.status}.`,
    checks: Array.isArray(smoke.checks) ? smoke.checks.length : 0,
  };
}

function rollupStatus(followThrough, smokeEvidence) {
  const releaseConsumption = followThrough.release_consumption || {};
  if (!releaseConsumption.consumed) return 'attention';
  if (smokeEvidence.status === 'fail') return 'attention';
  if (smokeEvidence.status === 'warn') return 'attention';
  return 'pass';
}

function buildChecks(followThrough, smokeEvidence) {
  const releaseConsumption = followThrough.release_consumption || {};
  return [
    {
      name: 'release-follow-through',
      status: followThrough.status === 'pass' ? 'pass' : 'attention',
      next: '/forgeflow-release-follow-through',
    },
    {
      name: 'release-consumption',
      status: releaseConsumption.consumed ? 'pass' : 'attention',
      next: releaseConsumption.next || '/forgeflow-release-follow-through',
    },
    {
      name: 'downstream-smoke',
      status: smokeEvidence.status === 'not-run' || smokeEvidence.status === 'pass' ? 'pass' : 'attention',
      next: smokeEvidence.command || '/forgeflow-smoke',
    },
  ];
}

function buildReleaseConsumptionRollup(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const followThrough = opts.followThrough || buildReleaseFollowThrough({ root, projectDir, installRoot: opts.installRoot, runner: opts.runner });
  const smokeEvidence = buildSmokeEvidence(opts, root, projectDir);
  const status = rollupStatus(followThrough, smokeEvidence);
  const checks = buildChecks(followThrough, smokeEvidence);
  const snapshotPath = snapshotPathFor(root, projectDir);
  const result = {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    status,
    version: followThrough.version || '',
    tag: followThrough.tag || '',
    release_consumption: followThrough.release_consumption,
    install_readiness: followThrough.readiness,
    checklist: followThrough.checklist || [],
    checks,
    release_verify_status: followThrough.release_verify_status || '',
    update_verify_status: followThrough.update_verify_status || '',
    runtime_consumability: (followThrough.checklist || []).find((item) => item.name === 'runtime-consumability') || null,
    downstream_smoke: smokeEvidence,
    next: status === 'pass'
      ? '/forgeflow-release-follow-through'
      : (followThrough.next || smokeEvidence.command || '/forgeflow-release-follow-through'),
    next_reason: status === 'pass'
      ? 'Release consumption evidence is clear enough for a local consumed verdict.'
      : (followThrough.next_reason || smokeEvidence.summary || 'Clear release consumption blockers before treating the release as consumed.'),
    snapshot: {
      path: snapshotPath,
      saved: false,
    },
    boundary: 'Release consumption rollup is local and read-only unless --save is supplied. It does not tag, push, publish, call GitHub, repair installs, or mutate settings.',
  };
  if (opts.save) {
    result.snapshot.saved = true;
    writeJsonSafe(snapshotPath, result);
  }
  return result;
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Release Consumption Rollup',
    '',
    `Status: ${result.status}`,
    `Version: ${result.version || '(missing)'}`,
    `Tag: ${result.tag || '(missing)'}`,
    '',
    result.boundary,
    '',
    '## Evidence',
    '',
    `- Release verify: ${result.release_verify_status || '(missing)'}`,
    `- Update verify: ${result.update_verify_status || '(missing)'}`,
    `- Install readiness: ${result.install_readiness ? result.install_readiness.status : '(missing)'}`,
    `- Release consumption: ${result.release_consumption ? result.release_consumption.status : '(missing)'}`,
    `- Downstream smoke: ${result.downstream_smoke.status}`,
    '',
    '## Checklist',
    '',
  ];
  for (const item of result.checklist) lines.push(`- ${item.name}: ${item.status}`);
  lines.push('', '## Rollup Checks', '');
  for (const item of result.checks) lines.push(`- ${item.name}: ${item.status}`);
  lines.push('', `Next: ${result.next}`, `Why: ${result.next_reason}`, `Snapshot: ${result.snapshot.saved ? result.snapshot.path : '(not saved)'}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildReleaseConsumptionRollup(opts);
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

module.exports = { buildChecks, buildReleaseConsumptionRollup, parseArgs, renderMarkdown, rollupStatus, snapshotPathFor };
