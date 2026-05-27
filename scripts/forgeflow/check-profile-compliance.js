#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROLE_EXPECTATIONS = [
  { role: 'atlas', file: 'agents/atlas-review.md' },
  { role: 'compass', file: 'agents/compass-review.md' },
  { role: 'lumen', file: 'agents/lumen-review.md' },
  { role: 'warden', file: 'agents/warden-review.md' },
  { role: 'smith', file: 'agents/smith-review.md' },
  { role: 'arbiter', file: 'agents/arbiter-review.md' },
];

function usage() {
  console.error('Usage: check-profile-compliance.js [--root <dir>] [--json]');
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      const value = argv[++i] || '';
      if (!value || value.startsWith('--')) throw new Error('Missing value for --root');
      opts.root = path.resolve(value);
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

function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function installedRoot() {
  return path.resolve(__dirname, '..', '..');
}

function resolveRoot(opts) {
  const candidate = path.resolve(opts.root || installedRoot());
  if (fs.existsSync(path.join(candidate, 'scripts', 'forgeflow', 'user-profile.js'))) return candidate;
  return installedRoot();
}

function roleCheck(root, item) {
  const file = path.join(root, item.file);
  const text = readText(file);
  const hasProfileSection = /User Profile Guidance/i.test(text);
  const hasAdvisoryBoundary = /advisory/i.test(text) && /never overrides|does not override/i.test(text);
  const hasCurrentInstructionBoundary = /current(?:-turn)? instructions/i.test(text);
  const hasValidationBoundary = /validation evidence/i.test(text);
  const hasSafetyBoundary = /security|accessibility|correctness|product judgment/i.test(text);
  return {
    role: item.role,
    file,
    status: hasProfileSection && hasAdvisoryBoundary && hasCurrentInstructionBoundary && hasValidationBoundary && hasSafetyBoundary ? 'pass' : 'fail',
  };
}

function checkProfileCompliance(opts = {}) {
  const root = resolveRoot(opts);
  const sources = [
    path.join(root, 'scripts', 'forgeflow', 'user-profile.js'),
    path.join(root, 'scripts', 'forgeflow', 'render-profile-review.js'),
    path.join(root, 'commands', 'forgeflow-profile.md'),
    path.join(root, 'commands', 'forgeflow-profile-review.md'),
    ...ROLE_EXPECTATIONS.map((item) => path.join(root, item.file)),
  ];
  const text = sources.map(readText).join('\n');
  const checks = ROLE_EXPECTATIONS.map((item) => roleCheck(root, item));
  const boundaryChecks = [
    { name: 'advisory-only', status: /advisory/i.test(text) ? 'pass' : 'fail' },
    { name: 'no-security-override', status: /security/i.test(text) && /never overrides|ignore preferences/i.test(text) ? 'pass' : 'fail' },
    { name: 'validation-evidence', status: /validation evidence/i.test(text) ? 'pass' : 'fail' },
    { name: 'profile-review-covered', status: /render-profile-review\.js/.test(text) && /forgeflow-profile-review/.test(text) && /explicit user confirmation/i.test(text) ? 'pass' : 'fail' },
  ];
  const failures = checks.concat(boundaryChecks).filter((item) => item.status === 'fail');
  return {
    schema_version: '1',
    status: failures.length > 0 ? 'fail' : 'pass',
    checks,
    boundary_checks: boundaryChecks,
    sources,
  };
}

function renderMarkdown(result) {
  const lines = ['# Forgeflow Profile Compliance', '', `Status: ${result.status}`, '', '## Roles', ''];
  for (const item of result.checks) lines.push(`- ${item.role}: ${item.status}`);
  lines.push('', '## Boundaries', '');
  for (const item of result.boundary_checks) lines.push(`- ${item.name}: ${item.status}`);
  return `${lines.join('\n')}\n`;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = checkProfileCompliance(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  if (result.status === 'fail') process.exit(1);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { checkProfileCompliance, parseArgs, renderMarkdown };
