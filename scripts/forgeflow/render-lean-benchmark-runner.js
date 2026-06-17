#!/usr/bin/env node
const path = require('path');
const { writeFileSafe, writeJsonSafe } = require('./file-safety');

const TASKS = [
  { id: 'email-validator', prompt: 'Write a function that validates email addresses.', correctness: 'executable' },
  { id: 'debounce', prompt: 'Write a reusable debounce function in vanilla JavaScript.', correctness: 'executable' },
  { id: 'csv-sum', prompt: "Write code that reads sales.csv and sums the 'amount' column.", correctness: 'executable' },
  { id: 'countdown', prompt: 'Build a countdown timer component that counts down from a given number of seconds.', correctness: 'structural' },
  { id: 'rate-limit', prompt: "Add rate limiting to an endpoint so users can't spam it.", correctness: 'structural' },
];

const ARMS = [
  { name: 'baseline', system: '' },
  { name: 'lean-balanced', system: 'FORGEFLOW_LEAN_PROFILE=balanced' },
  { name: 'lean-strict', system: 'FORGEFLOW_LEAN_PROFILE=strict' },
];

function usage() {
  console.error('Usage: render-lean-benchmark-runner.js [--root <repo>] [--project-dir <dir>] [--write] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', write: false, json: false };
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
    writeFileSafe(path.join(dir, 'promptfooconfig.yaml'), promptfooConfig());
    for (const arm of ARMS) writeFileSafe(path.join(dir, 'arms', `${arm.name}.js`), armScript(arm));
    writeFileSafe(path.join(dir, 'README.md'), renderMarkdown(result));
    result.artifacts = {
      json: path.join(dir, 'plan.json'),
      script: path.join(dir, 'run.sh'),
      tasks: path.join(dir, 'tasks.json'),
      promptfoo: path.join(dir, 'promptfooconfig.yaml'),
      arms: ARMS.map((arm) => path.join(dir, 'arms', `${arm.name}.js`)),
      readme: path.join(dir, 'README.md'),
    };
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
  renderMarkdown,
};
