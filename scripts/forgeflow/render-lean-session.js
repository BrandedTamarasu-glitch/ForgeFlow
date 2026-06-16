#!/usr/bin/env node
const path = require('path');
const { resolveLeanProfile: resolveProfile } = require('./lean-config');
const { STOP_PHRASES, instructionLines } = require('./lean-rule-builder');

function usage() {
  console.error('Usage: render-lean-session.js [--root <repo>] [--project-dir <dir>] [--profile lite|off|balanced|strict|ultra] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', profile: '', json: false };
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

function resolveLeanProfile(opts = {}) {
  const resolved = resolveProfile(opts);
  return { profile: resolved.profile, source: resolved.source };
}

function buildLeanSession(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || path.join(root, '.forgeflow', path.basename(root)));
  const resolved = resolveLeanProfile({ ...opts, root, projectDir });
  const enabled = resolved.profile !== 'off';
  const instructions = instructionLines(resolved.profile).join('\n');
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    status: enabled ? 'ready' : 'off',
    profile: resolved.profile,
    source: resolved.source,
    enabled,
    statusline: enabled ? `LEAN:${resolved.profile}` : 'LEAN:off',
    stop_phrases: STOP_PHRASES,
    instructions,
    boundary: 'Lean session guidance is display-only. It does not edit settings, install hooks, mutate context, change routing, commit, push, or call the network.',
  };
}

function renderMarkdown(result) {
  return [
    '# Forgeflow Lean Session',
    '',
    `Status: ${result.status}`,
    `Profile: ${result.profile}`,
    `Source: ${result.source}`,
    `Statusline: ${result.statusline}`,
    '',
    result.boundary,
    '',
    '## Instructions',
    '',
    result.instructions,
    '',
  ].join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildLeanSession(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  } catch (err) {
    console.error(`lean session failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  buildLeanSession,
  instructionLines,
  parseArgs,
  renderMarkdown,
  resolveLeanProfile,
};
