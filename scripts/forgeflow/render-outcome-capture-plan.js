#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { safeReadTextFile } = require('./file-safety');

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

function jsonlStatus(file, root) {
  if (!fs.existsSync(file)) return 'missing';
  try {
    const content = safeReadTextFile(file, root).content;
    return content.split(/\r?\n/).some((line) => line.trim()) ? 'present' : 'empty';
  } catch (_err) {
    return 'missing';
  }
}

function streamStatus(intelligenceStatus, projectDir, fileName) {
  const localStatus = jsonlStatus(path.join(projectDir, fileName), projectDir);
  if (localStatus === 'present') return 'present';
  if (localStatus === 'empty') return 'empty';
  return intelligenceStatus || localStatus;
}

function afterActionPrompt(name) {
  return {
    'next-work-outcomes': 'After acting on a recommended next item, record whether it was useful, ignored, incorrect, or blocked.',
    'review-outcomes': 'After Arbiter resolves a review, record the verdict and how many findings were confirmed.',
    'agent-feedback': 'After a reviewer hint clearly helps or misleads, record a short useful, stale, or incorrect signal.',
  }[name] || 'Record only observed outcomes after real work.';
}

function streamPlan(name, status, command, reason) {
  const missing = status === 'missing' || status === 'empty' || status === undefined;
  return {
    name,
    status: status || 'missing',
    action: missing ? 'capture-next' : 'watch',
    command: missing ? command : '',
    after_action_prompt: afterActionPrompt(name),
    reason: missing ? reason : 'Outcome evidence exists; keep recording only when new evidence is available.',
  };
}

function inlineCode(value) {
  return `\`${String(value || '').replace(/`/g, '\\`')}\``;
}

function buildOutcomeCapturePlan(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const intelligence = readJson(path.join(projectDir, 'context', 'project-intelligence-rollup.json'), projectDir) || {};
  const streams = [
    streamPlan(
      'next-work-outcomes',
      streamStatus(intelligence.next_work_confidence && intelligence.next_work_confidence.status, projectDir, 'next-work-outcomes.jsonl'),
      'record-next-work-outcome --title "<recommendation>" --source "<source>" --outcome useful|ignored|incorrect|blocked',
      'No next-work outcome history exists, so recommendation confidence cannot calibrate against real usefulness.'
    ),
    streamPlan(
      'review-outcomes',
      streamStatus(intelligence.review_outcomes && intelligence.review_outcomes.status, projectDir, 'review-outcomes.jsonl'),
      'record-review-outcome --review-id "<id>" --verdict approved|revise|blocked --findings-total <n> --findings-confirmed <n>',
      'No review outcomes exist, so reviewer precision and missed-issue signals cannot calibrate.'
    ),
    streamPlan(
      'agent-feedback',
      streamStatus(intelligence.agent_feedback && intelligence.agent_feedback.status, projectDir, 'agent-feedback.jsonl'),
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
  }
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

module.exports = { buildOutcomeCapturePlan, parseArgs, renderMarkdown };
