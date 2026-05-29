#!/usr/bin/env node
const path = require('path');
const { buildFirstUsefulWin } = require('./render-first-useful-win');
const { buildLearningStatus } = require('./show-learning-status');
const { readNextWorkOutcomes } = require('./record-next-work-outcome');
const { readReviewOutcomes } = require('./build-project-intelligence');

function usage() {
  console.error('Usage: render-first-task-report.js [--root <dir>] [--project-dir <dir>] [--json]');
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

function safeCall(fn, fallback) {
  try {
    return fn();
  } catch (_err) {
    return fallback;
  }
}

function buildFirstTaskReport(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const usefulWin = safeCall(() => buildFirstUsefulWin({ root, projectDir }), { status: 'needs-more-evidence', wins: [], evidence: {} });
  const learning = safeCall(() => buildLearningStatus({ root, projectDir }), { status: 'missing', signal_quality: { average_score: 0 }, recommendations: [] });
  const nextWork = safeCall(() => readNextWorkOutcomes(projectDir), { status: 'missing', records: 0, by_outcome: {}, recommendation: 'record-next-work-outcomes' });
  const review = safeCall(() => readReviewOutcomes(projectDir), { status: 'missing', records: 0, learning_signals: {} });
  const successSignals = [];
  if (usefulWin.status === 'has-signal') successSignals.push('useful-win-evidence');
  if ((nextWork.by_outcome && nextWork.by_outcome.useful) > 0) successSignals.push('next-work-useful');
  if (learning.status === 'pass') successSignals.push('learning-status-pass');
  if (review.status === 'present') successSignals.push('review-outcome-recorded');
  const blockers = [];
  if ((nextWork.by_outcome && ((nextWork.by_outcome.incorrect || 0) + (nextWork.by_outcome.blocked || 0))) > 0) blockers.push('next-work-corrective-signals');
  if (learning.status !== 'pass') blockers.push('learning-status-needs-attention');
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    status: blockers.length > 0 ? 'attention' : (successSignals.length > 0 ? 'success' : 'needs-evidence'),
    success_signals: successSignals,
    blockers,
    evidence: {
      useful_win_status: usefulWin.status,
      useful_win_count: usefulWin.wins ? usefulWin.wins.length : 0,
      next_work_records: nextWork.records || 0,
      review_records: review.records || 0,
      learning_status: learning.status,
      learning_average_score: learning.signal_quality ? learning.signal_quality.average_score : 0,
    },
    next: blockers.length > 0 ? '/forgeflow-learning-status' : (successSignals.length > 0 ? '/forgeflow-report --refresh' : '/forgeflow-next-work-outcome'),
    next_reason: blockers.length > 0
      ? 'Inspect learning health and corrective signals before expanding adoption.'
      : successSignals.length > 0
        ? 'Refresh the consolidated report before sharing or expanding the first-task result.'
        : 'Record a next-work outcome after the first real task to make the report useful.',
    boundary: 'First-task report is advisory local evidence. It summarizes aggregate outcomes without exposing raw project records.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow First Task Report',
    '',
    `Status: ${result.status}`,
    '',
    result.boundary,
    '',
    '## Success Signals',
    '',
    ...(result.success_signals.length ? result.success_signals.map((item) => `- ${item}`) : ['- None recorded yet.']),
    '',
    '## Blockers',
    '',
    ...(result.blockers.length ? result.blockers.map((item) => `- ${item}`) : ['- None.']),
    '',
    '## Evidence',
    '',
    `- Useful win status: ${result.evidence.useful_win_status}`,
    `- Useful win count: ${result.evidence.useful_win_count}`,
    `- Next-work records: ${result.evidence.next_work_records}`,
    `- Review records: ${result.evidence.review_records}`,
    `- Learning status: ${result.evidence.learning_status}`,
    `- Learning average score: ${result.evidence.learning_average_score}`,
    '',
    `Next: ${result.next}`,
    `Why: ${result.next_reason}`,
    '',
  ];
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildFirstTaskReport(opts);
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

module.exports = { buildFirstTaskReport, parseArgs, renderMarkdown };
