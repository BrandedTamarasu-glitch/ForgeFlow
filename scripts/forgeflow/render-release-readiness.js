#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { safeReadTextFile } = require('./file-safety');

const MAX_OUTPUT_CHARS = 1200;

function usage() {
  console.error('Usage: render-release-readiness.js [--root <repo>] [--plan-only] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = {
    root: process.cwd(),
    planOnly: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--plan-only') {
      opts.planOnly = true;
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

function readReleaseCheck(root) {
  const file = path.join(root, 'commands', 'forgeflow-release-check.md');
  if (!fs.existsSync(file)) throw new Error(`Missing release-check source: ${file}`);
  return safeReadTextFile(file, root).content;
}

function releaseReadinessCommands(releaseCheck) {
  const text = String(releaseCheck || '');
  const fenced = [];
  let active = false;
  let language = '';
  let bucket = [];
  for (const line of text.split(/\r?\n/)) {
    const fence = line.match(/^```([A-Za-z0-9_-]*)\s*$/);
    if (fence) {
      if (active) {
        if (!language || language === 'bash' || language === 'sh') fenced.push(bucket.join('\n'));
        active = false;
        language = '';
        bucket = [];
      } else {
        active = true;
        language = (fence[1] || '').toLowerCase();
        bucket = [];
      }
      continue;
    }
    if (active) bucket.push(line);
  }
  const source = fenced.length > 0 ? fenced.join('\n') : text;
  return [...new Set(source.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(node|git)\s+/.test(line)))];
}

function commandCategory(command) {
  if (/test-(plugin-manifest|release-version|doc-links|command-coverage|command-argument-safety)\.js/.test(command)) return 'metadata';
  if (/test-(install-template|install-manifest|runtime-helper-contract|install-smoke|update-forgeflow|health-check|forgeflow-version|render-guided-repair|installed-runtime-dogfood)\.js/.test(command)) return 'install-runtime';
  if (/test-(build-code-topology|show-code-map|build-context-pack|show-project-trends|show-project-learnings|build-project-intelligence|check-context-budget|advise-context|smoke-check)\.js/.test(command)) return 'project-context';
  if (/test-(privacy-boundary|record-|rollup-|check-project-learnings|check-implementation-notes|implementation-notes|render-adoption-pack|render-evaluation-report|render-forgeflow-report|render-release-notes|render-pilot-script|guidance-contract|failure-digest|check-agent-drift|dogfood-self-test|seed-budget-config)\.js/.test(command)) return 'quality';
  if (/smoke-check\.js --mode source/.test(command)) return 'source-smoke';
  if (command === 'git diff --check') return 'whitespace';
  return 'quality';
}

function tokenizeCommand(command) {
  return String(command || '').trim().split(/\s+/).filter(Boolean);
}

function allowedCommand(command) {
  const parts = tokenizeCommand(command);
  if (parts.length === 0) return false;
  if (parts[0] === 'git') return parts.length === 3 && parts[1] === 'diff' && parts[2] === '--check';
  if (parts[0] !== 'node') return false;
  const script = parts[1] || '';
  if (!/^scripts\/forgeflow\/[A-Za-z0-9._-]+\.js$/.test(script)) return false;
  return parts.slice(2).every((arg) => /^[A-Za-z0-9._=/:+-]+$/.test(arg));
}

function releaseCheckEnv() {
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  delete env.NODE_PATH;
  return env;
}

function runCommand(root, command, runner = spawnSync) {
  if (!allowedCommand(command)) {
    return {
      status: 'fail',
      exit_code: null,
      stdout: '',
      stderr: 'release readiness refuses to run command outside the release-check allowlist',
    };
  }
  const [bin, ...args] = tokenizeCommand(command);
  const result = runner(bin, args, { cwd: root, encoding: 'utf8', env: releaseCheckEnv() });
  if (result.error) {
    return {
      status: 'fail',
      exit_code: result.status ?? null,
      stdout: String(result.stdout || '').trim().slice(0, MAX_OUTPUT_CHARS),
      stderr: String(result.error.message || result.stderr || '').trim().slice(0, MAX_OUTPUT_CHARS),
    };
  }
  return {
    status: result.status === 0 ? 'pass' : 'fail',
    exit_code: result.status,
    stdout: String(result.stdout || '').trim().slice(0, MAX_OUTPUT_CHARS),
    stderr: String(result.stderr || result.error?.message || '').trim().slice(0, MAX_OUTPUT_CHARS),
  };
}

function summarizeCategory(items) {
  const failed = items.filter((item) => item.status === 'fail');
  const planned = items.filter((item) => item.status === 'planned');
  return {
    status: failed.length > 0 ? 'fail' : (planned.length > 0 ? 'planned' : 'pass'),
    total: items.length,
    failed: failed.length,
    planned: planned.length,
  };
}

function buildReleaseReadiness(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  let releaseCheck = '';
  let sourceError = null;
  try {
    releaseCheck = readReleaseCheck(root);
  } catch (err) {
    sourceError = err;
  }
  const commands = releaseReadinessCommands(releaseCheck);
  const runner = opts.runner || spawnSync;
  const sourceFailure = sourceError ? [{
    category: 'metadata',
    command: 'read commands/forgeflow-release-check.md',
    status: 'fail',
    exit_code: null,
    stdout: '',
    stderr: sourceError.message,
  }] : [];
  const checks = sourceFailure.concat(commands.map((command) => {
    const category = commandCategory(command);
    if (opts.planOnly) {
      return {
        category,
        command,
        status: 'planned',
        exit_code: null,
        stdout: '',
        stderr: '',
      };
    }
    return {
      category,
      command,
      ...runCommand(root, command, runner),
    };
  }));
  const categories = {};
  for (const category of [...new Set(checks.map((item) => item.category))].sort()) {
    categories[category] = summarizeCategory(checks.filter((item) => item.category === category));
  }
  const failures = checks.filter((item) => item.status === 'fail');
  const planned = checks.filter((item) => item.status === 'planned');
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    status: failures.length > 0 ? 'blocked' : (planned.length > 0 ? 'planned' : 'ready'),
    mode: opts.planOnly ? 'plan-only' : 'run',
    command_count: checks.length,
    categories,
    blockers: failures.map((item) => ({
      category: item.category,
      command: item.command,
      exit_code: item.exit_code,
      output: item.stderr || item.stdout,
      clears: `Fix the failure and rerun ${item.command}`,
    })),
    checks,
    boundary: 'Release readiness is advisory and non-mutating. It never tags, pushes, publishes, or calls GitHub.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Release Readiness',
    '',
    `Status: ${result.status}`,
    `Mode: ${result.mode}`,
    `Commands: ${result.command_count}`,
    '',
    result.boundary,
    '',
    '## Categories',
    '',
  ];
  for (const [name, summary] of Object.entries(result.categories)) {
    lines.push(`- ${name}: ${summary.status} (${summary.total} checks, ${summary.failed} failed, ${summary.planned} planned)`);
  }
  lines.push('', '## Blockers', '');
  if (result.blockers.length === 0) {
    lines.push(result.status === 'planned' ? '- Not run; use without `--plan-only` to execute readiness checks.' : '- None.');
  } else {
    for (const blocker of result.blockers) {
      lines.push(`- ${blocker.command}`);
      lines.push(`  - Category: ${blocker.category}`);
      lines.push(`  - Exit: ${blocker.exit_code}`);
      if (blocker.output) lines.push(`  - Output: ${blocker.output.replace(/\s+/g, ' ')}`);
      lines.push(`  - Clears: ${blocker.clears}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildReleaseReadiness(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
    if (result.status === 'blocked') process.exit(1);
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  allowedCommand,
  buildReleaseReadiness,
  commandCategory,
  parseArgs,
  renderMarkdown,
  releaseCheckEnv,
  releaseReadinessCommands,
  runCommand,
};
