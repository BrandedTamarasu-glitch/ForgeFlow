#!/usr/bin/env node

const path = require('path');
const { safeReadTextFile } = require('./file-safety');
const { TASKS } = require('./render-research-divergence-eval');

const ARMS = Object.freeze(['baseline', 'diverge']);
const QUALITY_METRICS = Object.freeze(['breadth', 'novelty', 'trap_detection', 'actionability', 'builder_usefulness']);
const METRIC_KEYS = Object.freeze([...QUALITY_METRICS, 'latency_ms', 'cost_usd', 'failed', 'route_abstained']);

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = expected.slice().sort();
  if (actual.join('|') !== wanted.join('|')) throw new Error(`${label} keys must be exactly: ${wanted.join(', ')}`);
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), evidence: '', json: false, help: false };
  const seen = new Set();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root' || arg === '--evidence') {
      if (seen.has(arg)) throw new Error(`Duplicate argument: ${arg}`);
      seen.add(arg);
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      if (arg === '--root') opts.root = path.resolve(value);
      else opts.evidence = path.resolve(value);
      i += 1;
    } else if (arg === '--json') {
      if (seen.has(arg)) throw new Error(`Duplicate argument: ${arg}`);
      seen.add(arg);
      opts.json = true;
    }
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!opts.help && !opts.evidence) throw new Error('Missing required argument: --evidence');
  return opts;
}

function validateEvidence(value) {
  exactKeys(value, ['schema_version', 'benchmark_id', 'source', 'runs'], 'evidence');
  if (value.schema_version !== '1' || value.benchmark_id !== 'forgeflow-research-divergence-v1') throw new Error('Unsupported evidence schema or benchmark id');
  exactKeys(value.source, ['generation_kind', 'provider', 'model', 'judge', 'captured_at', 'fixture'], 'source');
  if (!['model-backed', 'human-authored'].includes(value.source.generation_kind)) throw new Error('source.generation_kind must be model-backed or human-authored');
  if (!value.source.provider || !value.source.model || !/^\d{4}-\d{2}-\d{2}T/.test(value.source.captured_at)) throw new Error('source provenance must include provider, model, and ISO captured_at');
  exactKeys(value.source.judge, ['kind', 'provider', 'model', 'method'], 'source.judge');
  if (!['model', 'human'].includes(value.source.judge.kind)) throw new Error('source.judge.kind must be model or human');
  if (![value.source.judge.provider, value.source.judge.model, value.source.judge.method].every((item) => typeof item === 'string' && item.trim())) throw new Error('source.judge provenance must be non-empty');
  if (typeof value.source.fixture !== 'boolean') throw new Error('source.fixture must be boolean');
  if (!Array.isArray(value.runs) || value.runs.length === 0) throw new Error('runs must be a non-empty array');
  const taskIds = new Set(TASKS.map((task) => task.id));
  const seen = new Set();
  for (const [index, run] of value.runs.entries()) {
    exactKeys(run, ['task_id', 'arm', 'iteration', 'metrics'], `runs[${index}]`);
    if (!taskIds.has(run.task_id)) throw new Error(`runs[${index}].task_id is unknown`);
    if (!ARMS.includes(run.arm)) throw new Error(`runs[${index}].arm is unknown`);
    if (!Number.isInteger(run.iteration) || run.iteration < 1) throw new Error(`runs[${index}].iteration must be a positive integer`);
    const key = `${run.task_id}:${run.arm}:${run.iteration}`;
    if (seen.has(key)) throw new Error(`duplicate run: ${key}`);
    seen.add(key);
    exactKeys(run.metrics, METRIC_KEYS, `runs[${index}].metrics`);
    for (const metric of QUALITY_METRICS) if (!Number.isInteger(run.metrics[metric]) || run.metrics[metric] < 0 || run.metrics[metric] > 5) throw new Error(`${key} ${metric} must be an integer from 0 to 5`);
    if (!Number.isFinite(run.metrics.latency_ms) || run.metrics.latency_ms < 0) throw new Error(`${key} latency_ms must be non-negative`);
    if (!Number.isFinite(run.metrics.cost_usd) || run.metrics.cost_usd < 0) throw new Error(`${key} cost_usd must be non-negative`);
    if (typeof run.metrics.failed !== 'boolean' || typeof run.metrics.route_abstained !== 'boolean') throw new Error(`${key} failed and route_abstained must be booleans`);
  }
  const iterations = [...new Set(value.runs.map((run) => run.iteration))];
  const orderedIterations = iterations.slice().sort((a, b) => a - b);
  if (orderedIterations.some((iteration, index) => iteration !== index + 1)) throw new Error('iterations must be consecutive starting at 1');
  for (const task of TASKS) {
    for (const iteration of iterations) {
      for (const arm of ARMS) {
        if (!seen.has(`${task.id}:${arm}:${iteration}`)) throw new Error(`missing paired run: ${task.id}:${arm}:${iteration}`);
      }
    }
  }
  return value;
}

function average(values) {
  return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4)) : 0;
}

function summarizeArm(runs, arm) {
  const selected = runs.filter((run) => run.arm === arm);
  const quality = Object.fromEntries(QUALITY_METRICS.map((metric) => [metric, average(selected.map((run) => run.metrics[metric]))]));
  return {
    arm,
    runs: selected.length,
    quality,
    avg_latency_ms: average(selected.map((run) => run.metrics.latency_ms)),
    avg_cost_usd: average(selected.map((run) => run.metrics.cost_usd)),
    failure_rate: average(selected.map((run) => Number(run.metrics.failed))),
    route_abstention_rate: average(selected.map((run) => Number(run.metrics.route_abstained))),
  };
}

function pairedComparison(runs) {
  const lookup = new Map(runs.map((run) => [`${run.task_id}:${run.iteration}:${run.arm}`, run]));
  const pairs = [];
  for (const run of runs.filter((item) => item.arm === 'baseline')) {
    const diverge = lookup.get(`${run.task_id}:${run.iteration}:diverge`);
    if (diverge) pairs.push({ baseline: run.metrics, diverge: diverge.metrics });
  }
  const quality = {};
  for (const metric of QUALITY_METRICS) {
    const deltas = pairs.map((pair) => pair.diverge[metric] - pair.baseline[metric]);
    quality[metric] = {
      avg_delta: average(deltas),
      wins: deltas.filter((value) => value > 0).length,
      ties: deltas.filter((value) => value === 0).length,
      losses: deltas.filter((value) => value < 0).length,
    };
  }
  return {
    complete_pairs: pairs.length,
    quality,
    operations: {
      avg_latency_ms_delta: average(pairs.map((pair) => pair.diverge.latency_ms - pair.baseline.latency_ms)),
      avg_cost_usd_delta: average(pairs.map((pair) => pair.diverge.cost_usd - pair.baseline.cost_usd)),
      failure_rate_delta: average(pairs.map((pair) => Number(pair.diverge.failed) - Number(pair.baseline.failed))),
    },
  };
}

function evidenceGrade(evidence) {
  const iterations = new Set(evidence.runs.map((run) => run.iteration)).size;
  const expected = TASKS.length * ARMS.length * iterations;
  const complete = evidence.runs.length === expected;
  if (evidence.source.fixture) return { grade: 'illustrative', claims_allowed: false, reason: 'Fixture evidence is for contract testing only.' };
  if (!complete || iterations < 3) return { grade: 'thin', claims_allowed: false, reason: 'Comparative claims require complete arm coverage and at least 3 iterations per task.' };
  if (evidence.source.judge.kind !== 'human' || iterations < 5) return { grade: 'exploratory', claims_allowed: false, reason: 'Publishable claims require human-judged evidence with at least 5 iterations per task; model judging is not human validation.' };
  return { grade: 'publishable', claims_allowed: true, reason: 'Complete human-rated evidence meets the minimum sample threshold.' };
}

function buildResults(opts) {
  const parsed = JSON.parse(safeReadTextFile(opts.evidence, opts.root).content);
  const evidence = validateEvidence(parsed);
  const grade = evidenceGrade(evidence);
  const taskById = new Map(TASKS.map((task) => [task.id, task]));
  const routed = evidence.runs.filter((run) => run.arm === 'diverge');
  const controls = routed.filter((run) => taskById.get(run.task_id).control);
  const openEnded = routed.filter((run) => !taskById.get(run.task_id).control);
  const correct = routed.filter((run) => taskById.get(run.task_id).control === run.metrics.route_abstained);
  return {
    schema_version: '1',
    benchmark_id: evidence.benchmark_id,
    status: 'valid',
    evidence: { source: evidence.source, runs: evidence.runs.length, ...grade },
    arms: ARMS.map((arm) => summarizeArm(evidence.runs, arm)),
    comparison: pairedComparison(evidence.runs),
    routing: {
      evaluated_runs: routed.length,
      correct_runs: correct.length,
      route_accuracy: average(routed.map((run) => Number(taskById.get(run.task_id).control === run.metrics.route_abstained))),
      control_runs: controls.length,
      control_abstention_rate: average(controls.map((run) => Number(run.metrics.route_abstained))),
      open_ended_runs: openEnded.length,
      open_ended_non_abstention_rate: average(openEnded.map((run) => Number(!run.metrics.route_abstained))),
    },
    claim: grade.claims_allowed ? 'Evidence meets the minimum publication gate; report effect sizes and uncertainty with any claim.' : 'No comparative performance claim is supported by this evidence.',
    boundary: 'Read-only validator: imports explicit evidence only and does not call models, agents, or the network or write Forgeflow state.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Research Divergence Evaluation Results',
    '',
    `Status: ${result.status}`,
    `Evidence grade: ${result.evidence.grade}`,
    `Claims allowed: ${result.evidence.claims_allowed}`,
    `Complete pairs: ${result.comparison.complete_pairs}`,
    '',
    result.claim,
    '',
    '## Evidence',
    '',
    `- Generation: ${result.evidence.source.generation_kind} (${result.evidence.source.provider}/${result.evidence.source.model})`,
    `- Judge: ${result.evidence.source.judge.kind} (${result.evidence.source.judge.provider}/${result.evidence.source.judge.model}; ${result.evidence.source.judge.method})`,
    `- Captured: ${result.evidence.source.captured_at}`,
    `- Fixture: ${result.evidence.source.fixture}`,
    `- Grade reason: ${result.evidence.reason}`,
    '',
    '## Quality comparison',
    '',
    '| Metric | Diverge delta | Wins | Ties | Losses |',
    '|---|---:|---:|---:|---:|',
  ];
  for (const metric of QUALITY_METRICS) {
    const row = result.comparison.quality[metric];
    lines.push(`| ${metric} | ${row.avg_delta} | ${row.wins} | ${row.ties} | ${row.losses} |`);
  }
  lines.push(
    '',
    '## Operational comparison',
    '',
    `- Average latency delta: ${result.comparison.operations.avg_latency_ms_delta} ms`,
    `- Average cost delta: $${result.comparison.operations.avg_cost_usd_delta}`,
    `- Failure-rate delta: ${result.comparison.operations.failure_rate_delta}`,
    '',
    '## Routing',
    '',
    `- Accuracy: ${result.routing.route_accuracy}`,
    `- Control abstention rate: ${result.routing.control_abstention_rate}`,
    `- Open-ended non-abstention rate: ${result.routing.open_ended_non_abstention_rate}`,
    '',
    result.boundary,
    '',
  );
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) return console.error('Usage: render-research-divergence-eval-results.js --evidence <json> [--root <repo>] [--json]');
    const result = buildResults(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  } catch (err) {
    console.error(`research divergence eval results failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { ARMS, METRIC_KEYS, QUALITY_METRICS, buildResults, evidenceGrade, parseArgs, renderMarkdown, validateEvidence };
