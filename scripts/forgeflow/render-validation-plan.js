#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildValidationFailureCapture } = require('./render-validation-failure-capture');

function usage() {
  console.error('Usage: render-validation-plan.js [--root <repo>] [--json]');
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') opts.root = path.resolve(argv[++i] || '');
    else if (arg === '--json') opts.json = true;
    else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

function changedFiles(root) {
  const tracked = git(['diff', '--name-only', 'HEAD'], root).split(/\r?\n/).filter(Boolean);
  const untracked = git(['ls-files', '--others', '--exclude-standard'], root).split(/\r?\n/).filter(Boolean);
  return [...new Set([...tracked, ...untracked])].sort();
}

function testForScript(root, file) {
  const base = path.basename(file, '.js');
  const direct = `scripts/forgeflow/test-${base}.js`;
  return fs.existsSync(path.join(root, direct)) ? `node ${direct}` : '';
}

function buildValidationPlan(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const files = opts.files || changedFiles(root);
  const commands = new Set();
  for (const file of files) {
    if (/^scripts\/forgeflow\/(?!test-).+\.js$/.test(file)) {
      const direct = testForScript(root, file);
      if (direct) commands.add(direct);
      commands.add('node scripts/forgeflow/test-runtime-helper-contract.js');
    }
    if (/^scripts\/forgeflow\/test-.+\.js$/.test(file)) commands.add(`node ${file}`);
    if (/^commands\//.test(file)) {
      commands.add('node scripts/forgeflow/test-command-coverage.js');
      commands.add('node scripts/forgeflow/test-command-argument-safety.js');
      commands.add('node scripts/forgeflow/test-command-wrapper-smoke.js');
    }
    if (/^(README\.md|docs\/|commands\/)/.test(file)) commands.add('node scripts/forgeflow/test-doc-links.js');
    if (/^(README\.md|docs\/wiki\/Release-|commands\/forgeflow-release-check\.md|\.claude-plugin\/)/.test(file)) commands.add('node scripts/forgeflow/test-release-version.js');
    if (/^scripts\/forgeflow\/install-manifest\.js$/.test(file)) commands.add('node scripts/forgeflow/test-install-manifest.js');
    if (/^scripts\/forgeflow\/update-forgeflow\.js$/.test(file)) commands.add('node scripts/forgeflow/test-update-forgeflow.js');
  }
  commands.add('git diff --check');
  const commandList = [...commands];
  const fullRequired = files.some((file) => /^\.claude-plugin\//.test(file) || /^scripts\/forgeflow\/(install-manifest|update-forgeflow|health-check|smoke-check|build-context-pack)\.js$/.test(file));
  const fullSuiteCommand = fullRequired ? 'for test_file in scripts/forgeflow/test-*.js; do node "$test_file" || exit 1; done' : '';
  const sourceSmokeRequired = fullRequired || files.some((file) => /^commands\/|^docs\/|^README\.md/.test(file));
  const sourceSmokeCommand = 'node scripts/forgeflow/smoke-check.js --mode source --json';
  const failureCommands = [...commandList, fullSuiteCommand, sourceSmokeRequired ? sourceSmokeCommand : '']
    .filter(Boolean)
    .map((command) => {
      const plan = buildValidationFailureCapture({ root, command });
      return {
        command,
        mode: plan.mode,
        raw_required: plan.raw_required,
        next: plan.next,
        reason: plan.reason,
        recorder_prompt: plan.recorder_prompt,
      };
    });
  return {
    schema_version: '1',
    status: files.length ? 'planned' : 'no-changes',
    root,
    files,
    commands: commandList,
    full_suite_required: fullRequired,
    full_suite_command: fullSuiteCommand,
    source_smoke_required: sourceSmokeRequired,
    source_smoke_command: sourceSmokeCommand,
    failure_capture_commands: failureCommands,
    boundary: 'Validation plan is read-only. It recommends commands from changed files but does not run tests, commit, or push.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Validation Plan',
    '',
    `Status: ${result.status}`,
    `Changed files: ${result.files.length}`,
    '',
    result.boundary,
    '',
    '## Focused Commands',
    '',
    ...(result.commands.length ? result.commands.map((cmd) => `- ${cmd}`) : ['- None.']),
  ];
  if (result.full_suite_required) lines.push('', `Full suite: ${result.full_suite_command}`);
  if (result.source_smoke_required) lines.push(`Source smoke: ${result.source_smoke_command}`);
  lines.push('', '## If A Command Fails', '');
  for (const item of result.failure_capture_commands.slice(0, 12)) {
    lines.push(`- ${item.command}: ${item.raw_required ? 'keep raw' : item.next}`);
    if (item.recorder_prompt) lines.push(`  - ${item.recorder_prompt}`);
  }
  if (result.failure_capture_commands.length > 12) lines.push(`- ... ${result.failure_capture_commands.length - 12} more`);
  lines.push('');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildValidationPlan(opts);
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

module.exports = { buildValidationPlan, parseArgs, renderMarkdown };
