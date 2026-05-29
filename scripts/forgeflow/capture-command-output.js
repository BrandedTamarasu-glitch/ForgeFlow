#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildFailureDigest } = require('./build-failure-digest');
const { compactCommandOutput } = require('./compact-command-output');
const { safeReadTextFile, writeFileSafe } = require('./file-safety');

const DIGEST_MODES = new Set(['test', 'typecheck', 'lint', 'logs']);

function usage() {
  console.error('Usage: capture-command-output.js --mode <mode> --command <cmd> [--file <path>] [--out <path>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { mode: '', command: '', file: '', out: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--mode') {
      opts.mode = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--command') {
      opts.command = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--file') {
      opts.file = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--out') {
      opts.out = path.resolve(requireValue(argv, arg, i));
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
  if (!opts.mode) throw new Error('Missing --mode');
  if (!opts.command) throw new Error('Missing --command');
  return opts;
}

function readInput(opts) {
  if (opts.file) return safeReadTextFile(opts.file, process.cwd()).content;
  return fs.readFileSync(0, 'utf8');
}

function captureCommandOutput(input, opts = {}) {
  const compact = compactCommandOutput(input, {
    mode: opts.mode,
    command: opts.command,
    maxLines: opts.maxLines || 80,
    maxLineChars: opts.maxLineChars || 220,
  });
  const digest = DIGEST_MODES.has(opts.mode)
    ? buildFailureDigest(input, { mode: opts.mode, command: opts.command, root: opts.root || process.cwd() })
    : null;
  const out = opts.out ? path.resolve(opts.out) : '';
  if (out && digest) writeFileSafe(out, digest.markdown);
  return {
    schema_version: '1',
    status: compact.raw_required ? 'raw-preserved' : 'captured',
    mode: opts.mode,
    command: opts.command,
    raw_required: compact.raw_required,
    compact_status: compact.status,
    input_lines: compact.input_lines,
    output_lines: compact.output_lines,
    omitted_lines: compact.omitted_lines,
    digest_written: Boolean(out && digest),
    out,
    compact_output: compact.output,
    next: compact.raw_required ? 'Inspect raw output before summarizing findings.' : (out ? 'Use the saved failure digest in the next context pack.' : 'Pass --out to save a failure digest for future context packs.'),
    boundary: 'Command output capture does not execute commands. It consumes provided output, preserves exact unsafe output, and only writes a digest when --out is supplied.',
  };
}

function renderMarkdown(result) {
  return [
    '# Forgeflow Command Output Capture',
    '',
    `Status: ${result.status}`,
    `Mode: ${result.mode}`,
    `Raw required: ${result.raw_required ? 'yes' : 'no'}`,
    `Input lines: ${result.input_lines}`,
    `Output lines: ${result.output_lines}`,
    `Omitted lines: ${result.omitted_lines}`,
    `Digest written: ${result.digest_written ? result.out : 'no'}`,
    '',
    result.boundary,
    '',
    `Next: ${result.next}`,
    '',
  ].join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = captureCommandOutput(readInput(opts), opts);
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

module.exports = { captureCommandOutput, parseArgs, renderMarkdown };
