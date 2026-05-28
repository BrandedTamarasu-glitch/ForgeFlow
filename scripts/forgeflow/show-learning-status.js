#!/usr/bin/env node
const path = require('path');
const { checkProjectLearnings } = require('./check-project-learnings');
const { readAgentFeedback, readReviewOutcomes } = require('./build-project-intelligence');
const { readNextWorkOutcomes } = require('./record-next-work-outcome');
const { buildRollup, readRecords } = require('./rollup-first-run-results');
const { compactUserProfile } = require('./user-profile');

function usage() {
  console.error('Usage: show-learning-status.js [--root <dir>] [--project-dir <dir>] [--json]');
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

function statusRank(status) {
  if (['fail', 'blocked', 'invalid'].includes(status)) return 3;
  if (['warn', 'attention', 'stale', 'missing', 'empty'].includes(status)) return 2;
  if (['present', 'pass', 'current'].includes(status)) return 0;
  return 1;
}

function summarizeOverall(sections) {
  const max = Math.max(...sections.map((section) => statusRank(section.status)));
  if (max >= 3) return 'fail';
  if (max >= 2) return 'attention';
  return 'pass';
}

function firstRunSummary(projectDir) {
  const records = readRecords(projectDir);
  const rollup = buildRollup(records);
  return {
    status: rollup.records > 0 ? 'present' : 'missing',
    records: rollup.records,
    invalid_records: rollup.invalid_records,
    recommendation: rollup.recommendation,
  };
}

function buildLearningStatus(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const projectLearnings = checkProjectLearnings({ projectDir });
  const userProfile = compactUserProfile({ root, projectDir }, 1200);
  const agentFeedback = readAgentFeedback(projectDir);
  const reviewOutcomes = readReviewOutcomes(projectDir);
  const nextWork = readNextWorkOutcomes(projectDir);
  const firstRun = firstRunSummary(projectDir);
  const sections = [
    {
      name: 'project-learnings',
      status: projectLearnings.status,
      records: projectLearnings.candidates || 0,
      issues: projectLearnings.issues.length,
      next: projectLearnings.status === 'pass' ? 'continue-using-project-learnings' : 'forgeflow-learnings --project --check',
    },
    {
      name: 'user-profile',
      status: userProfile.result.check.status,
      records: userProfile.result.check.records.active,
      issues: userProfile.result.check.issues.length + userProfile.result.check.conflicts.length,
      next: userProfile.result.check.status === 'pass' ? 'continue-using-profile-guidance' : 'forgeflow-profile-review',
    },
    {
      name: 'agent-feedback',
      status: agentFeedback.status,
      records: agentFeedback.records,
      issues: agentFeedback.invalid_lines || 0,
      next: (agentFeedback.by_signal && ((agentFeedback.by_signal.incorrect || 0) + (agentFeedback.by_signal.unclear || 0) + (agentFeedback.by_signal.ignored || 0)) > 0) ? 'review-corrective-agent-feedback' : 'continue-recording-agent-feedback',
    },
    {
      name: 'review-outcomes',
      status: reviewOutcomes.status,
      records: reviewOutcomes.records,
      issues: reviewOutcomes.invalid_lines || 0,
      next: (reviewOutcomes.learning_signals && ((reviewOutcomes.learning_signals.false_positive || 0) + (reviewOutcomes.learning_signals.missed_issue || 0) + (reviewOutcomes.learning_signals.stale_guidance || 0)) > 0) ? 'triage-review-outcome-learning-signals' : 'continue-recording-review-outcomes',
    },
    {
      name: 'next-work-outcomes',
      status: nextWork.status,
      records: nextWork.records,
      issues: nextWork.invalid_lines || 0,
      next: nextWork.recommendation,
    },
    {
      name: 'first-run-results',
      status: firstRun.status,
      records: firstRun.records,
      issues: firstRun.invalid_records,
      next: firstRun.recommendation,
    },
  ];
  const recommendations = sections
    .filter((section) => section.next && !/^continue-/.test(section.next))
    .map((section) => ({ source: section.name, action: section.next }));
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    status: summarizeOverall(sections),
    sections,
    recommendations,
    boundary: 'Learning status is advisory local evidence. It does not approve work, promote patterns, or override current code, tests, review, or user instructions.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Learning Status',
    '',
    `Status: ${result.status}`,
    `Project: ${result.project_dir}`,
    '',
    result.boundary,
    '',
    '## Signals',
    '',
  ];
  for (const section of result.sections) {
    lines.push(`- ${section.name}: ${section.status} (${section.records} record(s), ${section.issues} issue(s))`);
    if (section.next) lines.push(`  - Next: ${section.next}`);
  }
  lines.push('', '## Recommendations', '');
  if (result.recommendations.length === 0) lines.push('- None.');
  else for (const item of result.recommendations) lines.push(`- ${item.source}: ${item.action}`);
  lines.push('');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildLearningStatus(opts);
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

module.exports = { buildLearningStatus, firstRunSummary, parseArgs, renderMarkdown };
