#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { isPathInside, safeReadTextFile, writeFileSafe, writeJsonSafe } = require('./file-safety');

const MODES = ['baseline', 'balanced', 'strict', 'ultra'];
const MIN_SAMPLES_PER_MODE = 2;
const BOUNDARIES = [
  'local-only',
  'aggregate-first',
  'no raw private snippets',
  'no hosted telemetry',
  'no API calls',
  'no automatic workflow changes',
  'no performance claims from single samples',
];

function usage() {
  console.error('Usage: render-lean-lab.js [--root <repo>] [--project-dir <dir>] [--task-pack <json>] [--results <json>] [--write] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', taskPack: '', results: '', write: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--task-pack') {
      opts.taskPack = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--results') {
      opts.results = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--write') {
      opts.write = true;
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

function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function safeProjectDir(projectDir) {
  const resolved = path.resolve(projectDir);
  if (!fs.existsSync(resolved)) return resolved;
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error(`Refusing symlinked project directory: ${projectDir}`);
  if (!stat.isDirectory()) throw new Error(`Project directory is not a directory: ${projectDir}`);
  return resolved;
}

function readJson(file, allowedRoot, label, invalid) {
  if (!file || !fs.existsSync(file)) return { label, status: 'missing', path: file, value: null };
  try {
    const value = JSON.parse(safeReadTextFile(file, allowedRoot).content);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected JSON object');
    return { label, status: 'present', path: file, value };
  } catch (err) {
    invalid.push({ label, path: file, reason: err.message });
    return { label, status: 'invalid', path: file, value: null };
  }
}

function num(value) {
  return Number(value || 0) || 0;
}

function bool(value) {
  return value === true || value === 'true' || value === 'pass' || value === 'passed';
}

function normalizeTaskPack(value = {}) {
  const rawTasks = Array.isArray(value.tasks) ? value.tasks : [];
  const tasks = rawTasks
    .map((task, index) => ({
      id: String(task.id || task.task_id || `task-${index + 1}`),
      title: String(task.title || task.name || task.id || `Task ${index + 1}`),
      validation: Array.isArray(task.validation) ? task.validation.map(String) : [],
    }))
    .filter((task) => task.id);
  return {
    schema_version: String(value.schema_version || '1'),
    name: String(value.name || value.title || 'Lean lab task pack'),
    required_sample_size_per_mode: num(value.required_sample_size_per_mode) || MIN_SAMPLES_PER_MODE,
    tasks,
  };
}

function normalizeRun(run = {}) {
  return {
    task_id: String(run.task_id || run.task || ''),
    mode: MODES.includes(String(run.mode || '')) ? String(run.mode) : 'unknown',
    loc: num(run.loc || run.lines_changed || run.total_line_delta),
    files_changed: num(run.files_changed || run.files),
    validation_passed: bool(run.validation_passed || run.validation || run.validation_status),
    review_findings: num(run.review_findings || run.findings_count),
    context_tokens: num(run.context_tokens || run.compact_tokens || run.tokens),
    cost_usd: num(run.cost_usd || run.cost),
    latency_ms: num(run.latency_ms || run.duration_ms),
    follow_up_fixes: num(run.follow_up_fixes || run.followups),
  };
}

function normalizeResults(value = {}) {
  const runs = Array.isArray(value.runs) ? value.runs.map(normalizeRun) : [];
  return {
    schema_version: String(value.schema_version || '1'),
    runs,
  };
}

function avg(total, count) {
  return count ? Number((total / count).toFixed(2)) : 0;
}

function aggregateRuns(runs) {
  const byMode = Object.fromEntries(MODES.map((mode) => [mode, {
    mode,
    samples: 0,
    tasks: new Set(),
    validation_passed: 0,
    loc_total: 0,
    files_changed_total: 0,
    review_findings_total: 0,
    context_tokens_total: 0,
    cost_usd_total: 0,
    latency_ms_total: 0,
    follow_up_fixes_total: 0,
  }]));
  const unknown = [];
  for (const run of runs) {
    if (!byMode[run.mode]) {
      unknown.push(run);
      continue;
    }
    const bucket = byMode[run.mode];
    bucket.samples += 1;
    if (run.task_id) bucket.tasks.add(run.task_id);
    if (run.validation_passed) bucket.validation_passed += 1;
    bucket.loc_total += run.loc;
    bucket.files_changed_total += run.files_changed;
    bucket.review_findings_total += run.review_findings;
    bucket.context_tokens_total += run.context_tokens;
    bucket.cost_usd_total += run.cost_usd;
    bucket.latency_ms_total += run.latency_ms;
    bucket.follow_up_fixes_total += run.follow_up_fixes;
  }
  const modes = Object.values(byMode).map((bucket) => ({
    mode: bucket.mode,
    samples: bucket.samples,
    tasks_covered: bucket.tasks.size,
    validation_passed: bucket.validation_passed,
    validation_rate: bucket.samples ? Number((bucket.validation_passed / bucket.samples).toFixed(2)) : 0,
    loc_total: bucket.loc_total,
    loc_avg: avg(bucket.loc_total, bucket.samples),
    files_changed_avg: avg(bucket.files_changed_total, bucket.samples),
    review_findings_avg: avg(bucket.review_findings_total, bucket.samples),
    context_tokens_avg: avg(bucket.context_tokens_total, bucket.samples),
    cost_usd_total: Number(bucket.cost_usd_total.toFixed(4)),
    cost_usd_avg: Number(avg(bucket.cost_usd_total, bucket.samples).toFixed(4)),
    latency_ms_avg: avg(bucket.latency_ms_total, bucket.samples),
    follow_up_fixes_avg: avg(bucket.follow_up_fixes_total, bucket.samples),
  }));
  return { modes, unknown_runs: unknown };
}

function decideStatus({ taskPack, results, aggregate, invalid }) {
  if (invalid.length) return { status: 'attention', claim_level: 'none', decision: 'fix-inputs', reason: 'One or more lean lab inputs are invalid or unsafe to read.' };
  if (!taskPack) return { status: 'thin', claim_level: 'none', decision: 'collect-task-pack', reason: 'Lean lab needs a repeatable local task pack before comparing guidance modes.' };
  if (!results) return { status: 'thin', claim_level: 'none', decision: 'collect-results', reason: 'Lean lab needs local run-result JSON before comparing guidance modes.' };
  if (!taskPack.tasks.length) return { status: 'thin', claim_level: 'none', decision: 'add-tasks', reason: 'Task pack has no tasks.' };
  if (!results.runs.length) return { status: 'thin', claim_level: 'none', decision: 'collect-runs', reason: 'Results artifact has no runs.' };
  if (aggregate.unknown_runs.length) return { status: 'attention', claim_level: 'none', decision: 'fix-run-modes', reason: 'One or more runs use an unknown mode.' };
  const failingMode = aggregate.modes.find((mode) => mode.samples > 0 && mode.validation_rate < 1);
  if (failingMode) return { status: 'attention', claim_level: 'none', decision: 'fix-validation', reason: `${failingMode.mode} has failed validation evidence; do not compare efficiency until correctness is restored.` };
  const missingMode = aggregate.modes.find((mode) => mode.samples === 0);
  if (missingMode) return { status: 'thin', claim_level: 'descriptive', decision: 'collect-all-modes', reason: `${missingMode.mode} has no samples, so the lab can only summarize existing runs.` };
  const required = taskPack.required_sample_size_per_mode || MIN_SAMPLES_PER_MODE;
  const thinMode = aggregate.modes.find((mode) => mode.samples < required);
  if (thinMode) return { status: 'thin', claim_level: 'descriptive', decision: 'collect-sample-size', reason: `${thinMode.mode} has ${thinMode.samples}/${required} samples; no performance claim should be made yet.` };
  return { status: 'ready', claim_level: 'comparable-local-signals', decision: 'compare-local-modes', reason: 'Each mode has visible sample size and passing validation evidence.' };
}

function rankModes(aggregate, claimLevel) {
  if (claimLevel !== 'comparable-local-signals') return [];
  return [...aggregate.modes]
    .sort((a, b) => (a.review_findings_avg - b.review_findings_avg) || (a.follow_up_fixes_avg - b.follow_up_fixes_avg) || (a.loc_avg - b.loc_avg) || (a.context_tokens_avg - b.context_tokens_avg))
    .map((mode, index) => ({ rank: index + 1, mode: mode.mode, reason: `findings ${mode.review_findings_avg}, follow-ups ${mode.follow_up_fixes_avg}, LOC ${mode.loc_avg}, tokens ${mode.context_tokens_avg}` }));
}

function outputPath(projectDir, basename) {
  const file = path.join(projectDir, 'context', basename);
  const resolved = path.resolve(file);
  if (!isPathInside(path.resolve(projectDir), resolved)) throw new Error('Lean lab output must stay inside --project-dir');
  return resolved;
}

function defaultTaskPackPath(root) {
  const fixture = path.join(root, 'fixtures', 'lean-lab', 'sample-task-pack.json');
  if (fs.existsSync(fixture)) return fixture;
  return path.join(defaultProjectDir(root), 'context', 'lean-lab-task-pack.json');
}

function buildLeanLab(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = safeProjectDir(opts.projectDir || defaultProjectDir(root));
  const contextDir = path.join(projectDir, 'context');
  const invalid = [];
  const taskPackPath = opts.taskPack || defaultTaskPackPath(root);
  const resultsPath = opts.results || path.join(contextDir, 'lean-lab-results.json');
  const taskPackSource = readJson(taskPackPath, root, 'task-pack', invalid);
  const resultsSource = readJson(resultsPath, root, 'results', invalid);
  const taskPack = taskPackSource.status === 'present' ? normalizeTaskPack(taskPackSource.value) : null;
  const results = resultsSource.status === 'present' ? normalizeResults(resultsSource.value) : null;
  const aggregate = aggregateRuns(results ? results.runs : []);
  const verdict = decideStatus({ taskPack, results, aggregate, invalid });
  const result = {
    schema_version: '1',
    generated_at: isoNow(),
    root,
    project_dir: projectDir,
    status: verdict.status,
    claim_level: verdict.claim_level,
    decision: verdict.decision,
    reason: verdict.reason,
    sources: {
      task_pack: { status: taskPackSource.status, path: taskPackSource.path },
      results: { status: resultsSource.status, path: resultsSource.path },
    },
    task_pack: taskPack ? {
      name: taskPack.name,
      tasks: taskPack.tasks.map((task) => ({ id: task.id, title: task.title, validation_count: task.validation.length })),
      required_sample_size_per_mode: taskPack.required_sample_size_per_mode,
    } : null,
    modes: aggregate.modes,
    unknown_runs: aggregate.unknown_runs,
    ranking: rankModes(aggregate, verdict.claim_level),
    invalid_artifacts: invalid,
    automation_boundaries: BOUNDARIES,
    boundary: `Read-only lean lab; ${BOUNDARIES.join(', ')}.`,
    next: verdict.status === 'ready' ? '/forgeflow-lean-benchmark --baseline <json> --current <json>' : '/forgeflow-lean-lab --task-pack <json> --results <json>',
    next_reason: verdict.reason,
    artifacts: {},
  };
  if (opts.write) {
    const markdownPath = outputPath(projectDir, 'lean-lab.md');
    const jsonPath = outputPath(projectDir, 'lean-lab.json');
    writeFileSafe(markdownPath, renderMarkdown(result));
    writeJsonSafe(jsonPath, result);
    result.artifacts = { markdown: markdownPath, json: jsonPath };
  }
  return result;
}

function renderMode(mode) {
  return `| ${mode.mode} | ${mode.samples} | ${mode.tasks_covered} | ${mode.validation_rate} | ${mode.loc_avg} | ${mode.files_changed_avg} | ${mode.review_findings_avg} | ${mode.context_tokens_avg} | ${mode.cost_usd_avg} | ${mode.latency_ms_avg} | ${mode.follow_up_fixes_avg} |`;
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Lean Lab',
    '',
    `Generated at: ${result.generated_at}`,
    `Status: ${result.status}`,
    `Claim level: ${result.claim_level}`,
    `Decision: ${result.decision}`,
    '',
    result.boundary,
    '',
    '## Sources',
    '',
    `- Task pack: ${result.sources.task_pack.status} (${result.sources.task_pack.path})`,
    `- Results: ${result.sources.results.status} (${result.sources.results.path})`,
    '',
    '## Task Pack',
    '',
  ];
  if (!result.task_pack) lines.push('- Missing.');
  else {
    lines.push(`- Name: ${result.task_pack.name}`);
    lines.push(`- Tasks: ${result.task_pack.tasks.length}`);
    lines.push(`- Required sample size per mode: ${result.task_pack.required_sample_size_per_mode}`);
  }
  lines.push('', '## Mode Summary', '', '| Mode | Samples | Tasks | Validation rate | LOC avg | Files avg | Review findings avg | Context tokens avg | Cost avg | Latency ms avg | Follow-up fixes avg |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const mode of result.modes) lines.push(renderMode(mode));
  lines.push('', '## Ranking', '');
  if (!result.ranking.length) lines.push('- No ranking. The evidence gate allows descriptive summaries only.');
  else for (const item of result.ranking) lines.push(`- ${item.rank}. ${item.mode}: ${item.reason}`);
  lines.push('', '## Boundaries', '');
  for (const item of result.automation_boundaries) lines.push(`- ${item}`);
  lines.push('', '## Invalid Artifacts', '');
  if (result.invalid_artifacts.length === 0) lines.push('- None.');
  else for (const item of result.invalid_artifacts) lines.push(`- ${item.label}: ${item.reason}`);
  lines.push('', `Next: ${result.next}`, `Why: ${result.next_reason}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildLeanLab(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  if (result.status === 'attention') process.exit(1);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
}

module.exports = {
  aggregateRuns,
  buildLeanLab,
  decideStatus,
  normalizeResults,
  normalizeTaskPack,
  parseArgs,
  renderMarkdown,
};
