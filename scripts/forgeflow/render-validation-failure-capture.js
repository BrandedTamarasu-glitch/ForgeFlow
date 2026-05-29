#!/usr/bin/env node
const path = require('path');
const { isUnsafeCommand } = require('./compact-command-output');
const { tokenize } = require('./command-args');

function usage() {
  console.error('Usage: render-validation-failure-capture.js --command <cmd> [--root <repo>] [--project-dir <dir>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function requireRawValue(argv, name, index) {
  const value = argv[index + 1];
  if (value === undefined || value === '') throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', command: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--command') {
      opts.command = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--args') {
      const parsed = parseArgs(tokenize(requireRawValue(argv, arg, i)));
      opts.command = parsed.command || opts.command;
      opts.json = opts.json || parsed.json;
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
  if (!opts.command) throw new Error('Missing --command');
  return opts;
}

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function modeForCommand(command) {
  const text = String(command || '');
  if (isUnsafeCommand(text)) return { mode: 'raw', raw_required: true, reason: 'Command output is correctness-critical and must remain exact.' };
  if (/\b(jest|vitest|playwright|npm\s+test|pnpm\s+test)\b/i.test(text)) return { mode: 'test', raw_required: false, reason: 'Test output can be compacted to failures and assertion signal.' };
  if (/\b(tsc|typecheck)\b/i.test(text)) return { mode: 'typecheck', raw_required: false, reason: 'Typecheck output can be compacted to errors and warnings.' };
  if (/\b(eslint|lint)\b/i.test(text)) return { mode: 'lint', raw_required: false, reason: 'Lint output can be compacted to violations.' };
  if (/\b(build|next\s+build|vite\s+build)\b/i.test(text)) return { mode: 'build', raw_required: false, reason: 'Build output can be compacted to failures, errors, and warnings.' };
  if (/\b(log|tail|journalctl|docker\s+logs)\b/i.test(text)) return { mode: 'logs', raw_required: false, reason: 'Log output can be compacted to warn/error/fatal signal.' };
  return { mode: 'logs', raw_required: false, reason: 'Unknown validation output should use conservative log compaction, with raw fallback if no signal is found.' };
}

function shellQuote(value) {
  return `'${String(value || '').replace(/'/g, "'\\''")}'`;
}

function buildValidationFailureCapture(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const command = String(opts.command || '').trim();
  const mode = modeForCommand(command);
  const digestPath = path.join(projectDir, 'context', 'latest', 'failure-digest.md');
  const captureCommand = mode.raw_required
    ? ''
    : `forgeflow-capture-output --mode ${mode.mode} --command ${shellQuote(command)} --out ${path.relative(root, digestPath)}`;
  return {
    schema_version: '1',
    status: mode.raw_required ? 'raw-required' : 'capture-ready',
    root,
    project_dir: projectDir,
    command,
    mode: mode.mode,
    raw_required: mode.raw_required,
    reason: mode.reason,
    digest_path: path.relative(root, digestPath),
    capture_command: captureCommand,
    next: mode.raw_required ? 'Keep the failed output raw and inspect it directly.' : captureCommand,
    boundary: 'Validation failure capture is a plan only. It does not execute the failed command, read output, write a digest, edit files, commit, or push.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Validation Failure Capture',
    '',
    `Status: ${result.status}`,
    `Mode: ${result.mode}`,
    `Raw required: ${result.raw_required ? 'yes' : 'no'}`,
    `Digest path: ${result.digest_path}`,
    '',
    result.boundary,
    '',
    `Reason: ${result.reason}`,
    '',
    `Next: ${result.next}`,
    '',
  ];
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildValidationFailureCapture(opts);
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

module.exports = { buildValidationFailureCapture, modeForCommand, parseArgs, renderMarkdown };
