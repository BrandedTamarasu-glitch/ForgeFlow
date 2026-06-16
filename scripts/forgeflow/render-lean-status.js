#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { safeReadTextFile } = require('./file-safety');

const PROFILES = new Set(['off', 'lite', 'balanced', 'strict', 'ultra']);

function usage() {
  console.error('Usage: render-lean-status.js [--root <repo>] [--project-dir <dir>] [--json]');
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

function readJson(file, projectDir) {
  if (!fs.existsSync(file)) return { status: 'missing', path: file, value: null };
  try {
    const value = JSON.parse(safeReadTextFile(file, projectDir).content);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected JSON object');
    return { status: 'present', path: file, value };
  } catch (err) {
    return { status: 'invalid', path: file, value: null, reason: err.message };
  }
}

function readText(file, root) {
  if (!fs.existsSync(file)) return '';
  try {
    return safeReadTextFile(file, root).content;
  } catch (_err) {
    return '';
  }
}

function fileState(file, root) {
  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) return { status: 'missing', path: resolved };
  try {
    const stat = fs.lstatSync(resolved);
    return {
      status: stat.isFile() && !stat.isSymbolicLink() ? 'present' : 'invalid',
      path: resolved,
      executable: Boolean(stat.mode & 0o111),
    };
  } catch (err) {
    return { status: 'invalid', path: resolved, reason: err.message };
  }
}

function effectivePolicy(source) {
  const value = source.value || {};
  const rawProfile = String(value.profile || 'balanced').toLowerCase();
  const profile = PROFILES.has(rawProfile) ? rawProfile : 'balanced';
  const enabled = profile !== 'off' && value.enabled !== false;
  return {
    status: source.status,
    profile,
    enabled,
    valid: source.status !== 'invalid',
    source: source.status === 'present' ? 'lean-policy' : 'default',
  };
}

function leanReportReady(report) {
  const value = report.value || {};
  return value.status === 'ready' && value.lean_decision === 'continue-dogfood';
}

function profileStatus(source) {
  const value = source.value || {};
  return value.check && value.check.status ? value.check.status : (source.status === 'present' ? 'unknown' : source.status);
}

function latestInsightsInjected(source) {
  const value = source.value || {};
  return value.status === 'injected' || value.latest_insights_readiness?.status === 'injected';
}

function helperAvailable(root, helper) {
  return fileState(path.join(root, 'scripts', 'forgeflow', helper), root);
}

function commandContains(root, command, needles) {
  const file = path.join(root, 'commands', command);
  const text = readText(file, root);
  return {
    status: text ? 'present' : 'missing',
    path: file,
    wired: needles.every((needle) => text.includes(needle)),
  };
}

function automationStatus(root) {
  return {
    consult: commandContains(root, 'consult.md', ['render-lean-decision.js', 'LEAN_DECISION_PATH']),
    implement: commandContains(root, 'implement.md', ['render-lean-decision.js', 'record-implementation-notes.js --lean-decision']),
    review: commandContains(root, 'review.md', ['render-lean-review.js', 'Lean Review Advisory']),
    ship: commandContains(root, 'ship.md', ['Lean readiness advisory', 'LEAN_DECISION_JSON_PATH']),
  };
}

function buildLeanStatus(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = safeProjectDir(opts.projectDir || defaultProjectDir(root));
  const contextDir = path.join(projectDir, 'context');
  const latestDir = path.join(contextDir, 'latest');
  const sources = {
    policy: readJson(path.join(contextDir, 'lean-policy.json'), projectDir),
    decision: readJson(path.join(contextDir, 'lean-decision.json'), projectDir),
    report: readJson(path.join(contextDir, 'lean-report.json'), projectDir),
    latestInsights: readJson(path.join(latestDir, 'latest-insights-report.json'), projectDir),
    profile: readJson(path.join(latestDir, 'user-profile-report.json'), projectDir),
    operatingModel: readJson(path.join(contextDir, 'project-operating-model.json'), projectDir),
  };
  const policy = effectivePolicy(sources.policy);
  const helpers = {
    leanDecision: helperAvailable(root, 'render-lean-decision.js'),
    leanMode: helperAvailable(root, 'render-lean-mode.js'),
    leanReport: helperAvailable(root, 'render-lean-report.js'),
    leanReview: helperAvailable(root, 'render-lean-review.js'),
  };
  const automation = automationStatus(root);
  const gates = {
    lean_policy_valid: policy.valid,
    lean_policy_allows_guidance: policy.enabled,
    lean_decision_present: sources.decision.status === 'present',
    lean_report_present: sources.report.status === 'present',
    lean_report_ready: leanReportReady(sources.report),
    latest_insights_injected: latestInsightsInjected(sources.latestInsights),
    profile_not_failing: profileStatus(sources.profile) !== 'fail',
    operating_model_present: sources.operatingModel.status === 'present',
    telemetry_ready: sources.report.value?.signals?.telemetry?.status === 'ready',
  };
  const blocked = Object.entries(gates).filter(([, ok]) => !ok).map(([name]) => name);
  const autoMissing = Object.entries(automation).filter(([, item]) => !item.wired).map(([name]) => name);
  const helperMissing = Object.entries(helpers).filter(([, item]) => item.status !== 'present').map(([name]) => name);
  const injectionEligible = blocked.length === 0;
  const status = helperMissing.length ? 'attention' : (injectionEligible && autoMissing.length === 0 ? 'active' : (policy.enabled ? 'blocked' : 'off'));
  const next = nextAction({ policy, blocked, autoMissing, helperMissing });
  return {
    schema_version: '1',
    generated_at: isoNow(),
    root,
    project_dir: projectDir,
    status,
    lean_mode: policy.profile,
    enabled: policy.enabled,
    injection_eligible: injectionEligible,
    reason: injectionEligible ? 'lean-guidance-quality-gates-passing' : `lean-guidance-gates-blocked:${blocked.join(',')}`,
    gates,
    sources: Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, { status: source.status, path: source.path, reason: source.reason || '' }])),
    helpers,
    automation,
    missing_helpers: helperMissing,
    missing_automation: autoMissing,
    next: next.command,
    next_reason: next.reason,
    boundary: 'Lean status is read-only. It reports advisory activation state only and never edits settings, rebuilds context, changes routing, commits, pushes, or calls the network.',
  };
}

function nextAction({ policy, blocked, autoMissing, helperMissing }) {
  if (helperMissing.length) return { command: '/update-forgeflow --repair', reason: `Missing lean helper(s): ${helperMissing.join(', ')}.` };
  if (!policy.enabled) return { command: '/forgeflow-lean-mode --profile balanced --write', reason: 'Lean mode is off for this project.' };
  if (autoMissing.length) return { command: '/update-forgeflow --repair', reason: `Lean command integration is missing for: ${autoMissing.join(', ')}.` };
  if (blocked.includes('lean_decision_present')) return { command: '/forgeflow-lean-decision --task "<work item>"', reason: 'Lean decision evidence is missing.' };
  if (blocked.includes('lean_report_present') || blocked.includes('lean_report_ready') || blocked.includes('telemetry_ready')) return { command: '/forgeflow-lean-report --write', reason: 'Lean report or telemetry readiness is missing.' };
  if (blocked.includes('latest_insights_injected')) return { command: '/forgeflow-trends --refresh', reason: 'Latest insights are not injected.' };
  if (blocked.includes('profile_not_failing')) return { command: '/forgeflow-profile --check', reason: 'User profile gate is failing.' };
  if (blocked.includes('operating_model_present')) return { command: '/forgeflow-project-model --write', reason: 'Project operating model is missing.' };
  return { command: '/review', reason: 'Lean guidance is eligible for advisory context injection.' };
}

function renderMarkdown(result) {
  const gateLines = Object.entries(result.gates).map(([name, ok]) => `- ${name}: ${ok ? 'pass' : 'blocked'}`);
  const autoLines = Object.entries(result.automation).map(([name, item]) => `- ${name}: ${item.wired ? 'wired' : 'missing'} (${item.path})`);
  return [
    '# Forgeflow Lean Status',
    '',
    `Status: ${result.status}`,
    `Lean mode: ${result.lean_mode}`,
    `Guidance enabled: ${result.enabled ? 'yes' : 'no'}`,
    `Context injection eligible: ${result.injection_eligible ? 'yes' : 'no'}`,
    '',
    result.boundary,
    '',
    '## Gates',
    '',
    ...gateLines,
    '',
    '## Automation',
    '',
    ...autoLines,
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
    const result = buildLeanStatus(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  } catch (err) {
    console.error(`lean status failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  buildLeanStatus,
  effectivePolicy,
  parseArgs,
  renderMarkdown,
};
