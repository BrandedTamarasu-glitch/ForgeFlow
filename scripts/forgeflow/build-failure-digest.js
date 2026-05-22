#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { compactCommandOutput } = require('./compact-command-output');
const { safeReadTextFile, writeFileSafe } = require('./file-safety');
const { classifyFailureDigest } = require('./failure-digest-triage');
const { currentGitState, repoRoot } = require('./latest-insights-state');

function usage() {
  console.error('Usage: build-failure-digest.js --mode <test|typecheck|lint|logs> [--command <cmd>] [--file <path>] [--out <path>] [--json]');
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
      console.error(`Unknown argument: ${arg}`);
      usage();
      process.exit(2);
    }
  }
  return opts;
}

function defaultProjectDir(root = process.cwd()) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function defaultOut(root = process.cwd()) {
  return path.join(defaultProjectDir(root), 'context', 'latest', 'failure-digest.md');
}

function extractFailureRefs(text) {
  const refs = [];
  const seen = new Set();
  const patterns = [
    /([A-Za-z0-9_./-]+\.[cm]?[jt]sx?):(\d+):(\d+)/g,
    /([A-Za-z0-9_./-]+\.[cm]?[jt]sx?):(\d+)/g,
    /([A-Za-z0-9_./-]+(?:\.test|\.spec)\.[cm]?[jt]sx?)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const key = `${match[1]}:${match[2] || ''}:${match[3] || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push({
        file: match[1],
        line: match[2] ? Number.parseInt(match[2], 10) : null,
        column: match[3] ? Number.parseInt(match[3], 10) : null,
      });
      if (refs.length >= 20) return refs;
    }
  }
  return refs;
}

function renderDigest(result, refs, gitState = null) {
  const fence = result.output.includes('````') ? '`````' : '````';
  const git = gitState || { available: false, commit_short: '', dirty: false };
  const status = result.status === 'compacted' ? 'compact' : result.status;
  const triage = classifyFailureDigest({
    status,
    present: true,
    raw_required: result.raw_required,
    reason: result.reason,
    input_lines: result.input_lines,
    output_lines: result.output_lines,
    refs,
  });
  const lines = [
    '# Forgeflow Failure Digest',
    '',
    `Generated at: ${new Date().toISOString()}`,
    `Git available: ${git.available ? 'yes' : 'no'}`,
    `Git commit: ${git.commit_short || '(unknown)'}`,
    `Git dirty: ${git.dirty ? 'yes' : 'no'}`,
    `Mode: ${result.mode || 'unknown'}`,
    `Status: ${status}`,
    `Raw required: ${result.raw_required ? 'yes' : 'no'}`,
    `Reason: ${result.reason}`,
    `Input lines: ${result.input_lines}`,
    `Output lines: ${result.output_lines}`,
    `Omitted lines: ${result.omitted_lines}`,
    `Triage state: ${triage.state}`,
    `Usefulness: ${triage.usefulness}`,
    `Confidence: ${triage.confidence}`,
    `Next action: ${triage.next_action.command || triage.next_action.action || '(none)'}`,
    `Next action reason: ${triage.next_action.reason}`,
    '',
    '## Evidence References',
    '',
    ...(refs.length > 0
      ? refs.map((item) => `- ${item.file}${item.line ? `:${item.line}` : ''}${item.column ? `:${item.column}` : ''}`)
      : ['(none detected)']),
    '',
    '## Compact Output',
    '',
    `${fence}text`,
    result.output.replace(/\s+$/g, ''),
    fence,
    '',
    '## Safety',
    '',
    '- Diffs, patches, SHAs, exact file lists, and unsafe command output must remain raw.',
    '- If compaction cannot parse safely, this digest keeps raw output and marks Raw required as yes.',
  ];
  return `${lines.join('\n')}\n`;
}

function buildFailureDigest(input, opts = {}) {
  const root = opts.root || repoRoot();
  const git = currentGitState(root);
  const result = compactCommandOutput(input, {
    mode: opts.mode || 'test',
    command: opts.command || '',
    maxLines: opts.maxLines || 80,
    maxLineChars: opts.maxLineChars || 220,
  });
  const refs = extractFailureRefs(result.output || input);
  const status = result.status === 'compacted' ? 'compact' : result.status;
  const triage = classifyFailureDigest({
    status,
    present: true,
    raw_required: result.raw_required,
    reason: result.reason,
    input_lines: result.input_lines,
    output_lines: result.output_lines,
    refs,
  });
  const markdown = renderDigest(result, refs, git);
  return {
    schema_version: '1',
    generated_at: new Date().toISOString(),
    git,
    status,
    mode: result.mode,
    raw_required: result.raw_required,
    reason: result.reason,
    triage,
    refs,
    compact: result,
    markdown,
  };
}

function readInput(opts) {
  if (opts.file) return safeReadTextFile(opts.file, process.cwd()).content;
  return fs.readFileSync(0, 'utf8');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.mode) {
    usage();
    process.exit(2);
  }
  const digest = buildFailureDigest(readInput(opts), opts);
  const out = opts.out || defaultOut(process.cwd());
  writeFileSafe(out, digest.markdown);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ ...digest, markdown: undefined, out }, null, 2)}\n`);
  } else {
    process.stdout.write(digest.markdown);
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
  buildFailureDigest,
  extractFailureRefs,
  renderDigest,
};
