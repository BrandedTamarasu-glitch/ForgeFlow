#!/usr/bin/env node
const path = require('path');
const { renderDogfoodReport } = require('./render-dogfood-report');

function usage() {
  console.error('Usage: render-dogfood-refresh-plan.js [--root <dir>] [--project-dir <dir>] [--json]');
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

function step(id, command, reason, evidence, status = 'pending') {
  return { id, command, reason, evidence, status };
}

function phaseSteps(report) {
  const phases = report.phase_readiness || {};
  const evidence = Object.fromEntries((report.evidence || []).map((item) => [item.key, item]));
  const steps = [];
  const topologyMissing = evidence.codeTopology && evidence.codeTopology.status !== 'present';
  const architecture = phases.phase_8_architecture || {};
  const ownership = phases.phase_9_ownership || {};
  const invocation = phases.phase_10_invocation || {};
  const injection = phases.phase_11_context_injection || {};

  if (topologyMissing) {
    steps.push(step(
      'refresh-code-map',
      '/forgeflow-code-map',
      'Architecture, ownership, and invocation evidence is stronger when current topology exists.',
      evidence.codeTopology.status,
    ));
  }
  if (architecture.status !== 'present') {
    steps.push(step(
      'write-architecture',
      '/forgeflow-architecture --write',
      'Write local architecture evidence for the dogfood report.',
      architecture.status || 'missing',
    ));
  }
  if (ownership.status !== 'present') {
    steps.push(step(
      'write-ownership',
      '/forgeflow-ownership --write',
      'Write local ownership routing evidence for the dogfood report.',
      ownership.status || 'missing',
    ));
  }
  if (invocation.status !== 'present') {
    steps.push(step(
      'write-invocation',
      '/forgeflow-invocation-hints --write',
      'Write local entrypoint and invocation evidence for the dogfood report.',
      invocation.status || 'missing',
    ));
  }
  if (injection.status !== 'present') {
    steps.push(step(
      'refresh-context-pack',
      '/review',
      'Refresh context-pack synthesis evidence after local architecture intelligence artifacts exist.',
      injection.status || 'missing',
    ));
  }
  steps.push(step(
    'rerun-dogfood-report',
    '/forgeflow-dogfood-report --write',
    'Recompute the promotion decision after refresh commands complete.',
    report.promotion_decision,
    steps.length === 0 ? 'ready' : 'pending',
  ));
  return steps;
}

function statusFor(report, steps) {
  if (report.invalid_artifacts && report.invalid_artifacts.length > 0) return 'repair-evidence-first';
  if (steps.some((item) => item.status === 'pending')) return 'refresh-needed';
  if (report.promotion_decision === 'consider-promote') return 'ready';
  return 'watch';
}

function renderDogfoodRefreshPlan(options = {}) {
  const report = renderDogfoodReport({ ...options, write: false });
  const steps = phaseSteps(report);
  const result = {
    schema_version: '1',
    generated_at: report.generated_at,
    root: report.root,
    project_dir: report.project_dir,
    status: statusFor(report, steps),
    dogfood_status: report.status,
    promotion_decision: report.promotion_decision,
    promotion_reason: report.promotion_reason,
    steps,
    invalid_artifacts: report.invalid_artifacts || [],
    next: steps.find((item) => item.status === 'pending')?.command || '/forgeflow-dogfood-report --write',
    next_reason: steps.find((item) => item.status === 'pending')?.reason || 'Dogfood evidence is current enough to rerun the report.',
    boundary: 'Dogfood refresh plan is read-only. It reports ordered local refresh commands but does not run commands, write artifacts, spawn agents, edit files, commit, push, call GitHub, or promote automation.',
  };
  return result;
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Dogfood Refresh Plan',
    '',
    `Status: ${result.status}`,
    `Promotion decision: ${result.promotion_decision}`,
    '',
    result.boundary,
    '',
    '## Steps',
    '',
    ...(result.steps.length ? result.steps.map((item, index) => `${index + 1}. ${item.command} - ${item.reason}`) : ['- None.']),
  ];
  if (result.invalid_artifacts.length > 0) {
    lines.push('', '## Invalid Artifacts', '');
    lines.push(...result.invalid_artifacts.map((item) => `- ${item.label}: ${item.reason} (${item.path})`));
  }
  lines.push('', `Next: ${result.next}`, `Why: ${result.next_reason}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = renderDogfoodRefreshPlan(opts);
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

module.exports = {
  parseArgs,
  renderDogfoodRefreshPlan,
  renderMarkdown,
};
