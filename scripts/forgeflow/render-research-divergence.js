#!/usr/bin/env node

const FRAME_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'inversion',
    instruction: 'Invert the apparent goal or default approach. Explore what becomes possible when the obvious solution is treated as the constraint.',
  }),
  Object.freeze({
    id: 'remove-assumption',
    instruction: 'Identify one load-bearing assumption in the task and develop alternatives that remain viable when that assumption is removed.',
  }),
  Object.freeze({
    id: '3am-on-call',
    instruction: 'Approach the task as the engineer responsible for diagnosing and operating the result at 3am. Favor observable, reversible, and recoverable options.',
  }),
]);

const CRITIC_FIELDS = Object.freeze([
  'strength',
  'attraction',
  'hidden_trap_and_mechanism',
  'disconfirming_test',
  'salvage_condition',
  'first_implementation_step',
]);

function usage() {
  console.error('Usage: render-research-divergence.js --task <task> [--constraint <immutable constraint>]... [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1];
  if (typeof value !== 'string' || !value.trim() || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }
  return value.trim();
}

function parseArgs(argv) {
  const opts = { task: '', constraints: [], json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--task') {
      if (opts.task) throw new Error('Duplicate argument: --task');
      opts.task = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--constraint') {
      opts.constraints.push(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--json') {
      if (opts.json) throw new Error('Duplicate argument: --json');
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (opts.help) return opts;
  if (!opts.task) throw new Error('Missing required argument: --task');
  if (opts.task.length > 10000) throw new Error('Task exceeds 10000 characters');
  if (opts.constraints.some((constraint) => constraint.length > 2000)) {
    throw new Error('Constraint exceeds 2000 characters');
  }
  return opts;
}

function branchPrompt(task, constraints, frame) {
  return {
    frame_id: frame.id,
    task,
    immutable_constraints: constraints.slice(),
    frame_instruction: frame.instruction,
    isolation_contract: [
      'Use only this task, its immutable constraints, and the assigned frame.',
      'Do not request or use project memory, prior recommendations, other branch outputs, or critic output.',
      'Generate candidate approaches without ranking, rejecting, scoring, or criticizing them.',
      'Do not communicate with other branches.',
    ],
    requested_output: {
      approach: 'A materially distinct approach.',
      why_it_could_work: 'Explain the mechanism that makes the approach work.',
      key_assumptions: 'State the assumptions the approach still depends on.',
      failure_signals: 'State observable evidence that would disconfirm the approach.',
      first_experiment: 'Name the smallest useful falsification experiment.',
    },
  };
}

function buildResearchDivergence(opts) {
  if (!opts || typeof opts.task !== 'string' || !opts.task.trim()) {
    throw new Error('A non-empty task is required');
  }
  const task = opts.task.trim();
  const constraints = opts.constraints === undefined ? [] : opts.constraints;
  if (!Array.isArray(constraints) || constraints.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error('Constraints must be non-empty strings');
  }
  const normalizedConstraints = constraints.map((item) => item.trim());
  const branches = FRAME_DEFINITIONS.map((frame) => branchPrompt(task, normalizedConstraints, frame));
  return {
    schema_version: '1',
    mode: 'research-divergence-prototype',
    task,
    deterministic: true,
    frame_ids: FRAME_DEFINITIONS.map((frame) => frame.id),
    branches,
    critic: {
      phase: 'after-all-branches-complete',
      input_contract: 'After isolated generation ends, receive the task, immutable constraints, completed branch outputs, and independently gathered discussion, memory, codebase, accessibility, and Atlas evidence. None of that evidence may flow back into a branch.',
      instructions: [
        'Cluster duplicated approaches by underlying mechanism before evaluating them.',
        'Preserve at least one non-obvious viable candidate when the evidence supports it.',
        'Reject candidates that violate immutable constraints and give a concrete reason.',
        'For every shortlisted candidate, return every required field.',
      ],
      required_fields: CRITIC_FIELDS.slice(),
      candidate_contract: Object.fromEntries(CRITIC_FIELDS.map((field) => [field, 'required non-empty value'])),
      overall_required: ['non_obvious_viable_candidate', 'load_bearing_risk', 'first_falsification_experiment', 'final_recommendation'],
    },
    execution: {
      branch_calls: branches.length,
      critic_calls: 1,
      estimated_call_count: branches.length + 1,
      executes_calls: false,
    },
    boundaries: [
      'This helper is read-only and deterministic.',
      'It renders prompt payloads only; it does not call an LLM or spawn agents.',
      'It does not read project memory, write files, modify repository state, call the network, approve, commit, or push.',
      'Raw divergent ideas are not promoted into project memory by this helper.',
    ],
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Research Divergence Prototype',
    '',
    `Task: ${result.task}`,
    `Estimated calls: ${result.execution.estimated_call_count} (${result.execution.branch_calls} isolated branches + ${result.execution.critic_calls} critic)`,
    '',
    '## Boundaries',
    '',
    ...result.boundaries.map((item) => `- ${item}`),
  ];
  for (const branch of result.branches) {
    lines.push('', `## Branch: ${branch.frame_id}`, '', branch.frame_instruction, '', 'Isolation contract:', '');
    for (const item of branch.isolation_contract) lines.push(`- ${item}`);
  }
  lines.push('', '## Critic Contract', '', `Phase: ${result.critic.phase}`, '', 'Required fields:', '');
  for (const field of result.critic.required_fields) lines.push(`- ${field}`);
  lines.push('');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    return;
  }
  const result = buildResearchDivergence(opts);
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

module.exports = {
  CRITIC_FIELDS,
  FRAME_DEFINITIONS,
  branchPrompt,
  buildResearchDivergence,
  parseArgs,
  renderMarkdown,
};
