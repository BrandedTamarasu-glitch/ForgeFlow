#!/usr/bin/env node
const path = require('path');
const { buildOutcomeCapturePlan } = require('./render-outcome-capture-plan');
const { buildLearningCaptureNudge } = require('./render-learning-capture-nudge');

function usage() {
  console.error('Usage: render-workflow-ending-capture.js [--root <repo>] [--project-dir <dir>] [--event review|next-work|agent-feedback|auto] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', event: 'auto', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--event') {
      opts.event = requireValue(argv, arg, i);
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
  if (!['review', 'next-work', 'agent-feedback', 'auto'].includes(opts.event)) throw new Error(`Invalid --event: ${opts.event}`);
  return opts;
}

const EVENT_TO_STREAM = {
  review: 'review-outcomes',
  'next-work': 'next-work-outcomes',
  'agent-feedback': 'agent-feedback',
};

function nudgeEventFor(event, stream) {
  if (event && event !== 'auto') return event;
  if (stream === 'next-work-outcomes') return 'next-work';
  if (stream === 'agent-feedback') return 'agent-feedback';
  return 'review';
}

function buildWorkflowEndingCapture(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const plan = buildOutcomeCapturePlan({ root, projectDir: opts.projectDir });
  const event = opts.event || 'auto';
  const preferred = EVENT_TO_STREAM[event] || '';
  const stream = preferred
    ? plan.streams.find((item) => item.name === preferred)
    : plan.streams.find((item) => item.action === 'capture-next') || plan.streams[0];
  const captureNeeded = stream && stream.action === 'capture-next';
  const learningNudge = buildLearningCaptureNudge({ event: nudgeEventFor(event, stream ? stream.name : '') });
  const nudgeCommand = captureNeeded ? stream.command : '';
  return {
    schema_version: '1',
    status: captureNeeded ? 'capture-recommended' : 'watch',
    root,
    project_dir: plan.project_dir,
    event,
    stream: stream ? stream.name : '',
    after_action_prompt: stream ? stream.after_action_prompt : '',
    command: captureNeeded ? stream.command : '',
    learning_nudge: {
      event: learningNudge.event,
      command: nudgeCommand,
      prompt: stream && stream.after_action_prompt ? stream.after_action_prompt : learningNudge.prompt,
      stop_rule: learningNudge.stop_rule,
    },
    outcome_capture_status: plan.status,
    missing_count: plan.missing_count,
    next: captureNeeded ? stream.command : 'No workflow-ending capture is required right now.',
    boundary: 'Workflow-ending capture is advisory. It recommends explicit recorder commands but does not record outcomes, infer evidence, edit files, commit, or push.',
  };
}

function inlineCode(value) {
  return `\`${String(value || '').replace(/`/g, '\\`')}\``;
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Workflow Ending Capture',
    '',
    `Status: ${result.status}`,
    `Event: ${result.event}`,
    `Stream: ${result.stream || '(none)'}`,
    '',
    result.boundary,
    '',
  ];
  if (result.after_action_prompt) lines.push(`After action: ${result.after_action_prompt}`, '');
  lines.push('## Learning Nudge', '', `Command: ${result.learning_nudge.command ? inlineCode(result.learning_nudge.command) : '(none)'}`, `Prompt: ${result.learning_nudge.prompt}`, `Stop rule: ${result.learning_nudge.stop_rule}`, '');
  lines.push(`Next: ${result.command ? inlineCode(result.next) : result.next}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildWorkflowEndingCapture(opts);
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

module.exports = { buildWorkflowEndingCapture, nudgeEventFor, parseArgs, renderMarkdown };
