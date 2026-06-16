#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  PROFILES,
  buildLeanMode,
  normalizeProfile,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-mode');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-mode-'));
const projectDir = path.join(root, '.forgeflow', 'Demo');
const balanced = buildLeanMode({ root, projectDir });
const strict = buildLeanMode({ root, projectDir, profile: 'strict', write: true });
const reread = buildLeanMode({ root, projectDir });
const off = buildLeanMode({ root, projectDir, profile: 'off' });
const lite = buildLeanMode({ root, projectDir, profile: 'lite' });
const markdown = renderMarkdown(strict);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--profile', 'ultra', '--write', '--user', '--json']);
const userConfigHome = path.join(root, 'user-config-home');
process.env.FORGEFLOW_CONFIG_HOME = userConfigHome;
const userWrite = buildLeanMode({ root, projectDir, profile: 'lite', write: true, user: true });
delete process.env.FORGEFLOW_CONFIG_HOME;

let invalidRejected = false;
try {
  normalizeProfile('max');
} catch (_err) {
  invalidRejected = true;
}

let symlinkRejected = false;
const symlinkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-mode-link-'));
const symlinkProject = path.join(symlinkRoot, '.forgeflow', 'Demo');
fs.mkdirSync(path.dirname(symlinkProject), { recursive: true });
fs.symlinkSync(root, symlinkProject);
try {
  buildLeanMode({ root: symlinkRoot, projectDir: symlinkProject });
} catch (_err) {
  symlinkRejected = true;
}

const writtenJson = path.join(projectDir, 'context', 'lean-policy.json');
const writtenMarkdown = path.join(projectDir, 'context', 'lean-policy.md');
const checks = [
  ['default profile is balanced', balanced.profile === 'balanced' && balanced.source === 'default' && balanced.enabled],
  ['writes policy artifacts', fs.existsSync(writtenJson) && fs.existsSync(writtenMarkdown)],
  ['rereads existing policy', reread.profile === 'strict' && reread.source === 'existing-policy'],
  ['off disables guidance', off.profile === 'off' && !off.enabled && off.max_guidance_tokens === 0],
  ['lite profile is advisory alternative mode', lite.profile === 'lite' && lite.enabled && lite.guidance.includes('visibility')],
  ['user write creates user config', userWrite.artifacts.user_config === path.join(userConfigHome, 'forgeflow', 'lean.json') && fs.existsSync(userWrite.artifacts.user_config)],
  ['strict profile is tighter than balanced', PROFILES.strict.max_guidance_tokens < PROFILES.balanced.max_guidance_tokens],
  ['preview preserves requested profile in next action', off.next.includes('--profile off --write')],
  ['markdown renders boundaries', markdown.includes('Profile: strict') && markdown.includes('does not edit code')],
  ['parser supports profile/write/user/json', opts.profile === 'ultra' && opts.write && opts.user && opts.json],
  ['invalid profile rejected', invalidRejected],
  ['symlink project rejected', symlinkRejected],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error(`FAIL: ${name}`);
  process.exit(1);
}

console.log('lean mode: ok');
