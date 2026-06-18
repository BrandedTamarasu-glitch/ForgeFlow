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
} = require('./render-lean-benchmark-runner');

const root = path.resolve(__dirname, '..', '..');
const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-benchmark-runner-')), '.forgeflow', 'Demo');
const preview = buildLeanBenchmarkRunner({ root, projectDir });
const written = buildLeanBenchmarkRunner({ root, projectDir, write: true });
const markdown = renderMarkdown(preview);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--write', '--json']);

const checks = [
  ['preview ready', preview.status === 'ready' && preview.tasks.length === TASKS.length && preview.arms.length === ARMS.length],
  ['commands keep network opt-in', preview.commands.some((item) => item.requires_network === true) && preview.boundary.includes('FORGEFLOW_BENCHMARK_ALLOW_NETWORK=1')],
  ['write creates plan and script', fs.existsSync(written.artifacts.json) && fs.existsSync(written.artifacts.script) && fs.existsSync(written.artifacts.promptfoo) && fs.existsSync(written.artifacts.tasks)],
  ['write creates prompt arms', written.artifacts.arms.length === ARMS.length && written.artifacts.arms.every((file) => fs.existsSync(file))],
  ['write creates reproducible result templates', fs.existsSync(written.artifacts.raw_results_template) && fs.existsSync(written.artifacts.report_template)],
  ['raw template has runs', rawResultTemplate().runs.length === TASKS.length * ARMS.length],
  ['report template points to validator', reportTemplate().includes('render-lean-benchmark-results.js')],
  ['arm script carries guidance', armScript(ARMS[1]).includes('Forgeflow lean profile') && armScript(ARMS[0]).includes('Answer normally')],
  ['renders markdown', markdown.includes('# Forgeflow Lean Benchmark Runner') && markdown.includes('opt-in scaffold')],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.write && opts.json],
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
