#!/usr/bin/env node

const LIMITS = Object.freeze({ task: 10000 });
const DEFAULT_PATTERNS = Object.freeze([
  /\b(canonical|standard|status code|exit code|known root cause|direct repair|mechanical|renamed?|identical semantics|equally (?:accessible|understandable)|low[- ]stakes)\b/i,
]);
const CONSEQUENCE_PATTERNS = Object.freeze([
  /\b(architecture|security|credential|reliability|accessibility|design|boundary|migration|recovery|isolation|timeout|failure|risk)\b/i,
]);
const UNCERTAINTY_PATTERNS = Object.freeze([
  /\b(or|between|trade-?off|uncertain|intermittent|multiple|several|options?|unknown|plausible|growth)\b/i,
]);

function usage() {
  console.error('Usage: render-research-divergence-advice.js --task <task> [--json]');
}

function parseArgs(argv) {
  const options = { task: '', json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--task') {
      if (options.task) throw new Error('Duplicate argument: --task');
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error('Missing value for --task');
      options.task = value.trim();
    } else if (arg === '--json') {
      if (options.json) throw new Error('Duplicate argument: --json');
      options.json = true;
    } else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.help) return options;
  if (!options.task) throw new Error('Missing required argument: --task');
  if (options.task.length > LIMITS.task) throw new Error(`Task exceeds ${LIMITS.task} characters`);
  return options;
}

function matches(patterns, task) {
  return patterns.some((pattern) => pattern.test(task));
}

function buildAdvice(options) {
  if (!options || typeof options.task !== 'string' || !options.task.trim()) throw new Error('A non-empty task is required');
  const task = options.task.trim();
  const defaultSignal = matches(DEFAULT_PATTERNS, task);
  const consequential = matches(CONSEQUENCE_PATTERNS, task);
  const uncertain = matches(UNCERTAINTY_PATTERNS, task);
  const recommendDivergence = !defaultSignal && consequential && uncertain;
  const reason = defaultSignal
    ? 'The task has a canonical, verified, mechanical, or low-stakes signal, so divergent research is unlikely to repay its overhead.'
    : recommendDivergence
      ? 'The task is consequential and has multiple plausible approaches or uncertainty, matching the development-pilot profile for divergent research.'
      : 'The task does not clearly establish both consequence and meaningful uncertainty, so use normal research unless the user explicitly requests divergence.';
  return {
    schema_version: '1',
    task,
    recommendation: recommendDivergence ? 'diverge' : 'default',
    suggested_invocation: recommendDivergence ? '$research --diverge' : '$research',
    reason,
    signals: { canonical_or_mechanical: defaultSignal, consequential, uncertainty_or_multiple_approaches: uncertain },
    pilot_tradeoff: {
      evidence: 'Clean development pilot, one iteration across four open-ended tasks; blinded model judge only.',
      divergent_median_latency_vs_baseline: '1.47x',
      divergent_median_tokens_vs_baseline: '0.88x',
      boundary: 'This is advisory-only. It does not auto-route, invoke research, call models, write state, record telemetry, or claim general superiority.',
    },
  };
}

function renderMarkdown(result) {
  return [
    '# Forgeflow Research Divergence Advice',
    '',
    `Recommendation: \`${result.suggested_invocation}\``,
    '',
    result.reason,
    '',
    '## Pilot tradeoff',
    '',
    `- Divergent median latency: ${result.pilot_tradeoff.divergent_median_latency_vs_baseline} baseline.`,
    `- Divergent median tokens: ${result.pilot_tradeoff.divergent_median_tokens_vs_baseline} baseline.`,
    `- Evidence: ${result.pilot_tradeoff.evidence}`,
    `- Boundary: ${result.pilot_tradeoff.boundary}`,
    '',
  ].join('\n');
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) return usage();
    const result = buildAdvice(options);
    process.stdout.write(options.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  } catch (error) {
    console.error(error.message);
    usage();
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { buildAdvice, parseArgs, renderMarkdown };
