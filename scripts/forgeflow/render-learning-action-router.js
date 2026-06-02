#!/usr/bin/env node
const path = require('path');
const { buildLearningStatus } = require('./show-learning-status');
const { buildTelemetryQuality } = require('./render-telemetry-quality');

function usage() {
  console.error('Usage: render-learning-action-router.js [--root <repo>] [--project-dir <dir>] [--metrics-root <dir>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', metricsRoot: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--metrics-root') {
      opts.metricsRoot = path.resolve(requireValue(argv, arg, i));
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

function commandForSource(source) {
  const normalized = String(source || '').replace(/_/g, '-');
  const commands = {
    'project-learnings': '/forgeflow-learnings --project --check',
    'user-profile': '/forgeflow-profile-bootstrap',
    'agent-feedback': '/forgeflow-workflow-ending-capture --event agent-feedback',
    'review-outcomes': '/forgeflow-workflow-ending-capture --event review',
    'next-work-outcomes': '/forgeflow-workflow-ending-capture --event next-work',
    'first-run-results': '/forgeflow-first-run-rollup',
    'metrics-events': '/forgeflow-smoke',
    'metrics-files': '/forgeflow-smoke',
  };
  return commands[normalized] || '/forgeflow-learning-status';
}

function reasonForSource(source, origin) {
  return `${source} is one of the weakest ${origin} sources, so capture or refresh that stream before relying on calibration.`;
}

function actionForSource(source, origin) {
  return {
    source,
    origin,
    command: commandForSource(source),
    reason: reasonForSource(source, origin),
    clears: 'Cleared when the learning and telemetry quality reports no longer classify this source as weak.',
    boundary: 'Learning actions are local and advisory. They do not approve work, edit source files, commit, push, or export local evidence.',
  };
}

function buildLearningActionRouter(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = opts.projectDir ? path.resolve(opts.projectDir) : path.join(root, '.forgeflow', path.basename(root));
  const learning = opts.learning || buildLearningStatus({ root, projectDir });
  const telemetry = opts.telemetry || buildTelemetryQuality({ root, projectDir, metricsRoot: opts.metricsRoot });
  const learningWeakest = (learning.signal_quality && learning.signal_quality.weakest_sources) || [];
  const telemetryWeakest = telemetry.weakest_sources || [];
  const actions = [
    ...learningWeakest.map((source) => actionForSource(source, 'learning')),
    ...telemetryWeakest.map((source) => actionForSource(source, 'telemetry')),
  ].filter((item, index, list) => list.findIndex((candidate) => candidate.source === item.source && candidate.command === item.command) === index);
  const recommendedAction = actions[0] || {
    source: 'learning-status',
    origin: 'learning',
    command: '/forgeflow-learning-status',
    reason: 'Learning and telemetry sources have no weak streams to prioritize.',
    clears: 'No action needed while learning signals remain healthy.',
    boundary: 'Learning actions are local and advisory. They do not approve work, edit source files, commit, push, or export local evidence.',
  };
  return {
    schema_version: '1',
    status: actions.length > 0 ? 'actionable' : 'ready',
    root,
    project_dir: projectDir,
    learning_status: learning.status,
    telemetry_status: telemetry.status,
    weakest_learning_sources: learningWeakest,
    weakest_telemetry_sources: telemetryWeakest,
    recommended_action: recommendedAction,
    actions: actions.slice(0, 5),
    next: recommendedAction.command,
    boundary: 'Learning action router is local and read-only. It ranks existing signals and suggests one capture/check command.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Learning Action Router',
    '',
    `Status: ${result.status}`,
    `Learning status: ${result.learning_status}`,
    `Telemetry status: ${result.telemetry_status}`,
    '',
    result.boundary,
    '',
    '## Recommended Action',
    '',
    `- Source: ${result.recommended_action.source}`,
    `- Command: ${result.recommended_action.command}`,
    `- Reason: ${result.recommended_action.reason}`,
    '',
    '## Action Queue',
    '',
  ];
  if (result.actions.length === 0) {
    lines.push('- None.');
  } else {
    for (const item of result.actions) {
      lines.push(`- ${item.source}: ${item.command}`);
      lines.push(`  - Reason: ${item.reason}`);
    }
  }
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildLearningActionRouter(opts);
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

module.exports = { buildLearningActionRouter, commandForSource, parseArgs, renderMarkdown };
