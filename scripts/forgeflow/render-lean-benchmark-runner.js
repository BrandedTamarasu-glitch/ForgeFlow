#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { writeFileSafe, writeJsonSafe } = require('./file-safety');
const { importPromptfooResults } = require('./render-lean-benchmark-results');

const TASKS = [
  { id: 'email-validator', prompt: 'Write a function that validates email addresses.', correctness: 'executable' },
  { id: 'debounce', prompt: 'Write a reusable debounce function in vanilla JavaScript.', correctness: 'executable' },
  { id: 'csv-sum', prompt: "Write code that reads sales.csv and sums the 'amount' column.", correctness: 'executable' },
  { id: 'countdown', prompt: 'Build a countdown timer component that counts down from a given number of seconds.', correctness: 'structural' },
  { id: 'rate-limit', prompt: "Add rate limiting to an endpoint so users can't spam it.", correctness: 'structural' },
  { id: 'forgeflow-command-wrapper', prompt: 'Update a Forgeflow slash-command wrapper to accept a new safe flag and reject unsupported arguments.', correctness: 'structural' },
  { id: 'forgeflow-runtime-manifest', prompt: 'Add a new Forgeflow runtime helper and wire it through install manifest, runtime inventory, and command coverage tests.', correctness: 'structural' },
  { id: 'forgeflow-dashboard-readiness', prompt: 'Extend the Forgeflow dashboard readiness API with an additive card while preserving read-only behavior and schema compatibility.', correctness: 'structural' },
  { id: 'forgeflow-release-gate', prompt: 'Add a new release-readiness check, document it in the release gate, and keep the advisory boundary intact.', correctness: 'structural' },
];

const ARMS = [
  { name: 'baseline', system: '' },
  { name: 'lean-balanced', system: 'FORGEFLOW_LEAN_PROFILE=balanced' },
  { name: 'lean-strict', system: 'FORGEFLOW_LEAN_PROFILE=strict' },
];

function usage() {
  console.error('Usage: render-lean-benchmark-runner.js [--root <repo>] [--project-dir <dir>] [--write] [--run] [--runner <path>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', write: false, run: false, runner: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--write') {
      opts.write = true;
    } else if (arg === '--run') {
      opts.run = true;
      opts.write = true;
    } else if (arg === '--runner') {
      opts.runner = path.resolve(requireValue(argv, arg, i));
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

function outDir(projectDir) {
  return path.join(projectDir, 'context', 'lean-benchmark-runner');
}

function executableOnPath(name, pathValue = process.env.PATH || '') {
  for (const dir of String(pathValue).split(path.delimiter).filter(Boolean)) {
    const file = path.join(dir, name);
    try {
      fs.accessSync(file, fs.constants.X_OK);
      return file;
    } catch (_err) {
      // Continue scanning PATH.
    }
  }
  return '';
}

function runPromptfoo(dir, opts = {}) {
  if (process.env.FORGEFLOW_BENCHMARK_ALLOW_NETWORK !== '1') {
    return {
      status: 'blocked',
      command: '',
      reason: 'Set FORGEFLOW_BENCHMARK_ALLOW_NETWORK=1 before model-backed benchmark execution.',
    };
  }
  const runner = opts.runner || executableOnPath('promptfoo');
  if (!runner) {
    return {
      status: 'blocked',
      command: 'promptfoo eval -c promptfooconfig.yaml -o raw-results.json',
      reason: 'promptfoo executable was not found on PATH. Install it or pass --runner <path>.',
    };
  }
  const args = ['eval', '-c', path.join(dir, 'promptfooconfig.yaml'), '-o', path.join(dir, 'raw-results.json')];
  const spawn = opts.runnerFn || spawnSync;
  const result = spawn(runner, args, { cwd: dir, encoding: 'utf8' });
  return {
    status: !result.error && result.status === 0 ? 'pass' : 'fail',
    command: `${runner} ${args.join(' ')}`,
    exit_code: result.status,
    stdout: String(result.stdout || '').trim().slice(0, 1200),
    stderr: String(result.stderr || result.error?.message || '').trim().slice(0, 1200),
    output: path.join(dir, 'raw-results.json'),
  };
}

function importRunOutput(root, dir, run) {
  if (run.status !== 'pass' || !run.output || !fs.existsSync(run.output)) return null;
  const output = path.join(dir, 'normalized-results.json');
  const normalized = importPromptfooResults(dir, run.output, output);
  return {
    output,
    runs: Array.isArray(normalized.runs) ? normalized.runs.length : 0,
    next: `/forgeflow-lean-benchmark-results --results ${output}`,
  };
}

function runnerScript(result) {
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'test -f "${ROOT}/plan.json"',
    'test -f "${ROOT}/tasks.json"',
    'test -f "${ROOT}/promptfooconfig.yaml"',
    'test -f "${ROOT}/arms/baseline.js"',
    'test -f "${ROOT}/arms/lean-balanced.js"',
    'test -f "${ROOT}/arms/lean-strict.js"',
    'echo "Forgeflow lean benchmark scaffold is complete."',
    'echo "This script does not call model APIs. Run promptfoo manually after setting provider credentials."',
    '',
  ].join('\n');
}

function armScript(arm) {
  const guidance = arm.system
    ? `Apply this Forgeflow lean profile before answering: ${arm.system}. Preserve correctness, safety, accessibility, trust-boundary validation, and explicit requirements.`
    : 'Answer normally without Forgeflow lean guidance.';
  return [
    'module.exports = async function forgeflowLeanBenchmarkPrompt(vars) {',
    `  const guidance = ${JSON.stringify(guidance)};`,
    '  return `${guidance}\\n\\nTask:\\n${vars.task}`;',
    '};',
    '',
  ].join('\n');
}

function promptfooConfig() {
  return [
    'description: "Forgeflow lean benchmark evidence pack. Opt-in only; requires provider keys and explicit runner invocation."',
    '',
    'providers:',
    '  - id: openai:gpt-5.4-mini',
    '    config: { max_completion_tokens: 4096 }',
    '',
    'prompts:',
    '  - id: file://arms/baseline.js',
    '    label: baseline',
    '  - id: file://arms/lean-balanced.js',
    '    label: lean-balanced',
    '  - id: file://arms/lean-strict.js',
    '    label: lean-strict',
    '',
    'tests:',
    ...TASKS.map((task) => `  - vars: { task: ${JSON.stringify(task.prompt)} }`),
    '',
  ].join('\n');
}

function rawResultTemplate() {
  return {
    schema_version: '1',
    provider: '<provider>',
    model: '<model>',
    run_date: '<YYYY-MM-DD>',
    repeat: 10,
    caveats: 'Session cost can differ because real agent sessions re-inject guidance each turn.',
    runs: TASKS.flatMap((task) => ARMS.map((arm) => ({
      task_id: task.id,
      arm: arm.name,
      iteration: 1,
      metrics: {
        code_loc: 0,
        correct: 0,
        cost_usd: 0,
        latency_seconds: 0,
      },
    }))),
    claims: {},
  };
}

function reportTemplate() {
  return [
    '# Forgeflow Lean Benchmark Report',
    '',
    'Fill this report from `raw-results.template.json` after running the promptfoo config.',
    '',
    '## Required Evidence',
    '',
    '- Provider and model',
    '- Run date',
    '- Repeat count of at least 3',
    '- Correctness gate per run',
    '- Cost and latency caveat for full agent sessions',
    '',
    '## Validation',
    '',
    '```bash',
    'node scripts/forgeflow/render-lean-benchmark-results.js --promptfoo raw-results.json --out normalized-results.json',
    'node scripts/forgeflow/render-lean-benchmark-results.js --results normalized-results.json',
    '```',
    '',
  ].join('\n');
}

function buildLeanBenchmarkRunner(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const dir = outDir(projectDir);
  const commands = [
    {
      name: 'local-aggregate-compare',
      command: 'node scripts/forgeflow/render-lean-benchmark.js --baseline <baseline.json> --current <current.json>',
      requires_network: false,
      requires_model_key: false,
    },
    {
      name: 'model-backed-repeat-run',
      command: 'FORGEFLOW_BENCHMARK_ALLOW_NETWORK=1 <model-runner> --repeat 10 --tasks benchmark-plan.json',
      requires_network: true,
      requires_model_key: true,
    },
  ];
  const result = {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    status: 'ready',
    tasks: TASKS,
    arms: ARMS,
    commands,
    output_dir: dir,
    artifacts: {},
    boundary: 'Lean benchmark runner is an opt-in scaffold. Default output does not call models, install dependencies, mutate context, commit, push, or call the network. Model-backed runs require an explicit external runner and FORGEFLOW_BENCHMARK_ALLOW_NETWORK=1.',
    next: opts.write ? `${dir}/plan.json` : '/forgeflow-lean-benchmark-runner --write',
  };
  if (opts.write) {
    writeJsonSafe(path.join(dir, 'plan.json'), result);
    writeFileSafe(path.join(dir, 'run.sh'), runnerScript(result));
    writeJsonSafe(path.join(dir, 'tasks.json'), { schema_version: '1', tasks: TASKS, arms: ARMS });
    writeJsonSafe(path.join(dir, 'raw-results.template.json'), rawResultTemplate());
    writeFileSafe(path.join(dir, 'promptfooconfig.yaml'), promptfooConfig());
    writeFileSafe(path.join(dir, 'report.template.md'), reportTemplate());
    for (const arm of ARMS) writeFileSafe(path.join(dir, 'arms', `${arm.name}.js`), armScript(arm));
    writeFileSafe(path.join(dir, 'README.md'), renderMarkdown(result));
    result.artifacts = {
      json: path.join(dir, 'plan.json'),
      script: path.join(dir, 'run.sh'),
      tasks: path.join(dir, 'tasks.json'),
      raw_results_template: path.join(dir, 'raw-results.template.json'),
      promptfoo: path.join(dir, 'promptfooconfig.yaml'),
      report_template: path.join(dir, 'report.template.md'),
      arms: ARMS.map((arm) => path.join(dir, 'arms', `${arm.name}.js`)),
      readme: path.join(dir, 'README.md'),
    };
  }
  if (opts.run) {
    result.run = runPromptfoo(dir, { runner: opts.runner, runnerFn: opts.runnerFn });
    result.imported_results = importRunOutput(root, dir, result.run);
    result.next = result.imported_results?.next || (result.run.status === 'pass'
      ? `/forgeflow-lean-benchmark-results --promptfoo ${path.join(dir, 'raw-results.json')} --out ${path.join(dir, 'normalized-results.json')}`
      : result.run.reason);
  }
  return result;
}

function renderMarkdown(result) {
  const lines = ['# Forgeflow Lean Benchmark Runner', '', `Status: ${result.status}`, '', result.boundary, '', '## Tasks', ''];
  for (const task of result.tasks) lines.push(`- ${task.id}: ${task.prompt} (${task.correctness})`);
  lines.push('', '## Commands', '');
  for (const command of result.commands) lines.push(`- ${command.name}: ${command.command}`);
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildLeanBenchmarkRunner(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  } catch (err) {
    console.error(`lean benchmark runner failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  ARMS,
  TASKS,
  armScript,
  buildLeanBenchmarkRunner,
  parseArgs,
  rawResultTemplate,
  reportTemplate,
  renderMarkdown,
  importRunOutput,
  runPromptfoo,
};
