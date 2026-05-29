#!/usr/bin/env node
const path = require('path');
const { rollupAgentFeedback } = require('./rollup-agent-feedback');
const { rollupFirstRunResults } = require('./rollup-first-run-results');
const { rollupPilotEvidence } = require('./rollup-pilot-evidence');
const { buildLearningStatus } = require('./show-learning-status');

function usage() {
  console.error('Usage: render-first-useful-win.js [--root <dir>] [--project-dir <dir>] [--json]');
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

function buildFirstUsefulWin(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const firstRun = safeCall(() => rollupFirstRunResults({ projectDir }), { records: 0, recommendation: 'record-first-run-result' });
  const pilot = safeCall(() => rollupPilotEvidence({ projectDir }), { pilot_count: 0, recommended_decision: 'repeat-pilot' });
  const feedback = safeCall(() => rollupAgentFeedback({ projectDir }), { records: 0, by_signal: {}, corrective: 0, promotable: 0 });
  const learning = safeCall(() => buildLearningStatus({ root, projectDir }), { status: 'missing', recommendations: [] });
  const wins = [];
  if ((firstRun.records || 0) > 0) wins.push(`First-run evidence recorded ${firstRun.records} setup attempt(s).`);
  if ((pilot.pilot_count || 0) > 0) wins.push(`Pilot evidence recorded ${pilot.pilot_count} trial(s) with decision ${pilot.recommended_decision || pilot.recommendation || 'unknown'}.`);
  if ((feedback.by_signal && feedback.by_signal.useful) > 0) wins.push(`${feedback.by_signal.useful} useful agent-feedback signal(s) recorded.`);
  if ((feedback.promotable || 0) > 0) wins.push(`${feedback.promotable} promotable agent-feedback pattern(s) found.`);
  if (learning.status === 'pass') wins.push('Learning status is passing, so local guidance is usable as advisory context.');
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    status: wins.length > 0 ? 'has-signal' : 'needs-more-evidence',
    wins,
    evidence: {
      first_run_records: firstRun.records || 0,
      pilot_count: pilot.pilot_count || 0,
      useful_feedback: feedback.by_signal ? feedback.by_signal.useful || 0 : 0,
      corrective_feedback: feedback.corrective || 0,
      learning_status: learning.status,
    },
    next: wins.length > 0 ? 'forgeflow-report --refresh' : 'forgeflow-first-run-result',
    next_reason: wins.length > 0 ? 'Refresh the consolidated report before sharing outcomes.' : 'Record at least one public-safe first-run result before judging useful wins.',
    boundary: 'First useful win report is local and advisory. It summarizes aggregate signals without exposing raw project records.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow First Useful Win',
    '',
    `Status: ${result.status}`,
    '',
    result.boundary,
    '',
    '## Wins',
    '',
    ...(result.wins.length > 0 ? result.wins.map((item) => `- ${item}`) : ['- No useful-win evidence recorded yet.']),
    '',
    '## Evidence',
    '',
    `- First-run records: ${result.evidence.first_run_records}`,
    `- Pilot count: ${result.evidence.pilot_count}`,
    `- Useful feedback: ${result.evidence.useful_feedback}`,
    `- Corrective feedback: ${result.evidence.corrective_feedback}`,
    `- Learning status: ${result.evidence.learning_status}`,
    '',
    `Next: ${result.next}`,
    `Why: ${result.next_reason}`,
    '',
  ];
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildFirstUsefulWin(opts);
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

module.exports = { buildFirstUsefulWin, parseArgs, renderMarkdown };
