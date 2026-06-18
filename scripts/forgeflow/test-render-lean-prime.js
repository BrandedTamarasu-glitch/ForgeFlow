#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildLeanPrime,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-prime');

const root = path.resolve(__dirname, '..', '..');
const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-prime-'));
const projectDir = path.join(projectRoot, '.forgeflow', path.basename(projectRoot));
fs.mkdirSync(path.join(projectDir, 'context', 'latest'), { recursive: true });
fs.writeFileSync(path.join(projectDir, 'context', 'project-operating-model.json'), '{"schema_version":"1"}\n');
fs.writeFileSync(path.join(projectDir, 'context', 'latest', 'latest-insights-report.json'), '{"status":"ready"}\n');

const result = buildLeanPrime({ root, projectDir });
const taskResult = buildLeanPrime({ root, projectDir, task: 'tighten lean parity', writePlan: true });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--task', 'tighten lean parity', '--write-plan', '--json']);

const checks = [
  ['blocked without evidence', result.status === 'blocked' && result.steps.length === 5],
  ['next points to lean decision', result.next === '/forgeflow-lean-decision --task "<work item>"'],
  ['task makes next command copyable', taskResult.next === '/forgeflow-lean-decision --task "tighten lean parity"'],
  ['write plan creates artifacts', fs.existsSync(taskResult.artifacts.json) && fs.existsSync(taskResult.artifacts.markdown)],
  ['telemetry next is command shaped', result.steps.find((item) => item.id === 'telemetry').next.startsWith('/')],
  ['renders checklist', markdown.includes('# Forgeflow Lean Prime') && markdown.includes('Lean decision evidence')],
  ['boundary is read-only', result.boundary.includes('read-only') && result.boundary.includes('does not write')],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.task === 'tighten lean parity' && opts.writePlan && opts.json],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('lean prime: ok');
