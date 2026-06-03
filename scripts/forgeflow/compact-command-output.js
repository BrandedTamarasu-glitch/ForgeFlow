#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { safeReadTextFile } = require('./file-safety');

const SAFE_MODES = new Set(['test', 'typecheck', 'lint', 'build', 'logs', 'grep', 'json', 'status', 'tree']);
const PRESET_MODES = new Set([...SAFE_MODES, 'auto']);
const UNSAFE_COMMAND_PATTERNS = [
  /\bgit\s+diff\b/,
  /\bgit\s+apply\b/,
  /\bfind\b/,
  /\bpatch\b/,
  /\bapply_patch\b/,
  /\b--name-only\b/,
  /\b--name-status\b/,
  /\brev-parse\b/,
  /\bhash-object\b/,
  /\bcat-file\b/,
];
const DEFAULT_MAX_LINES = 80;
const DEFAULT_MAX_LINE_CHARS = 220;

function usage() {
  console.error('Usage: compact-command-output.js [--mode <test|typecheck|lint|build|logs|grep|json|status|tree>] [--preset <auto|test|typecheck|lint|build|logs|grep|json|status|tree>] [--command <cmd>] [--file <path>] [--max-lines N] [--max-line-chars N] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) {
    console.error(`Missing value for ${name}`);
    usage();
    process.exit(2);
  }
  return value;
}

function parseArgs(argv) {
  const opts = {
    mode: '',
    preset: '',
    command: '',
    file: '',
    json: false,
    maxLines: DEFAULT_MAX_LINES,
    maxLineChars: DEFAULT_MAX_LINE_CHARS,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--mode') {
      opts.mode = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--preset') {
      opts.preset = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--command') {
      opts.command = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--file') {
      opts.file = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--max-lines') {
      opts.maxLines = Number.parseInt(requireValue(argv, arg, i), 10);
      i += 1;
    } else if (arg === '--max-line-chars') {
      opts.maxLineChars = Number.parseInt(requireValue(argv, arg, i), 10);
      i += 1;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      usage();
      process.exit(2);
    }
  }
  return opts;
}

function isUnsafeCommand(command) {
  const text = String(command || '');
  return UNSAFE_COMMAND_PATTERNS.some((pattern) => pattern.test(text));
}

function detectCommandPreset(command) {
  const text = String(command || '').trim();
  if (!text) return { mode: '', preset: '', reason: 'command missing' };
  if (isUnsafeCommand(text)) return { mode: '', preset: 'raw-required', reason: 'command output is correctness-critical' };
  if (/\b(vitest|jest|mocha|ava|pytest|go\s+test|cargo\s+test|rspec|phpunit|test)\b/i.test(text)) {
    return { mode: 'test', preset: 'test', reason: 'test command pattern' };
  }
  if (/\b(tsc|mypy|pyright|typecheck|type-check|flow)\b/i.test(text)) {
    return { mode: 'typecheck', preset: 'typecheck', reason: 'typecheck command pattern' };
  }
  if (/\b(eslint|biome|ruff|flake8|rubocop|shellcheck|lint)\b/i.test(text)) {
    return { mode: 'lint', preset: 'lint', reason: 'lint command pattern' };
  }
  if (/\b(build|vite\s+build|webpack|rollup|next\s+build|cargo\s+build|go\s+build|make)\b/i.test(text)) {
    return { mode: 'build', preset: 'build', reason: 'build command pattern' };
  }
  if (/\b(tail|journalctl|kubectl\s+logs|docker\s+logs|log)\b/i.test(text)) {
    return { mode: 'logs', preset: 'logs', reason: 'log command pattern' };
  }
  if (/\b(rg|grep)\b/i.test(text)) return { mode: 'grep', preset: 'grep', reason: 'search command pattern' };
  if (/\b(status)\b/i.test(text)) return { mode: 'status', preset: 'status', reason: 'status command pattern' };
  if (/\btree\b/i.test(text)) return { mode: 'tree', preset: 'tree', reason: 'tree/listing command pattern' };
  if (/\b(json|jq)\b/i.test(text)) return { mode: 'json', preset: 'json', reason: 'json command pattern' };
  return { mode: '', preset: 'none', reason: 'no safe preset matched' };
}

function normalizeOptions(opts = {}) {
  const requestedPreset = opts.preset || '';
  let detected;
  if (opts.mode) {
    detected = { mode: opts.mode, preset: requestedPreset || opts.mode, reason: 'explicit mode' };
  } else if (PRESET_MODES.has(requestedPreset) && requestedPreset !== 'auto') {
    detected = { mode: requestedPreset, preset: requestedPreset, reason: 'explicit preset' };
  } else {
    detected = detectCommandPreset(opts.command || '');
  }
  return {
    mode: detected.mode || opts.mode || '',
    preset: detected.preset || requestedPreset || '',
    preset_reason: detected.reason || '',
    command: opts.command || '',
    maxLines: Number.isFinite(opts.maxLines) && opts.maxLines > 0 ? opts.maxLines : DEFAULT_MAX_LINES,
    maxLineChars: Number.isFinite(opts.maxLineChars) && opts.maxLineChars > 0 ? opts.maxLineChars : DEFAULT_MAX_LINE_CHARS,
  };
}

function truncateLine(line, maxLineChars) {
  const text = String(line || '').replace(/\s+$/g, '');
  if (text.length <= maxLineChars) return text;
  return `${text.slice(0, Math.max(0, maxLineChars - 30))} ... [truncated ${text.length - maxLineChars + 30} chars]`;
}

function boundedLines(lines, maxLines) {
  if (lines.length <= maxLines) return { lines, omitted: 0 };
  const head = Math.ceil(maxLines / 2);
  const tail = Math.floor(maxLines / 2);
  return {
    lines: [
      ...lines.slice(0, head),
      `[... omitted ${lines.length - maxLines} lines ...]`,
      ...lines.slice(lines.length - tail),
    ],
    omitted: lines.length - maxLines,
  };
}

function dedupeLines(lines) {
  const out = [];
  let previous = '';
  let count = 0;
  function flush() {
    if (!previous) return;
    out.push(count > 1 ? `${previous} (x${count})` : previous);
  }
  for (const line of lines) {
    if (line === previous) {
      count += 1;
    } else {
      flush();
      previous = line;
      count = 1;
    }
  }
  flush();
  return out;
}

function cleanLines(input, maxLineChars) {
  return String(input || '')
    .split(/\r?\n/)
    .map((line) => truncateLine(line, maxLineChars))
    .filter((line) => line.trim().length > 0);
}

function compactTest(lines) {
  const signal = /(^|\b)(fail|failed|failing|error|exception|expected|received|actual|timeout|AssertionError|TypeError|ReferenceError|SyntaxError|\bat\s+\S+|>\s*\d+\s*\|)/i;
  return lines.filter((line) => signal.test(line));
}

function compactTypecheck(lines) {
  return lines.filter((line) => /\b(error|warning)\b|TS\d{4}|:\d+:\d+/i.test(line));
}

function compactLint(lines) {
  return lines.filter((line) => /\b(error|warning)\b|^\s*\d+:\d+\s+|✖|problems?\b/i.test(line));
}

function compactBuild(lines) {
  const signal = /\b(error|warning|failed|failure|exception|traceback|cannot|unable|missing|invalid)\b|ERR!|ELIFECYCLE|TS\d{4}|:\d+:\d+/i;
  return lines.filter((line) => signal.test(line));
}

function compactLogs(lines) {
  return dedupeLines(lines.filter((line) => /\b(ERROR|WARN|WARNING|FATAL|SEVERE|Exception|Traceback)\b/i.test(line)));
}

function compactGrep(lines) {
  const grouped = new Map();
  for (const line of lines) {
    const match = line.match(/^([^:\s][^:]*):(.+)$/);
    const file = match ? match[1] : '(ungrouped)';
    const value = match ? match[2].trim() : line.trim();
    if (!grouped.has(file)) grouped.set(file, []);
    const bucket = grouped.get(file);
    if (bucket.length < 5) bucket.push(value);
  }
  return [...grouped.entries()].flatMap(([file, values]) => [`${file}:`, ...values.map((value) => `  ${value}`)]);
}

function compactStatus(lines) {
  return lines.filter((line) => line.trim()).map((line) => line.trim());
}

function compactTree(lines) {
  const ignored = /(^|\/)(node_modules|\.git|dist|build|coverage|target|\.next|\.turbo)(\/|$)/;
  return lines.filter((line) => !ignored.test(line));
}

function compactJson(input) {
  const value = JSON.parse(input);
  return JSON.stringify(value, null, 2).split(/\r?\n/);
}

function rawResult(input, opts, reason) {
  return {
    schema_version: '1',
    status: 'raw',
    mode: opts.mode,
    preset: opts.preset || '',
    preset_reason: opts.preset_reason || '',
    command: opts.command,
    reason,
    raw_required: true,
    input_lines: String(input || '').split(/\r?\n/).length,
    output_lines: String(input || '').split(/\r?\n/).length,
    omitted_lines: 0,
    output: String(input || ''),
  };
}

function compactCommandOutput(input, options = {}) {
  const opts = normalizeOptions(options);
  if (!SAFE_MODES.has(opts.mode)) return rawResult(input, opts, 'mode is not allowlisted for compaction');
  if (!opts.command) return rawResult(input, opts, 'command is required before compaction so unsafe exact output can be detected');
  if (isUnsafeCommand(opts.command)) return rawResult(input, opts, 'command output is correctness-critical and must remain exact');

  try {
    const lines = cleanLines(input, opts.maxLineChars);
    let compacted = [];
    if (opts.mode === 'test') compacted = compactTest(lines);
    else if (opts.mode === 'typecheck') compacted = compactTypecheck(lines);
    else if (opts.mode === 'lint') compacted = compactLint(lines);
    else if (opts.mode === 'build') compacted = compactBuild(lines);
    else if (opts.mode === 'logs') compacted = compactLogs(lines);
    else if (opts.mode === 'grep') compacted = compactGrep(lines);
    else if (opts.mode === 'status') compacted = compactStatus(lines);
    else if (opts.mode === 'tree') compacted = compactTree(lines);
    else if (opts.mode === 'json') compacted = compactJson(input).map((line) => truncateLine(line, opts.maxLineChars));

    if (String(input || '').trim() && compacted.length === 0) {
      return rawResult(input, opts, 'compaction produced no signal; raw output preserved');
    }

    const bounded = boundedLines(compacted, opts.maxLines);
    return {
      schema_version: '1',
      status: 'compacted',
      mode: opts.mode,
      preset: opts.preset || opts.mode,
      preset_reason: opts.preset_reason || '',
      command: opts.command,
      reason: 'allowlisted human-narrative output compacted',
      raw_required: false,
      input_lines: lines.length,
      output_lines: bounded.lines.length,
      omitted_lines: (lines.length - compacted.length) + bounded.omitted,
      output: `${bounded.lines.join('\n')}${bounded.lines.length > 0 ? '\n' : ''}`,
    };
  } catch (err) {
    return rawResult(input, opts, `compaction failed loudly: ${err.message}`);
  }
}

function readInput(opts) {
  if (opts.file) return safeReadTextFile(opts.file, process.cwd()).content;
  return fs.readFileSync(0, 'utf8');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const input = readInput(opts);
  const result = compactCommandOutput(input, opts);
  if (opts.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else if (result.raw_required) {
    process.stdout.write(`# Forgeflow raw output preserved: ${result.reason}\n${result.output || ''}`);
  } else {
    process.stdout.write(result.output || '');
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.stack || err.message);
    process.exit(1);
  }
}

module.exports = {
  compactCommandOutput,
  detectCommandPreset,
  isUnsafeCommand,
  SAFE_MODES,
};
