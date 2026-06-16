#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { writeFileSafe, writeJsonSafe } = require('./file-safety');
const { TARGETS, buildLeanPortabilityPack } = require('./render-lean-portability-pack');

const HOSTS = [
  { host: 'Claude Code', tier: 'plugin', target: 'agents', install: 'Wire forgeflow-lean-activate.js in SessionStart/UserPromptSubmit and forgeflow-statusline.js as statusLine.' },
  { host: 'Codex', tier: 'plugin', target: 'generic-skill', install: 'Install Forgeflow plugin/runtime helpers, then use lean skills or generated skill rule.' },
  { host: 'OpenCode', tier: 'adapter', target: 'opencode', install: 'Copy opencode-lean.md into OpenCode project rules or plugin prompt transform.' },
  { host: 'Gemini/Antigravity', tier: 'adapter', target: 'gemini-antigravity', install: 'Copy gemini-antigravity-lean.md to AGENTS.md or the host rules location.' },
  { host: 'Cursor', tier: 'instruction', target: 'cursor', install: 'Copy cursor-lean.mdc to .cursor/rules/.' },
  { host: 'Windsurf', tier: 'instruction', target: 'windsurf', install: 'Copy windsurf-lean.md to .windsurf/rules/.' },
  { host: 'Cline', tier: 'instruction', target: 'cline', install: 'Copy clinerules-lean.md to .clinerules/.' },
  { host: 'GitHub Copilot', tier: 'instruction', target: 'copilot', install: 'Copy copilot-instructions-lean.md to .github/copilot-instructions.md.' },
  { host: 'Copilot CLI', tier: 'instruction', target: 'copilot-cli', install: 'Copy copilot-cli-lean.md to AGENTS.md, .github/copilot-instructions.md, or ~/.copilot/copilot-instructions.md.' },
  { host: 'Kiro', tier: 'instruction', target: 'kiro', install: 'Copy kiro-steering-lean.md to .kiro/steering/ or ~/.kiro/steering/.' },
  { host: 'OpenClaw', tier: 'skill', target: 'openclaw', install: 'Copy openclaw-lean-skill.md to the OpenClaw skills directory.' },
];

function usage() {
  console.error('Usage: render-lean-host-packages.js [--root <repo>] [--project-dir <dir>] [--profile lite|off|balanced|strict|ultra] [--write] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', profile: '', write: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--profile') {
      opts.profile = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--write') {
      opts.write = true;
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

function packageDir(projectDir) {
  return path.join(projectDir, 'lean-packages');
}

function buildLeanHostPackages(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const pack = buildLeanPortabilityPack({ root, projectDir, profile: opts.profile || '', write: false });
  const targetsByName = new Map(TARGETS.map((target) => [target.name, target.file]));
  const outDir = packageDir(projectDir);
  const hosts = HOSTS.map((host) => ({
    ...host,
    source_file: targetsByName.get(host.target) || '',
    status: targetsByName.has(host.target) ? 'ready' : 'missing-target',
  }));
  const manifest = {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    profile: pack.profile,
    hosts,
    boundary: 'Lean host package manifest is local guidance. It does not install adapters, edit host settings, commit, push, or call the network.',
  };
  const artifacts = {};
  if (opts.write) {
    writeJsonSafe(path.join(outDir, 'manifest.json'), manifest);
    writeFileSafe(path.join(outDir, 'README.md'), renderPackageReadme(manifest));
    artifacts.json = path.join(outDir, 'manifest.json');
    artifacts.markdown = path.join(outDir, 'README.md');
  }
  const failures = hosts.filter((host) => host.status !== 'ready').length;
  return {
    ...manifest,
    root,
    project_dir: projectDir,
    out_dir: outDir,
    status: failures ? 'fail' : 'pass',
    artifacts,
    summary: { hosts: hosts.length, failures },
    next: opts.write ? '/forgeflow-lean-portability --write' : '/forgeflow-lean-host-packages --write',
  };
}

function renderPackageReadme(manifest) {
  const lines = ['# Forgeflow Lean Host Packages', '', `Profile: ${manifest.profile}`, '', manifest.boundary, '', '## Hosts', ''];
  for (const host of manifest.hosts) lines.push(`- ${host.host}: ${host.source_file} (${host.tier}) - ${host.install}`);
  lines.push('');
  return lines.join('\n');
}

function renderMarkdown(result) {
  const lines = ['# Forgeflow Lean Host Packages', '', `Status: ${result.status}`, `Output: ${result.out_dir}`, '', result.boundary, '', '## Hosts', ''];
  for (const host of result.hosts) lines.push(`- ${host.status}: ${host.host} -> ${host.source_file}`);
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildLeanHostPackages(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
    if (result.status === 'fail') process.exit(1);
  } catch (err) {
    console.error(`lean host packages failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  HOSTS,
  buildLeanHostPackages,
  parseArgs,
  renderMarkdown,
  renderPackageReadme,
};
