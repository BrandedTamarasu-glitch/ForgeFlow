#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ARMS,
  TASKS,
  armScript,
  buildLeanBenchmarkRunner,
  parseArgs,
  rawResultTemplate,
  reportTemplate,
  renderMarkdown,
  runPromptfoo,
} = require('./render-lean-benchmark-runner');

const root = path.resolve(__dirname, '..', '..');
const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-benchmark-runner-')), '.forgeflow', 'Demo');
const preview = buildLeanBenchmarkRunner({ root, projectDir });
const written = buildLeanBenchmarkRunner({ root, projectDir, write: true });
const blockedRun = runPromptfoo(path.join(projectDir, 'context', 'lean-benchmark-runner'));
const fakeRunner = path.join(path.dirname(projectDir), 'promptfoo-fake');
const previousAllow = process.env.FORGEFLOW_BENCHMARK_ALLOW_NETWORK;
process.env.FORGEFLOW_BENCHMARK_ALLOW_NETWORK = '1';
const runResult = buildLeanBenchmarkRunner({
  root,
  projectDir,
  run: true,
  runner: fakeRunner,
  runnerFn: (_runner, args) => {
    const outIndex = args.indexOf('-o') + 1;
    fs.writeFileSync(args[outIndex], JSON.stringify({
      provider: 'fake-provider',
      model: 'fake-model',
      results: [
        {
          vars: { task_id: 'forgeflow-command-wrapper', task: 'Update wrapper' },
          prompt: { label: 'lean-balanced' },
          output: 'changed wrapper',
          gradingResult: { pass: true },
          latencyMs: 1000,
          cost: 0.001,
        },
      ],
    }, null, 2));
    return { status: 0, stdout: 'fake promptfoo ok', stderr: '' };
  },
});
if (previousAllow === undefined) delete process.env.FORGEFLOW_BENCHMARK_ALLOW_NETWORK;
else process.env.FORGEFLOW_BENCHMARK_ALLOW_NETWORK = previousAllow;
const markdown = renderMarkdown(preview);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--write', '--run', '--runner', fakeRunner, '--json']);

const checks = [
  ['preview ready', preview.status === 'ready' && preview.tasks.length === TASKS.length && preview.tasks.some((task) => task.id === 'forgeflow-command-wrapper') && preview.arms.length === ARMS.length],
  ['commands keep network opt-in', preview.commands.some((item) => item.requires_network === true) && preview.boundary.includes('FORGEFLOW_BENCHMARK_ALLOW_NETWORK=1')],
  ['write creates plan and script', fs.existsSync(written.artifacts.json) && fs.existsSync(written.artifacts.script) && fs.existsSync(written.artifacts.promptfoo) && fs.existsSync(written.artifacts.tasks)],
  ['write creates prompt arms', written.artifacts.arms.length === ARMS.length && written.artifacts.arms.every((file) => fs.existsSync(file))],
  ['write creates reproducible result templates', fs.existsSync(written.artifacts.raw_results_template) && fs.existsSync(written.artifacts.report_template)],
  ['raw template has runs', rawResultTemplate().runs.length === TASKS.length * ARMS.length],
  ['report template points to validator', reportTemplate().includes('render-lean-benchmark-results.js')],
  ['run blocked without explicit env', blockedRun.status === 'blocked' && blockedRun.reason.includes('FORGEFLOW_BENCHMARK_ALLOW_NETWORK')],
  ['run executes explicit runner when env allows it', runResult.run.status === 'pass' && runResult.next.includes('/forgeflow-lean-benchmark-results')],
  ['run imports raw promptfoo output when present', runResult.imported_results && fs.existsSync(runResult.imported_results.output) && runResult.imported_results.runs === 1],
  ['arm script carries guidance', armScript(ARMS[1]).includes('Forgeflow lean profile') && armScript(ARMS[0]).includes('Answer normally')],
  ['renders markdown', markdown.includes('# Forgeflow Lean Benchmark Runner') && markdown.includes('opt-in scaffold')],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.write && opts.run && opts.runner === fakeRunner && opts.json],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('lean benchmark runner: ok');
