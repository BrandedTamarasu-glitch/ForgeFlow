#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { STATIC_FILES, RUNTIME_HELPERS } = require('./install-manifest');
const { TARGETS, buildLeanPortabilityPack } = require('./render-lean-portability-pack');

function usage() {
  console.error('Usage: render-lean-adapter-contract.js [--root <repo>] [--project-dir <dir>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function check(name, ok, detail) {
  return { name, status: ok ? 'pass' : 'fail', detail };
}

function buildLeanAdapterContract(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const plugin = readJson(path.join(root, '.claude-plugin', 'plugin.json'));
  const packageResult = buildLeanPortabilityPack({ root, projectDir, profile: 'balanced' });
  const targetNames = TARGETS.map((target) => target.name);
  const targetFiles = TARGETS.map((target) => target.file);
  const checks = [
    check('portability target matrix includes instruction hosts',
      ['agents', 'cursor', 'windsurf', 'cline', 'copilot', 'copilot-cli', 'kiro', 'opencode', 'gemini-antigravity', 'openclaw', 'generic-skill'].every((name) => targetNames.includes(name)),
      targetNames.join(', ')),
    check('portability target files are unique', new Set(targetFiles).size === targetFiles.length, targetFiles.join(', ')),
    check('generated adapter text carries lean rules', packageResult.targets.every((target) => target.bytes > 300), `${packageResult.targets.length} target(s)`),
    check('lean activation hook is managed static file', STATIC_FILES.has('hooks/forgeflow-lean-activate.js'), 'hooks/forgeflow-lean-activate.js'),
    check('lean activation hook source exists', fs.existsSync(path.join(root, 'hooks', 'forgeflow-lean-activate.js')), 'hooks/forgeflow-lean-activate.js'),
    check('lean runtime helpers are managed',
      ['scripts/forgeflow/lean-config.js', 'scripts/forgeflow/lean-rule-builder.js', 'scripts/forgeflow/render-lean-eval-pack.js'].every((source) => RUNTIME_HELPERS.includes(source)),
      'lean-config.js, lean-rule-builder.js, render-lean-eval-pack.js'),
    check('plugin manifest wires lean activation hook',
      JSON.stringify(plugin).includes('forgeflow-lean-activate.js') && JSON.stringify(plugin).includes('SessionStart') && JSON.stringify(plugin).includes('UserPromptSubmit'),
      '.claude-plugin/plugin.json'),
    check('lean command wrappers exist',
      ['forgeflow-lean-eval', 'forgeflow-lean-portability', 'forgeflow-lean-session', 'forgeflow-lean-mode'].every((name) => fs.existsSync(path.join(root, 'commands', `${name}.md`))),
      'commands/forgeflow-lean-*.md'),
  ];
  const failures = checks.filter((item) => item.status === 'fail').length;
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    status: failures ? 'fail' : 'pass',
    checks,
    adapter_targets: TARGETS,
    summary: { checks: checks.length, failures },
    next: failures ? 'Fix failed lean adapter contract checks before relying on host portability.' : '/forgeflow-lean-portability --write',
    boundary: 'Lean adapter contract is read-only. It validates local files and generated adapter text but does not install adapters, edit settings, commit, push, or call the network.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Lean Adapter Contract',
    '',
    `Status: ${result.status}`,
    `Checks: ${result.summary.checks}`,
    '',
    result.boundary,
    '',
    '## Checks',
    '',
  ];
  for (const item of result.checks) lines.push(`- ${item.status}: ${item.name} (${item.detail})`);
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildLeanAdapterContract(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
    if (result.status === 'fail') process.exit(1);
  } catch (err) {
    console.error(`lean adapter contract failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  buildLeanAdapterContract,
  parseArgs,
  renderMarkdown,
};
