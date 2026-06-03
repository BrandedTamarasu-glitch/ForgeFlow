#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { safeReadTextFile } = require('./file-safety');
const { readAgentFeedback, readReviewOutcomes } = require('./build-project-intelligence');
const { readNextWorkOutcomes } = require('./record-next-work-outcome');

function usage() {
  console.error('Usage: render-outcome-capture-plan.js [--root <repo>] [--project-dir <dir>] [--json]');
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

function readJson(file, root) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(safeReadTextFile(file, root).content);
  } catch (_err) {
    return null;
  }
}

function evidenceStatus(readerStatus, intelligenceStatus) {
  if (!readerStatus || readerStatus.status === 'missing') return 'missing';
  if ((readerStatus.invalid_lines || 0) > 0 || readerStatus.status === 'invalid') return 'invalid';
  if ((readerStatus.records || 0) > 0 || readerStatus.status === 'present') return 'present';
  if (readerStatus.status === 'empty') return 'empty';
  return intelligenceStatus || readerStatus.status || 'missing';
}

function afterActionPrompt(name) {
  return {
    'next-work-outcomes': 'After acting on a recommended next item, record whether it was useful, ignored, incorrect, or blocked.',
    'review-outcomes': 'After Arbiter resolves a review, record the verdict and how many findings were confirmed.',
    'agent-feedback': 'After a reviewer hint clearly helps or misleads, record a short useful, stale, or incorrect signal.',
  }[name] || 'Record only observed outcomes after real work.';
}

function streamPlan(name, status, command, reason) {
  const missing = status === 'missing' || status === 'empty' || status === 'invalid' || status === undefined;
  return {
    name,
    status: status || 'missing',
    action: missing ? 'capture-next' : 'watch',
    command: missing ? command : '',
    after_action_prompt: afterActionPrompt(name),
    reason: missing ? reason : 'Outcome evidence exists; keep recording only when new evidence is available.',
    capture_runbook: {
      when: afterActionPrompt(name),
      requires_observed_values: true,
      write_command: missing ? command : '',
      do_not_record: [
        'guessed outcomes',
        'inferred usefulness from conversation tone',
        'private or secret evidence',
        'records created only to satisfy calibration',
      ],
      stop_rule: 'Skip capture until a real workflow result has observable evidence.',
    },
  };
}

function inlineCode(value) {
  return `\`${String(value || '').replace(/`/g, '\\`')}\``;
}

function buildOutcomeCapturePlan(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const intelligence = readJson(path.join(projectDir, 'context', 'project-intelligence-rollup.json'), projectDir) || {};
  const nextWork = readNextWorkOutcomes(projectDir);
  const reviewOutcomes = readReviewOutcomes(projectDir);
  const agentFeedback = readAgentFeedback(projectDir);
  const streams = [
    streamPlan(
      'next-work-outcomes',
      evidenceStatus(nextWork, intelligence.next_work_confidence && intelligence.next_work_confidence.status),
      'record-next-work-outcome --title "<recommendation>" --source "<source>" --outcome useful|ignored|incorrect|blocked',
      'No next-work outcome history exists, so recommendation confidence cannot calibrate against real usefulness.'
    ),
    streamPlan(
      'review-outcomes',
      evidenceStatus(reviewOutcomes, intelligence.review_outcomes && intelligence.review_outcomes.status),
      'record-review-outcome --review-id "<id>" --verdict approved|revise|blocked --findings-total <n> --findings-confirmed <n>',
      'No review outcomes exist, so reviewer precision and missed-issue signals cannot calibrate.'
    ),
    streamPlan(
      'agent-feedback',
      evidenceStatus(agentFeedback, intelligence.agent_feedback && intelligence.agent_feedback.status),
      'record-agent-feedback --agent "<agent>" --signal useful|stale|incorrect --note "<short evidence>"',
      'No agent feedback exists, so role-specific guidance cannot distinguish useful hints from stale guidance.'
    ),
  ];
  const missingCount = streams.filter((item) => item.action === 'capture-next').length;
  return {
    schema_version: '1',
    status: missingCount > 0 ? 'capture-needed' : 'has-outcomes',
    root,
    project_dir: projectDir,
    missing_count: missingCount,
    streams,
    next_after_action: missingCount > 0
      ? streams.find((item) => item.action === 'capture-next').after_action_prompt
      : 'Keep recording only when a new review, recommendation, or agent hint produces observable evidence.',
    next: missingCount > 0 ? streams.find((item) => item.action === 'capture-next').command : 'No immediate outcome capture needed.',
    capture_runbook: {
      status: missingCount > 0 ? 'needs-observed-outcome' : 'watch-for-next-event',
      next_stream: missingCount > 0 ? streams.find((item) => item.action === 'capture-next').name : '',
      next_command: missingCount > 0 ? streams.find((item) => item.action === 'capture-next').command : '',
      requires_observed_values: true,
      boundary: 'Use recorder commands only after an actual recommendation, review, or agent hint produces a result the user or workflow observed.',
    },
    boundary: 'Outcome capture plan is read-only. It prints recorder prompts but does not record, infer, edit files, commit, or push.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Outcome Capture Plan',
    '',
    `Status: ${result.status}`,
    `Missing streams: ${result.missing_count}`,
    '',
    result.boundary,
    '',
    '## Streams',
    '',
  ];
  for (const stream of result.streams) {
    lines.push(`- ${stream.name}: ${stream.status} (${stream.action})`);
    lines.push(`  - After action: ${stream.after_action_prompt}`);
    lines.push(`  - Reason: ${stream.reason}`);
    if (stream.command) lines.push(`  - Command: ${inlineCode(stream.command)}`);
    lines.push(`  - Stop rule: ${stream.capture_runbook.stop_rule}`);
  }
  lines.push('', '## Capture Runbook', '');
  lines.push(`- Status: ${result.capture_runbook.status}`);
  if (result.capture_runbook.next_stream) lines.push(`- Next stream: ${result.capture_runbook.next_stream}`);
  lines.push(`- Requires observed values: ${result.capture_runbook.requires_observed_values ? 'yes' : 'no'}`);
  lines.push(`- Boundary: ${result.capture_runbook.boundary}`);
  lines.push('', `Next after action: ${result.next_after_action}`, `Next: ${result.next.startsWith('record-') ? inlineCode(result.next) : result.next}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildOutcomeCapturePlan(opts);
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

module.exports = { buildOutcomeCapturePlan, evidenceStatus, parseArgs, renderMarkdown };
