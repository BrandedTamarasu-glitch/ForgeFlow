#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { safeReadTextFile, writeJsonSafe } = require('./file-safety');

const PROFILES = {
  off: {
    enabled: false,
    label: 'off',
    behavior: 'Do not inject lean guidance into context packs.',
    guidance: 'Lean checks stay available as explicit commands only.',
    max_guidance_tokens: 0,
  },
  lite: {
    enabled: true,
    label: 'lite',
    behavior: 'Build what was asked, but name the smaller lean alternative in one concise line.',
    guidance: 'Use lite when the team wants visibility into lean options without having lean guidance steer implementation.',
    max_guidance_tokens: 900,
  },
  balanced: {
    enabled: true,
    label: 'balanced',
    behavior: 'Prefer reuse, native, standard-library, and project-pattern checks before custom code.',
    guidance: 'Keep lean guidance advisory and preserve explicit requirements, safety, accessibility, validation, and data-loss safeguards.',
    max_guidance_tokens: 2200,
  },
  strict: {
    enabled: true,
    label: 'strict',
    behavior: 'Require a clear reason before adding abstractions, dependencies, broad wrappers, or future-proofing.',
    guidance: 'Use the smallest project-consistent change unless the spec, second caller, or validation evidence justifies expansion.',
    max_guidance_tokens: 1800,
  },
  ultra: {
    enabled: true,
    label: 'ultra',
    behavior: 'Challenge every new file, dependency, abstraction, and long explanation before implementation.',
    guidance: 'Still do not simplify security, accessibility, trust-boundary validation, data-loss prevention, tests, or explicit user requirements.',
    max_guidance_tokens: 1400,
  },
};

function normalizeProfile(profile) {
  const normalized = String(profile || '').trim().toLowerCase();
  if (!normalized) return '';
  if (!PROFILES[normalized]) throw new Error(`Unsupported lean profile: ${profile}`);
  return normalized;
}

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function configDir(env = process.env, platform = process.platform, homedir = os.homedir()) {
  if (env.FORGEFLOW_CONFIG_HOME) return path.join(env.FORGEFLOW_CONFIG_HOME, 'forgeflow');
  if (env.XDG_CONFIG_HOME) return path.join(env.XDG_CONFIG_HOME, 'forgeflow');
  if (platform === 'win32') {
    return path.join(env.APPDATA || path.join(homedir, 'AppData', 'Roaming'), 'forgeflow');
  }
  return path.join(homedir, '.config', 'forgeflow');
}

function userLeanConfigPath(opts = {}) {
  return path.join(configDir(opts.env || process.env, opts.platform || process.platform, opts.homedir || os.homedir()), 'lean.json');
}

function projectPolicyPath(projectDir) {
  return path.join(projectDir, 'context', 'lean-policy.json');
}

function readJsonIfPresent(file, safeRoot) {
  if (!fs.existsSync(file)) return null;
  try {
    const content = safeRoot ? safeReadTextFile(file, safeRoot).content : fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (_err) {
    return null;
  }
}

function readProjectPolicy(projectDir) {
  return readJsonIfPresent(projectPolicyPath(projectDir), projectDir);
}

function readUserLeanConfig(opts = {}) {
  return readJsonIfPresent(userLeanConfigPath(opts));
}

function envDefault(env = process.env) {
  try {
    return normalizeProfile(env.FORGEFLOW_LEAN_DEFAULT_MODE || '');
  } catch (_err) {
    return '';
  }
}

function profileFromRecord(record) {
  if (!record || !record.profile) return '';
  return normalizeProfile(record.profile);
}

function resolveLeanProfile(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const explicit = opts.profile ? normalizeProfile(opts.profile) : '';
  if (explicit) return { profile: explicit, source: 'requested', projectDir, root };

  const projectPolicy = readProjectPolicy(projectDir);
  try {
    const projectProfile = profileFromRecord(projectPolicy);
    if (projectProfile) return { profile: projectProfile, source: 'project-policy', projectDir, root };
  } catch (_err) {
    return { profile: 'balanced', source: 'invalid-project-policy', projectDir, root };
  }

  const fromEnv = envDefault(opts.env || process.env);
  if (fromEnv) return { profile: fromEnv, source: 'FORGEFLOW_LEAN_DEFAULT_MODE', projectDir, root };

  const userConfig = readUserLeanConfig(opts);
  try {
    const userProfile = profileFromRecord(userConfig);
    if (userProfile) return { profile: userProfile, source: 'user-config', projectDir, root };
  } catch (_err) {
    return { profile: 'balanced', source: 'invalid-user-config', projectDir, root };
  }

  return { profile: 'balanced', source: 'default', projectDir, root };
}

function writeUserLeanConfig(profile, opts = {}) {
  const normalized = normalizeProfile(profile);
  if (!normalized) throw new Error('Missing lean profile');
  const file = userLeanConfigPath(opts);
  const value = {
    schema_version: '1',
    profile: normalized,
    updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
  writeJsonSafe(file, value);
  return { path: file, config: value };
}

module.exports = {
  PROFILES,
  configDir,
  defaultProjectDir,
  envDefault,
  normalizeProfile,
  projectPolicyPath,
  readProjectPolicy,
  readUserLeanConfig,
  resolveLeanProfile,
  userLeanConfigPath,
  writeUserLeanConfig,
};
