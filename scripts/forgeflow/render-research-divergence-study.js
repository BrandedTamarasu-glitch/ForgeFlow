#!/usr/bin/env node

const { TASKS } = require('./render-research-divergence-eval');

const HOLDOUT_TASKS = Object.freeze([
  { id: 'event-sync-boundary', task_class: 'architecture-holdout', control: false, expected_route: 'diverge', prompt: 'Choose event-driven or request-driven synchronization between an order service and an existing fulfillment module under uncertain growth.', constraints: ['No new broker during the first experiment.', 'Rollback must take less than one hour.'] },
  { id: 'profile-sensitive-growth', task_class: 'reliability-holdout', control: false, expected_route: 'diverge', prompt: 'Investigate process memory growth that disappears whenever a profiler is attached.', constraints: ['The first probe must add under 1% CPU overhead.'] },
  { id: 'tenant-blast-radius', task_class: 'security-holdout', control: false, expected_route: 'diverge', prompt: 'Design tenant isolation for a hosted job runner where simpler operations conflict with blast-radius reduction.', constraints: ['Jobs require outbound network access.', 'Cross-tenant credential exposure is unacceptable.'] },
  { id: 'destructive-recovery', task_class: 'accessibility-product-holdout', control: false, expected_route: 'diverge', prompt: 'Design recovery from destructive bulk actions for keyboard, screen-reader, and mobile users.', constraints: ['Recovery cannot depend on hover, precise pointing, or remembering an opaque identifier.'] },
  { id: 'canonical-method-not-allowed', task_class: 'standards-holdout-control', control: true, expected_route: 'abstain', prompt: 'A resource exists but does not support the requested HTTP method. Select the standard response status and required response-header behavior.', constraints: ['Use standard HTTP semantics.'] },
  { id: 'known-root-cause-off-by-one', task_class: 'known-root-cause-holdout-control', control: true, expected_route: 'abstain', prompt: 'A failing pagination test proves the final record is omitted because the loop uses < lastIndex instead of <= lastIndex. Apply the direct repair.', constraints: ['Do not redesign pagination.'] },
  { id: 'low-stakes-label-order', task_class: 'low-stakes-holdout-control', control: true, expected_route: 'abstain', prompt: 'Choose whether two equally understandable temporary internal labels appear alphabetically or in creation order.', constraints: ['The choice is reversible and has no compatibility impact.'] },
  { id: 'documented-rename', task_class: 'mechanical-holdout-control', control: true, expected_route: 'abstain', prompt: 'A dependency migration guide says oldOption was renamed to newOption with identical semantics. Update the verified call site.', constraints: ['Do not reconsider the dependency architecture.'] },
]);

function buildStudy({ pilot = false } = {}) {
  const tasks = pilot ? TASKS : [...TASKS, ...HOLDOUT_TASKS];
  const openTasks = tasks.filter((task) => !task.control);
  const controls = tasks.filter((task) => task.control);
  const selectedOpen = openTasks;
  const selectedControls = controls;

  return {
    schema_version: '1',
    study_id: 'forgeflow-research-divergence-paired-v1',
    pilot,
    execution: {
      default_mode: 'preview',
      executes_models: false,
      writes_files: false,
      note: 'Live execution is delegated only by run-research-divergence-study.js after its explicit safety gate.',
    },
    runner_contract: {
      invocation: '<absolute-runner-path> <request-json-path>',
      request_contains: ['experiment_id', 'task', 'arm', 'iteration', 'checkout', 'output_dir'],
      capture: ['exit_code', 'signal', 'latency_ms', 'stdout', 'stderr', 'runner_sha256', 'source_repo'],
    },
    experiments: [
      {
        id: 'A-explicit-arm-comparison',
        question: 'Does explicit divergent research improve open-ended research decisions?',
        tasks: selectedOpen.map(copyTask),
        arms: [
          { id: 'baseline', route: 'research', explicit_diverge: false },
          { id: 'diverge', route: 'research --diverge', explicit_diverge: true },
        ],
        limitation: 'Because the treatment explicitly requests --diverge, Experiment A cannot test abstention or automatic routing.',
      },
      {
        id: 'B-route-classification-controls',
        question: 'Can a prospective neutral route classifier distinguish open-ended tasks from controls?',
        tasks: [...selectedOpen, ...selectedControls].map(copyTask),
        arms: [{ id: 'classify', route: 'research-route-classification', explicit_diverge: false }],
        instruction: 'Classify the appropriate route without receiving an explicit --diverge instruction. Do not execute research. This is prospective classifier evidence, not current Forgeflow auto-routing evidence.',
      },
    ],
    boundaries: [
      'Preview is deterministic, model-free, network-free, and read-only.',
      'Raw runner output belongs only in the explicitly supplied study directory and must never enter .forgeflow/memory.',
      'Experiment A measures explicit baseline versus explicit divergence; Experiment B separately measures routing classification.',
      'Experiment B is prospective because the current Forgeflow research entry point does not auto-route.',
    ],
  };
}

function copyTask(task) {
  return {
    id: task.id,
    task_class: task.task_class,
    expected_route: task.expected_route,
    prompt: task.prompt,
    immutable_constraints: task.constraints.slice(),
  };
}

function parseArgs(argv) {
  const result = { json: false, pilot: false, help: false };
  for (const arg of argv) {
    if (arg === '--json' && !result.json) result.json = true;
    else if (arg === '--pilot' && !result.pilot) result.pilot = true;
    else if (arg === '--help' || arg === '-h') result.help = true;
    else if (arg === '--json' || arg === '--pilot') throw new Error(`Duplicate argument: ${arg}`);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

function renderMarkdown(study) {
  const lines = ['# Forgeflow Research Divergence Study', '', study.boundaries[0], ''];
  for (const experiment of study.experiments) {
    lines.push(`## ${experiment.id}`, '', experiment.question, '');
    for (const task of experiment.tasks) lines.push(`- ${task.id}: ${task.task_class}`);
    if (experiment.limitation) lines.push('', `Limitation: ${experiment.limitation}`);
    lines.push('');
  }
  lines.push('Use run-research-divergence-study.js for an explicitly gated live run.', '');
  return lines.join('\n');
}

function usage() {
  console.error('Usage: render-research-divergence-study.js [--json] [--pilot]');
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) return usage();
    const study = buildStudy(options);
    process.stdout.write(options.json ? `${JSON.stringify(study, null, 2)}\n` : renderMarkdown(study));
  } catch (error) {
    console.error(`research divergence study render failed: ${error.message}`);
    usage();
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { HOLDOUT_TASKS, buildStudy, parseArgs, renderMarkdown };
