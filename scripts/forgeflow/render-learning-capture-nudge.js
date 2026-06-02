#!/usr/bin/env node

function usage() {
  console.error('Usage: render-learning-capture-nudge.js [--event review|next-work|agent-feedback|first-run] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { event: 'review', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--event') {
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
  if (!['review', 'next-work', 'agent-feedback', 'first-run'].includes(opts.event)) throw new Error('Invalid --event');
  return opts;
}

function templateForEvent(event) {
  const templates = {
    review: {
      command: '/forgeflow-workflow-ending-capture --event review',
      prompt: 'Run after review is complete and record the actual observed verdict.',
      requires_observed_values: false,
    },
    'next-work': {
      command: '/forgeflow-workflow-ending-capture --event next-work',
      prompt: 'Run after acting on a recommendation and record the actual outcome.',
      requires_observed_values: false,
    },
    'agent-feedback': {
      command: '/forgeflow-workflow-ending-capture --event agent-feedback',
      prompt: 'Run after useful or incorrect agent behavior is observed.',
      requires_observed_values: false,
    },
    'first-run': {
      command: '/forgeflow-first-run-result --runtime <claude-code|codex> --health <pass|warn|fail> --smoke <pass|warn|fail> --decision <continue|fix-first|stop-and-fix|defer>',
      prompt: 'Replace placeholders only with real observed first-run statuses.',
      requires_observed_values: true,
    },
  };
  return templates[event];
}

function buildLearningCaptureNudge(opts = {}) {
  const event = opts.event || 'review';
  const template = templateForEvent(event);
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    status: 'ready',
    event,
    command: template.command,
    prompt: template.prompt,
    requires_observed_values: template.requires_observed_values,
    stop_rule: 'Do not record inferred, guessed, private, secret, or source-snippet evidence. Capture only observed workflow outcomes.',
    boundary: 'Learning capture nudge is advisory and read-only. It does not write learning records unless the listed capture command is run explicitly.',
  };
}

function renderMarkdown(result) {
  return [
    '# Forgeflow Learning Capture Nudge',
    '',
    `Status: ${result.status}`,
    `Event: ${result.event}`,
    `Requires observed values: ${result.requires_observed_values ? 'yes' : 'no'}`,
    '',
    result.boundary,
    '',
    `Command: ${result.command}`,
    `Prompt: ${result.prompt}`,
    `Stop rule: ${result.stop_rule}`,
    '',
  ].join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildLearningCaptureNudge(opts);
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

module.exports = { buildLearningCaptureNudge, parseArgs, renderMarkdown, templateForEvent };
