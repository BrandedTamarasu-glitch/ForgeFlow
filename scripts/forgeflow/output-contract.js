#!/usr/bin/env node
const path = require('path');
const os = require('os');
const { buildFirstUsefulWin } = require('./render-first-useful-win');
const { buildFirstTaskReport } = require('./render-first-task-report');
const { buildUpdateVerify } = require('./render-update-verify');
const { buildNextActionContract } = require('./next-action-contract');

function usage() {
  console.error('Usage: output-contract.js [--root <dir>] [--project-dir <dir>] [--home <dir>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', home: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
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

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function requiredIssues(name, result) {
  const issues = [];
  for (const key of ['status', 'next', 'next_reason', 'boundary']) {
    if (!result[key]) issues.push({ name, code: `missing-${key}`, severity: 'fail' });
  }
  return issues;
}

function buildOutputContract(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const home = opts.home ? path.resolve(opts.home) : path.join(os.homedir(), '.claude');
  const samples = [
    { name: 'first-useful-win', result: buildFirstUsefulWin({ root, projectDir }) },
    { name: 'first-task-report', result: buildFirstTaskReport({ root, projectDir }) },
    { name: 'update-verify', result: buildUpdateVerify({ home }) },
    { name: 'next-action-contract', result: buildNextActionContract({ root, projectDir }) },
  ];
  const issues = samples.flatMap((sample) => requiredIssues(sample.name, sample.result));
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    status: issues.length > 0 ? 'fail' : 'pass',
    checked_count: samples.length,
    issues,
    next: issues.length > 0 ? 'fix-output-contract' : '/forgeflow-smoke --mode source',
    next_reason: issues.length > 0 ? 'Fix missing output fields before relying on helper UX.' : 'Run source smoke after output contract checks pass.',
    boundary: 'Output contract audit is read-only. It checks representative helper result shape only and does not execute next commands.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Output Contract',
    '',
    `Status: ${result.status}`,
    `Checked: ${result.checked_count}`,
    '',
    result.boundary,
    '',
    '## Issues',
    '',
  ];
  if (result.issues.length === 0) lines.push('- None.');
  else for (const issue of result.issues) lines.push(`- ${issue.name}: ${issue.code}`);
  lines.push('', `Next: ${result.next}`, `Why: ${result.next_reason}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildOutputContract(opts);
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

module.exports = { buildOutputContract, parseArgs, renderMarkdown };
