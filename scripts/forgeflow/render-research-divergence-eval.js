#!/usr/bin/env node

const { buildResearchDivergence } = require('./render-research-divergence');

const TASKS = Object.freeze([
  Object.freeze({ id: 'architecture-boundary', task_class: 'architecture', control: false, expected_route: 'diverge', abstention_reason: 'Not applicable; the open-ended architecture task warrants divergence.', prompt: 'Choose a service boundary for a growing monolith without adding a new operational dependency.', constraints: ['The first experiment must be reversible.'] }),
  Object.freeze({ id: 'intermittent-timeout', task_class: 'reliability', control: false, expected_route: 'diverge', abstention_reason: 'Not applicable; the unresolved reliability task warrants divergence.', prompt: 'Investigate intermittent request timeouts when logs do not reveal a single failing component.', constraints: ['Do not assume the database is the cause.'] }),
  Object.freeze({ id: 'credential-rotation', task_class: 'security', control: false, expected_route: 'diverge', abstention_reason: 'Not applicable; the security design task warrants divergence.', prompt: 'Design a safer credential rotation path for a service with long-lived workers.', constraints: ['Existing credentials cannot be invalidated all at once.'] }),
  Object.freeze({ id: 'keyboard-workflow', task_class: 'accessibility-product', control: false, expected_route: 'diverge', abstention_reason: 'Not applicable; the accessibility-product design task warrants divergence.', prompt: 'Improve a complex keyboard workflow while preserving expert efficiency.', constraints: ['Every operation must remain keyboard accessible.'] }),
  Object.freeze({ id: 'canonical-http-status', task_class: 'canonical-lookup-control', control: true, expected_route: 'abstain', abstention_reason: 'A standards lookup has a canonical answer.', prompt: 'A successfully authenticated client requests a resource that does not exist. Select the canonical HTTP status.', constraints: ['Use standard HTTP semantics.'] }),
  Object.freeze({ id: 'known-root-cause-null', task_class: 'known-root-cause-control', control: true, expected_route: 'abstain', abstention_reason: 'The reproduced failure already has a verified root cause and direct fix.', prompt: 'A null dereference is reproduced at a named line because an optional value is used without a guard. Choose the direct repair.', constraints: ['The stack trace and null input are already verified.'] }),
  Object.freeze({ id: 'low-stakes-color', task_class: 'low-stakes-choice-control', control: true, expected_route: 'abstain', abstention_reason: 'The reversible low-stakes choice does not justify multi-agent exploration.', prompt: 'Choose one of two equally accessible internal placeholder colors for a temporary prototype.', constraints: ['Both options meet the same contrast requirement.'] }),
  Object.freeze({ id: 'canonical-exit-code', task_class: 'canonical-answer-control', control: true, expected_route: 'abstain', abstention_reason: 'A platform convention supplies the canonical answer.', prompt: 'A command completes successfully. Select its conventional process exit code.', constraints: ['Use conventional POSIX process semantics.'] }),
]);

function usage() {
  console.error('Usage: render-research-divergence-eval.js [--json]');
}

function parseArgs(argv) {
  const opts = { json: false, help: false };
  for (const arg of argv) {
    if (arg === '--json') {
      if (opts.json) throw new Error('Duplicate argument: --json');
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

function buildResearchDivergenceEval() {
  return {
    schema_version: '1',
    benchmark_id: 'forgeflow-research-divergence-v1',
    deterministic: true,
    execution: { mode: 'scaffold-only', executes_models: false, writes_files: false, calls_network: false },
    arms: [
      { id: 'baseline', route: 'research', instruction: 'Use the normal Forgeflow research route.' },
      { id: 'diverge', route: 'research --diverge', instruction: 'Use the divergent route, unless the task is a canonical-answer control that should abstain.' },
    ],
    metrics: {
      scored_0_to_5: ['breadth', 'novelty', 'trap_detection', 'actionability', 'builder_usefulness'],
      measured: ['latency_ms', 'cost_usd', 'failed'],
      routing: ['route_abstained'],
    },
    tasks: TASKS.map((item) => ({
      ...item,
      expected_route: item.expected_route,
      abstention_reason: item.abstention_reason,
      arms: {
        baseline: { task: item.prompt, immutable_constraints: item.constraints.slice(), route: 'research' },
        diverge: item.control
          ? { task: item.prompt, immutable_constraints: item.constraints.slice(), route: 'research --diverge', expected_route: item.expected_route, abstention_reason: item.abstention_reason }
          : buildResearchDivergence({ task: item.prompt, constraints: item.constraints }),
      },
    })),
    import_contract: {
      explicit_only: true,
      command: 'render-research-divergence-eval-results.js --evidence <json>',
      note: 'This scaffold never generates model-backed evidence. Results must be captured externally and imported explicitly.',
    },
    boundaries: [
      'Read-only and model-free: renders a deterministic benchmark scaffold only.',
      'Does not call models, agents, tools, or the network and does not write repository or Forgeflow state.',
      'Fixture evidence and thin samples cannot support comparative performance claims.',
    ],
  };
}

function renderMarkdown(result) {
  const lines = ['# Forgeflow Research Divergence Evaluation', '', result.boundaries[0], '', '## Tasks', ''];
  for (const task of result.tasks) lines.push(`- ${task.id}: ${task.task_class}${task.control ? ' (abstention control)' : ''}`);
  lines.push('', '## Metrics', '', `- Quality: ${result.metrics.scored_0_to_5.join(', ')}`, `- Operations: ${result.metrics.measured.join(', ')}`, `- Routing: ${result.metrics.routing.join(', ')}`, '', `Import: ${result.import_contract.command}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) return usage();
    const result = buildResearchDivergenceEval();
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  } catch (err) {
    console.error(`research divergence eval failed: ${err.message}`);
    usage();
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { TASKS, buildResearchDivergenceEval, parseArgs, renderMarkdown };
