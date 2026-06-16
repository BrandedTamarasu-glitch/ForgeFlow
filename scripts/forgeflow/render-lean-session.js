#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { safeReadTextFile } = require('./file-safety');
const { PROFILES, normalizeProfile } = require('./render-lean-mode');

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

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function policyPath(projectDir) {
  return path.join(projectDir, 'context', 'lean-policy.json');
}

function readPolicy(projectDir) {
  const file = policyPath(projectDir);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(safeReadTextFile(file, projectDir).content);
  } catch (_err) {
    return null;
  }
}

function envDefault() {
  try {
    return normalizeProfile(process.env.FORGEFLOW_LEAN_DEFAULT_MODE || '');
  } catch (_err) {
    return '';
  }
}

function resolveLeanProfile(opts = {}) {
  const explicit = opts.profile ? normalizeProfile(opts.profile) : '';
  if (explicit) return { profile: explicit, source: 'requested' };
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const policy = readPolicy(projectDir);
  if (policy && policy.profile) {
    try {
      return { profile: normalizeProfile(policy.profile) || 'balanced', source: 'project-policy' };
    } catch (_err) {
      return { profile: 'balanced', source: 'invalid-project-policy' };
    }
  }
  const fromEnv = envDefault();
  if (fromEnv) return { profile: fromEnv, source: 'FORGEFLOW_LEAN_DEFAULT_MODE' };
  return { profile: 'balanced', source: 'default' };
}

function instructionLines(profile) {
  if (profile === 'off') return ['Forgeflow lean guidance is off for this project.'];
  const definition = PROFILES[profile] || PROFILES.balanced;
  const lines = [
    `FORGEFLOW LEAN SESSION ACTIVE - profile: ${profile}`,
    '',
    definition.behavior,
    definition.guidance,
    '',
    'Before custom code, check: current need, stdlib, native platform, installed dependencies, project patterns, then minimum custom code.',
    'Prefer deletion, direct code, and fewer files when current requirements allow it.',
    'For complex requests, take the smallest safe path and name the fuller path only when the user needs it.',
    '',
    'Do not simplify away security, accessibility, trust-boundary validation, data-loss prevention, explicit requirements, calibration/tuning knobs, or one focused check for non-trivial logic.',
    'Use implementation notes or lean markers for known ceilings and upgrade triggers.',
    'This guidance is advisory; current user instructions, code evidence, tests, and review findings win.',
  ];
  if (profile === 'lite') {
    lines.splice(5, 0, 'Lite mode: build what was asked, but name the smaller alternative in one concise line.');
  }
  return lines;
}

function buildLeanSession(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
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
    stop_phrases: ['normal mode', 'stop lean', 'lean off'],
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
