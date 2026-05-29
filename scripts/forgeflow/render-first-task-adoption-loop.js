#!/usr/bin/env node
const path = require('path');
const { buildFirstTaskReport } = require('./render-first-task-report');
const { buildFirstUsefulWin } = require('./render-first-useful-win');

function usage() {
  console.error('Usage: render-first-task-adoption-loop.js [--root <dir>] [--project-dir <dir>] [--json]');
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

function buildFirstTaskAdoptionLoop(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const report = buildFirstTaskReport({ root, projectDir });
  const usefulWin = buildFirstUsefulWin({ root, projectDir });
  let decision = 'repeat';
  let next = '/forgeflow-next-work-outcome';
  let reason = 'More outcome evidence is needed before changing adoption scope.';
  if (report.blockers && report.blockers.length > 0) {
    decision = 'fix';
    next = '/forgeflow-learning-status';
    reason = 'Corrective or learning-health blockers should be cleared before expanding usage.';
  } else if (report.status === 'success' && usefulWin.status === 'has-signal') {
    decision = 'expand';
    next = '/forgeflow-report --refresh';
    reason = 'First-task evidence and useful-win evidence both show usable signal.';
  } else if (report.status === 'needs-evidence' && usefulWin.status === 'needs-more-evidence') {
    decision = 'repeat';
  } else {
    decision = 'defer';
    next = '/forgeflow-first-task-report';
    reason = 'Signals are mixed; review the first-task report before expanding.';
  }
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    status: decision,
    decision,
    evidence: {
      first_task_status: report.status,
      useful_win_status: usefulWin.status,
      success_signals: report.success_signals || [],
      blockers: report.blockers || [],
      wins: usefulWin.wins || [],
    },
    next,
    next_reason: reason,
    boundary: 'First-task adoption loop is advisory and local. It does not enroll users, promote guidance, edit files, commit, or push.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow First Task Adoption Loop',
    '',
    `Decision: ${result.decision}`,
    '',
    result.boundary,
    '',
    '## Evidence',
    '',
    `- First task status: ${result.evidence.first_task_status}`,
    `- Useful win status: ${result.evidence.useful_win_status}`,
    `- Success signals: ${result.evidence.success_signals.length}`,
    `- Blockers: ${result.evidence.blockers.length}`,
    `- Wins: ${result.evidence.wins.length}`,
    '',
    `Next: ${result.next}`,
    `Why: ${result.next_reason}`,
    '',
  ];
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildFirstTaskAdoptionLoop(opts);
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

module.exports = { buildFirstTaskAdoptionLoop, parseArgs, renderMarkdown };
