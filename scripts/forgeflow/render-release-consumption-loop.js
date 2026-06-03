#!/usr/bin/env node
const path = require('path');
const { buildReleaseConsumptionRollup } = require('./render-release-consumption-rollup');
const { buildUpdateVerify } = require('./render-update-verify');

function usage() {
  console.error('Usage: render-release-consumption-loop.js [--root <repo>] [--project-dir <dir>] [--with-smoke] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', withSmoke: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--with-smoke') {
      opts.withSmoke = true;
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

function updateStatusToStep(updateVerify) {
  if (updateVerify.status === 'ready') return { name: 'update-verified', status: 'pass', command: '/forgeflow-update-verify' };
  if (updateVerify.status === 'restart') return { name: 'restart-required', status: 'attention', command: 'restart Claude Code, then run /forgeflow-update-verify' };
  return { name: 'repair-update', status: 'attention', command: '/update-forgeflow --repair' };
}

function completionFor(steps) {
  const incomplete = steps.filter((step) => step.status !== 'pass');
  if (incomplete.length === 0) {
    return {
      status: 'complete',
      badge: 'release-consumption-complete',
      summary: 'Update verification, downstream smoke, and release consumption all passed.',
    };
  }
  return {
    status: 'attention',
    badge: 'release-consumption-attention',
    summary: `Clear ${incomplete[0].name} before treating release consumption as complete.`,
  };
}

function buildDogfoodReport(updateVerify, consumption, steps, completion) {
  const evidence = {
    update_status: updateVerify.status,
    consumption_status: consumption.status,
    smoke_status: consumption.downstream_smoke ? consumption.downstream_smoke.status : 'missing',
    completed_steps: steps.filter((step) => step.status === 'pass').map((step) => step.name),
    attention_steps: steps.filter((step) => step.status !== 'pass').map((step) => step.name),
  };
  const downstreamTrial = [
    {
      name: 'context-wave-pressure',
      command: '/forgeflow-review-wave-prep --write-wave-files',
      evidence: 'Record whether the first wave reduced packet size and kept proof files visible.',
    },
    {
      name: 'command-output-pressure',
      command: '/forgeflow-validation-failure-capture --command "<failed validation command>"',
      evidence: 'When validation fails, record whether the compact digest preserved the useful failure lines and raw-required boundary.',
    },
    {
      name: 'runtime-registry-pressure',
      command: '/forgeflow-workflow-readiness',
      evidence: 'Check whether runtime inventory pressure points at a concrete safe slice instead of broad install/update edits.',
    },
    {
      name: 'learning-capture',
      command: '/forgeflow-workflow-ending-capture --event next-work',
      evidence: 'After the downstream task ends, capture observed outcome values before relying on calibration.',
    },
  ];
  return {
    status: completion.status === 'complete' ? 'ready-to-share' : 'needs-follow-through',
    badge: completion.badge,
    evidence,
    downstream_trial: downstreamTrial,
    next_command: evidence.attention_steps.length > 0
      ? steps.find((step) => step.status !== 'pass').command
      : '/forgeflow-release-consumption',
    compare_hint: 'Run this loop after /update-forgeflow in a consuming project to compare source release readiness with installed runtime behavior.',
    boundary: 'Dogfood reporting is read-only and reflects existing update, smoke, and consumption evidence. It does not run update, repair, smoke, release, or GitHub commands.',
  };
}

function buildReleaseConsumptionLoop(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const updateVerify = opts.updateVerify || buildUpdateVerify({ root, home: opts.installRoot });
  const consumption = opts.consumption || buildReleaseConsumptionRollup({
    root,
    projectDir,
    withSmoke: opts.withSmoke,
    installRoot: opts.installRoot,
    runner: opts.runner,
  });
  const updateStep = updateStatusToStep(updateVerify);
  const smokeStep = {
    name: 'downstream-smoke',
    status: consumption.downstream_smoke && consumption.downstream_smoke.status === 'not-run' ? 'pending' : (consumption.downstream_smoke.status === 'pass' ? 'pass' : 'attention'),
    command: consumption.downstream_smoke && consumption.downstream_smoke.status === 'not-run'
      ? '/forgeflow-release-consumption --with-smoke'
      : '/forgeflow-smoke',
  };
  const consumptionStep = {
    name: 'release-consumption',
    status: consumption.status === 'pass' ? 'pass' : 'attention',
    command: '/forgeflow-release-consumption',
  };
  const steps = [
    updateStep,
    smokeStep,
    consumptionStep,
  ];
  const attention = steps.find((step) => step.status === 'attention' || step.status === 'pending');
  const completion = completionFor(steps);
  const dogfoodReport = buildDogfoodReport(updateVerify, consumption, steps, completion);
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    status: attention ? 'attention' : 'complete',
    update_status: updateVerify.status,
    consumption_status: consumption.status,
    smoke_status: consumption.downstream_smoke ? consumption.downstream_smoke.status : 'missing',
    steps,
    completion,
    dogfood_report: dogfoodReport,
    completion_badge: completion.badge,
    next_command: attention ? attention.command : '/forgeflow-release-consumption',
    next_reason: attention
      ? `Clear ${attention.name} before treating release consumption as complete.`
      : 'Update verification, downstream smoke, and release consumption are complete.',
    boundary: 'Release consumption loop is local and read-only. It does not update, repair, smoke, save snapshots, tag, push, publish, call GitHub, or mutate settings unless a listed command is run explicitly.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Release Consumption Loop',
    '',
    `Status: ${result.status}`,
    `Update: ${result.update_status}`,
    `Smoke: ${result.smoke_status}`,
    `Consumption: ${result.consumption_status}`,
    '',
    result.boundary,
    '',
    '## Steps',
    '',
  ];
  for (const step of result.steps) lines.push(`- ${step.name}: ${step.status} - ${step.command}`);
  lines.push('', '## Completion', '', `Badge: ${result.completion.badge}`, `Summary: ${result.completion.summary}`);
  if (result.dogfood_report) {
    lines.push('', '## Dogfood Report', '');
    lines.push(`Status: ${result.dogfood_report.status}`);
    lines.push(`Badge: ${result.dogfood_report.badge}`);
    lines.push(`Next: ${result.dogfood_report.next_command}`);
    lines.push(result.dogfood_report.compare_hint);
    if (result.dogfood_report.downstream_trial && result.dogfood_report.downstream_trial.length > 0) {
      lines.push('', '### Downstream Efficiency Trial', '');
      for (const item of result.dogfood_report.downstream_trial) {
        lines.push(`- ${item.name}: ${item.command}`);
        lines.push(`  - Evidence: ${item.evidence}`);
      }
    }
  }
  lines.push('', `Next: ${result.next_command}`, `Why: ${result.next_reason}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildReleaseConsumptionLoop(opts);
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

module.exports = { buildDogfoodReport, buildReleaseConsumptionLoop, completionFor, parseArgs, renderMarkdown, updateStatusToStep };
