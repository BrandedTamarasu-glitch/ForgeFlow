#!/usr/bin/env node
const path = require('path');
const { writeFileSafe, writeJsonSafe } = require('./file-safety');
const { buildLeanMode } = require('./render-lean-mode');
const { buildLeanStatus } = require('./render-lean-status');
const { buildLeanReport } = require('./render-lean-report');
const { buildTelemetryQuality } = require('./render-telemetry-quality');
const { buildLeanDecision, renderMarkdown: renderLeanDecisionMarkdown } = require('./render-lean-decision');

function usage() {
  console.error('Usage: render-lean-prime.js [--root <repo>] [--project-dir <dir>] [--task <text>] [--prime-task <text>] [--write-plan] [--write-report] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', task: '', primeTask: '', writePlan: false, writeReport: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--task') {
      opts.task = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--prime-task') {
      opts.primeTask = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--write-plan') {
      opts.writePlan = true;
    } else if (arg === '--write-report') {
      opts.writeReport = true;
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

function step(id, label, status, next, reason) {
  return { id, label, status, next: next || '', reason: reason || '' };
}

function commandOrFallback(value, fallback) {
  const text = String(value || '').trim();
  return /^\/[A-Za-z0-9][A-Za-z0-9:/_-]*(?:\s|$)/.test(text) ? text : fallback;
}

function modeStep(mode) {
  return step(
    'mode',
    'Lean mode',
    mode.enabled ? 'ready' : 'off',
    mode.enabled ? '' : '/forgeflow-lean-mode --profile balanced --write',
    mode.enabled ? `Effective profile is ${mode.profile}.` : 'Lean guidance is off.'
  );
}

function decisionStep(status) {
  const present = status.gates?.lean_decision_present === true;
  return step(
    'decision',
    'Lean decision evidence',
    present ? 'ready' : 'missing',
    present ? '' : '/forgeflow-lean-decision --task "<work item>"',
    present ? 'Lean decision artifact is present.' : 'Record the current work item before relying on context-pack lean guidance.'
  );
}

function reportStep(status, report) {
  const present = status.gates?.lean_report_present === true;
  const ready = status.gates?.lean_report_ready === true;
  return step(
    'report',
    'Lean report evidence',
    ready ? 'ready' : (present ? 'watch' : 'missing'),
    ready ? '' : '/forgeflow-lean-report --write',
    ready ? 'Lean report is present and ready.' : (report.reason || 'Write a local aggregate lean report.')
  );
}

function telemetryStep(status, telemetry) {
  const ready = status.gates?.telemetry_ready === true;
  const next = ready ? '' : commandOrFallback(telemetry.next, '/forgeflow-telemetry-quality');
  return step(
    'telemetry',
    'Telemetry quality',
    ready ? 'ready' : 'watch',
    next,
    ready ? 'Telemetry is ready for advisory injection gates.' : (telemetry.reason || 'Telemetry is still too thin for automatic lean context injection.')
  );
}

function planCommands(result, task) {
  const commands = [];
  if (!result.enabled) commands.push('/forgeflow-lean-mode --profile balanced --write');
  const decision = result.steps.find((item) => item.id === 'decision');
  if (decision && decision.status !== 'ready') {
    commands.push(task ? `/forgeflow-lean-decision --task ${JSON.stringify(task)}` : '/forgeflow-lean-decision --task "<work item>"');
  }
  const report = result.steps.find((item) => item.id === 'report');
  if (report && report.status !== 'ready') commands.push('/forgeflow-lean-report --write');
  commands.push('/forgeflow-lean-status');
  return [...new Set(commands)];
}

function injectionStep(status) {
  return step(
    'injection',
    'Context-pack injection',
    status.injection_eligible ? 'ready' : 'blocked',
    status.injection_eligible ? '' : status.next,
    status.injection_eligible ? 'Lean guidance is eligible for context packs.' : status.next_reason || status.reason
  );
}

function buildLeanPrime(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const task = opts.primeTask || opts.task || '';
  const artifacts = {};
  if (opts.primeTask) {
    const decision = buildLeanDecision({ root, projectDir, task: opts.primeTask });
    const decisionJsonPath = path.join(projectDir, 'context', 'lean-decision.json');
    const decisionMarkdownPath = path.join(projectDir, 'context', 'lean-decision.md');
    writeJsonSafe(decisionJsonPath, decision);
    writeFileSafe(decisionMarkdownPath, renderLeanDecisionMarkdown(decision));
    artifacts.lean_decision_json = decisionJsonPath;
    artifacts.lean_decision_markdown = decisionMarkdownPath;
  }
  const mode = buildLeanMode({ root, projectDir });
  const report = buildLeanReport({ root, projectDir, write: opts.writeReport });
  const status = buildLeanStatus({ root, projectDir });
  const telemetry = buildTelemetryQuality({ root, projectDir });
  const steps = [
    modeStep(mode),
    decisionStep(status),
    reportStep(status, report),
    telemetryStep(status, telemetry),
    injectionStep(status),
  ];
  const next = steps.find((item) => item.next)?.next || '';
  const blockers = steps.filter((item) => ['missing', 'blocked', 'attention', 'off'].includes(item.status));
  const result = {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    status: blockers.length ? 'blocked' : 'ready',
    profile: mode.profile,
    enabled: mode.enabled,
    steps,
    next: task && next === '/forgeflow-lean-decision --task "<work item>"' ? `/forgeflow-lean-decision --task ${JSON.stringify(task)}` : next,
    next_reason: steps.find((item) => item.next)?.reason || 'Lean first-run evidence is ready.',
    task,
    plan_commands: [],
    artifacts,
    boundary: 'Lean prime is read-only. It composes existing local lean status, report, and telemetry signals but does not write artifacts, edit settings, change routing, install hooks, commit, push, or call the network.',
  };
  if (opts.writeReport && report.artifacts) result.artifacts.lean_report = report.artifacts;
  result.plan_commands = planCommands(result, task);
  if (opts.primeTask && !result.plan_commands.includes('/forgeflow-lean-report --write')) result.plan_commands.unshift('/forgeflow-lean-report --write');
  if (opts.writeReport) result.plan_commands = result.plan_commands.filter((command) => command !== '/forgeflow-lean-report --write');
  if (opts.writePlan || opts.primeTask) {
    const jsonPath = path.join(projectDir, 'context', 'lean-prime-plan.json');
    const markdownPath = path.join(projectDir, 'context', 'lean-prime-plan.md');
    writeJsonSafe(jsonPath, result);
    writeFileSafe(markdownPath, renderMarkdown(result));
    result.artifacts = { ...result.artifacts, json: jsonPath, markdown: markdownPath };
    result.boundary = opts.primeTask
      ? 'Lean prime task writing stores only .forgeflow/<project>/context/lean-decision.{json,md} and lean-prime-plan.{json,md}. It does not edit code, settings, routing, commits, pushes, installs hooks, or call the network.'
      : 'Lean prime plan writing stores only .forgeflow/<project>/context/lean-prime-plan.{json,md}. It does not edit code, settings, routing, commits, pushes, installs hooks, or call the network.';
  }
  if (opts.writeReport) {
    result.boundary = opts.primeTask
      ? 'Lean prime task/report writing stores only .forgeflow/<project>/context/lean-decision.{json,md}, lean-report.{json,md}, and lean-prime-plan.{json,md}. It does not edit code, settings, routing, commits, pushes, installs hooks, or call the network.'
      : 'Lean prime report writing stores only .forgeflow/<project>/context/lean-report.{json,md} and optional lean-prime-plan artifacts. It does not edit code, settings, routing, commits, pushes, installs hooks, or call the network.';
  }
  return result;
}

function renderMarkdown(result) {
  const lines = ['# Forgeflow Lean Prime', '', `Status: ${result.status}`, `Profile: ${result.profile}`, '', result.boundary, '', '## Steps', ''];
  for (const item of result.steps) {
    lines.push(`- ${item.status}: ${item.label} - ${item.reason}`);
  }
  lines.push('', '## Plan Commands', '');
  for (const command of result.plan_commands.length ? result.plan_commands : ['No plan commands required.']) lines.push(`- ${command}`);
  lines.push('', '## Next', '', result.next || 'No next command required.', '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildLeanPrime(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  } catch (err) {
    console.error(`lean prime failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  buildLeanPrime,
  commandOrFallback,
  parseArgs,
  renderMarkdown,
};
