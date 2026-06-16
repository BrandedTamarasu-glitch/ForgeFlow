#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { isPathInside, safeReadTextFile, writeFileSafe, writeJsonSafe } = require('./file-safety');
const {
  PROFILES,
  defaultProjectDir,
  envDefault,
  normalizeProfile,
  readUserLeanConfig,
  userLeanConfigPath,
  writeUserLeanConfig,
} = require('./lean-config');

function usage() {
  console.error('Usage: render-lean-mode.js [--root <repo>] [--project-dir <dir>] [--profile lite|off|balanced|strict|ultra] [--write] [--user] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', profile: '', write: false, user: false, json: false };
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
    } else if (arg === '--user') {
      opts.user = true;
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

function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function safeProjectDir(projectDir) {
  const resolved = path.resolve(projectDir);
  if (!fs.existsSync(resolved)) return resolved;
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error(`Refusing symlinked project directory: ${projectDir}`);
  if (!stat.isDirectory()) throw new Error(`Project directory is not a directory: ${projectDir}`);
  return resolved;
}

function policyPath(projectDir, basename) {
  const file = path.join(projectDir, 'context', basename);
  const resolved = path.resolve(file);
  if (!isPathInside(path.resolve(projectDir), resolved)) throw new Error('Lean mode output must stay inside --project-dir');
  return resolved;
}

function defaultProfile() {
  return envDefault() || 'balanced';
}

function readExistingPolicy(projectDir) {
  const file = policyPath(projectDir, 'lean-policy.json');
  if (!fs.existsSync(file)) return null;
  const value = JSON.parse(safeReadTextFile(file, projectDir).content);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Existing lean policy must be a JSON object');
  return value;
}

function buildLeanMode(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = safeProjectDir(opts.projectDir || defaultProjectDir(root));
  const requestedProfile = normalizeProfile(opts.profile || '');
  const existing = readExistingPolicy(projectDir);
  const userConfig = readUserLeanConfig();
  const userProfile = normalizeProfile(userConfig && userConfig.profile);
  const fromEnv = envDefault();
  const profile = requestedProfile || normalizeProfile(existing && existing.profile) || fromEnv || userProfile || 'balanced';
  const definition = PROFILES[profile];
  const result = {
    schema_version: '1',
    generated_at: isoNow(),
    root,
    project_dir: projectDir,
    status: 'ready',
    profile,
    enabled: definition.enabled,
    mode: definition.label,
    behavior: definition.behavior,
    guidance: definition.guidance,
    max_guidance_tokens: definition.max_guidance_tokens,
    available_profiles: Object.keys(PROFILES),
    source: requestedProfile ? 'requested' : (existing ? 'existing-policy' : (fromEnv ? 'FORGEFLOW_LEAN_DEFAULT_MODE' : (userProfile ? 'user-config' : 'default'))),
    boundary: 'Lean mode is advisory. It does not edit code, remove dependencies, shrink validation, change routing, commit, push, or call the network.',
    next: requestedProfile && opts.write ? '/forgeflow-lean-decision --task "<work item>"' : `/forgeflow-lean-mode --profile ${profile} --write`,
    next_reason: requestedProfile && opts.write ? 'Lean mode was persisted for this project.' : 'Persist a project lean profile when you want context packs to carry a stable preference.',
    artifacts: {},
  };
  if (opts.write && opts.user) {
    const written = writeUserLeanConfig(profile);
    result.artifacts = { user_config: written.path };
    result.next = '/forgeflow-lean-session';
    result.next_reason = 'User-level lean default was persisted.';
  } else if (opts.write) {
    const jsonPath = policyPath(projectDir, 'lean-policy.json');
    const markdownPath = policyPath(projectDir, 'lean-policy.md');
    writeJsonSafe(jsonPath, result);
    writeFileSafe(markdownPath, renderMarkdown(result));
    result.artifacts = { json: jsonPath, markdown: markdownPath };
  }
  result.user_config_path = userLeanConfigPath();
  return result;
}

function renderMarkdown(result) {
  return [
    '# Forgeflow Lean Mode',
    '',
    `Status: ${result.status}`,
    `Profile: ${result.profile}`,
    `Enabled: ${result.enabled ? 'yes' : 'no'}`,
    `Source: ${result.source}`,
    `User config: ${result.user_config_path}`,
    '',
    result.boundary,
    '',
    '## Behavior',
    '',
    `- ${result.behavior}`,
    `- ${result.guidance}`,
    `- Context guidance token target: ${result.max_guidance_tokens}`,
    '',
    '## Available Profiles',
    '',
    ...result.available_profiles.map((profile) => `- ${profile}`),
    '',
    '## Next',
    '',
    `${result.next} - ${result.next_reason}`,
    '',
  ].join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildLeanMode(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  } catch (err) {
    console.error(`lean mode failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  PROFILES,
  buildLeanMode,
  defaultProfile,
  normalizeProfile,
  parseArgs,
  renderMarkdown,
};
