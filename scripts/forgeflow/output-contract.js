#!/usr/bin/env node
const path = require('path');
const os = require('os');
const { buildFirstUsefulWin } = require('./render-first-useful-win');
const { buildFirstTaskReport } = require('./render-first-task-report');
const { buildUpdateVerify } = require('./render-update-verify');
const { buildNextActionContract } = require('./next-action-contract');
const { safeReadTextFile } = require('./file-safety');

function usage() {
  console.error('Usage: output-contract.js [--root <dir>] [--project-dir <dir>] [--home <dir>] [--lean-file <path>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', home: '', leanFiles: [], json: false };
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
    } else if (arg === '--lean-file') {
      opts.leanFiles.push(path.resolve(requireValue(argv, arg, i)));
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

function isRawRequiredText(text) {
  const value = String(text || '');
  return [
    /^diff --git /m,
    /```(?:diff|patch)\b/i,
    /\braw_required\b/i,
    /\braw output preserved\b/i,
    /\b(command output|stdout|stderr|stack trace|traceback)\b/i,
    /\b(AssertionError|TypeError|ReferenceError|SyntaxError|error TS\d{4})\b/,
    /\b(failure evidence|review evidence|validation evidence)\b/i,
  ].some((pattern) => pattern.test(value));
}

function stripFencedBlocks(text) {
  return String(text || '').replace(/```[\s\S]*?```/g, '');
}

function wordCount(text) {
  return (String(text || '').match(/\b[\w'-]+\b/g) || []).length;
}

function leanOutputIssues(name, text) {
  if (isRawRequiredText(text)) return [];
  const body = stripFencedBlocks(text);
  const lines = body.split(/\r?\n/);
  const nonEmpty = lines.map((line) => line.trim()).filter(Boolean);
  if (nonEmpty.length === 0) return [];

  const issues = [];
  const bulletCount = nonEmpty.filter((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)).length;
  if (bulletCount > 3) {
    issues.push({
      name,
      code: 'lean-bullet-budget',
      severity: 'warn',
      detail: `Lean narrative has ${bulletCount} bullets; keep skipped/safe-now/upgrade-later to three concise bullets.`,
    });
  }

  const paragraphs = body.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  const longParagraph = paragraphs.find((item) => wordCount(item) > 90);
  if (longParagraph) {
    issues.push({
      name,
      code: 'lean-long-paragraph',
      severity: 'warn',
      detail: 'Lean narrative contains a paragraph over 90 words; put the result first and move detail to implementation notes.',
    });
  }

  const narrativeLines = nonEmpty.filter((line) => !/^#{1,6}\s+/.test(line) && !/^\|/.test(line));
  if (narrativeLines.length > 18) {
    issues.push({
      name,
      code: 'lean-narrative-budget',
      severity: 'warn',
      detail: `Lean narrative has ${narrativeLines.length} non-empty lines; keep result first and explain only what was skipped, why safe, and when to expand.`,
    });
  }

  const first = nonEmpty[0] || '';
  if (/^(before|first,|to begin|the goal|this change|we need|i will)\b/i.test(first)) {
    issues.push({
      name,
      code: 'lean-result-not-first',
      severity: 'warn',
      detail: 'Lean output should start with the code/result, not setup prose.',
    });
  }

  return issues;
}

function leanFileIssues(root, files) {
  const issues = [];
  for (const file of files || []) {
    const content = safeReadTextFile(file, root).content;
    issues.push(...leanOutputIssues(path.relative(root, file) || path.basename(file), content));
  }
  return issues;
}

function buildOutputContract(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const home = opts.home ? path.resolve(opts.home) : path.join(os.homedir(), '.claude');
  const leanFiles = (opts.leanFiles || []).map((file) => path.resolve(file));
  const samples = [
    { name: 'first-useful-win', result: buildFirstUsefulWin({ root, projectDir }) },
    { name: 'first-task-report', result: buildFirstTaskReport({ root, projectDir }) },
    { name: 'update-verify', result: buildUpdateVerify({ home }) },
    { name: 'next-action-contract', result: buildNextActionContract({ root, projectDir }) },
  ];
  const issues = [
    ...samples.flatMap((sample) => requiredIssues(sample.name, sample.result)),
    ...leanFileIssues(root, leanFiles),
  ];
  const failCount = issues.filter((issue) => issue.severity === 'fail').length;
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    status: failCount > 0 ? 'fail' : (issues.length > 0 ? 'warn' : 'pass'),
    checked_count: samples.length,
    lean_checked_count: leanFiles.length,
    issues,
    next: failCount > 0 ? 'fix-output-contract' : (issues.length > 0 ? 'tighten-lean-output' : '/forgeflow-smoke --mode source'),
    next_reason: failCount > 0
      ? 'Fix missing output fields before relying on helper UX.'
      : (issues.length > 0
        ? 'Lean output warnings should be shortened before agent handoff unless the user requested detail.'
        : 'Run source smoke after output contract checks pass.'),
    boundary: 'Output contract audit is read-only. It checks representative helper result shape and optional lean narrative budgets. It never truncates raw command output, diffs, failure evidence, review evidence, or user-requested explanations.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Output Contract',
    '',
    `Status: ${result.status}`,
    `Checked: ${result.checked_count}`,
    `Lean files checked: ${result.lean_checked_count || 0}`,
    '',
    result.boundary,
    '',
    '## Issues',
    '',
  ];
  if (result.issues.length === 0) lines.push('- None.');
  else for (const issue of result.issues) {
    lines.push(`- ${issue.severity || 'fail'}: ${issue.name}: ${issue.code}${issue.detail ? ` - ${issue.detail}` : ''}`);
  }
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
module.exports.leanOutputIssues = leanOutputIssues;
module.exports.isRawRequiredText = isRawRequiredText;
