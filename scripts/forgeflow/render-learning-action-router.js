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

function captureGuidanceForSource(source) {
  const normalized = String(source || '').replace(/_/g, '-');
  const guidance = {
    'review-outcomes': {
      type: 'event-capture',
      prompt: 'After the review finishes, run the workflow-ending capture command and record the actual verdict outcome it prints.',
      template: '/forgeflow-workflow-ending-capture --event review',
      requires_observed_values: false,
    },
    'next-work-outcomes': {
      type: 'event-capture',
      prompt: 'After acting on a next-work recommendation, run the workflow-ending capture command and record whether the recommendation was useful, ignored, incorrect, or blocked.',
      template: '/forgeflow-workflow-ending-capture --event next-work',
      requires_observed_values: false,
    },
    'agent-feedback': {
      type: 'event-capture',
      prompt: 'After an agent output is useful, unclear, ignored, or incorrect, run the workflow-ending capture command and record the actual signal.',
      template: '/forgeflow-workflow-ending-capture --event agent-feedback',
      requires_observed_values: false,
    },
    'first-run-results': {
      type: 'first-run-evidence',
      prompt: 'Run the rollup first. If it reports missing evidence, record the real observed statuses with the result command template.',
      template: '/forgeflow-first-run-result --runtime <claude-code|codex> --health <pass|warn|fail> --smoke <pass|warn|fail> --decision <continue|fix-first|stop-and-fix|defer>',
      requires_observed_values: true,
    },
    'user-profile': {
      type: 'profile-bootstrap',
      prompt: 'Use the profile bootstrap prompts to record explicit user preferences only when the user confirms them.',
      template: '/forgeflow-profile-bootstrap --prompts',
      requires_observed_values: true,
    },
    'project-learnings': {
      type: 'quality-check',
      prompt: 'Refresh and check project learnings before injecting them into agent context.',
      template: '/forgeflow-learnings --project --check',
      requires_observed_values: false,
    },
  };
  return guidance[normalized] || {
    type: 'check',
    prompt: 'Run the recommended command, then refresh learning status before relying on calibration.',
    template: commandForSource(source),
    requires_observed_values: false,
  };
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
    capture_guidance: captureGuidanceForSource(source),
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
    capture_guidance: captureGuidanceForSource('learning-status'),
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
      lines.push(`  - Capture: ${item.capture_guidance.prompt}`);
      lines.push(`  - Template: ${item.capture_guidance.template}`);
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

module.exports = { buildLearningActionRouter, captureGuidanceForSource, commandForSource, parseArgs, renderMarkdown };
