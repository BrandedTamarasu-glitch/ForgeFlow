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
const primeTaskDir = path.join(projectRoot, '.forgeflow', 'prime-task');
fs.mkdirSync(path.join(primeTaskDir, 'context', 'latest'), { recursive: true });
fs.writeFileSync(path.join(primeTaskDir, 'context', 'project-operating-model.json'), '{"schema_version":"1"}\n');
fs.writeFileSync(path.join(primeTaskDir, 'context', 'latest', 'latest-insights-report.json'), '{"status":"ready"}\n');
const primedTask = buildLeanPrime({ root, projectDir: primeTaskDir, primeTask: 'tighten lean parity' });
const primedReportDir = path.join(projectRoot, '.forgeflow', 'prime-report');
fs.mkdirSync(path.join(primedReportDir, 'context', 'latest'), { recursive: true });
fs.writeFileSync(path.join(primedReportDir, 'context', 'project-operating-model.json'), '{"schema_version":"1"}\n');
fs.writeFileSync(path.join(primedReportDir, 'context', 'latest', 'latest-insights-report.json'), '{"status":"ready"}\n');
const primedReport = buildLeanPrime({ root, projectDir: primedReportDir, primeTask: 'tighten lean parity', writeReport: true });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--task', 'tighten lean parity', '--prime-task', 'prime lean parity', '--write-plan', '--write-report', '--json']);

const checks = [
  ['blocked without evidence', result.status === 'blocked' && result.steps.length === 5],
  ['next points to lean decision', result.next === '/forgeflow-lean-decision --task "<work item>"'],
  ['task makes next command copyable', taskResult.next === '/forgeflow-lean-decision --task "tighten lean parity"'],
  ['write plan creates artifacts', fs.existsSync(taskResult.artifacts.json) && fs.existsSync(taskResult.artifacts.markdown)],
  ['prime task writes decision and plan artifacts', fs.existsSync(primedTask.artifacts.lean_decision_json) && fs.existsSync(primedTask.artifacts.lean_decision_markdown) && fs.existsSync(primedTask.artifacts.json) && primedTask.steps.find((item) => item.id === 'decision').status === 'ready'],
  ['prime task can write report artifacts', fs.existsSync(primedReport.artifacts.lean_report.json) && fs.existsSync(primedReport.artifacts.lean_report.markdown) && primedReport.steps.find((item) => item.id === 'report').status !== 'missing' && !primedReport.plan_commands.includes('/forgeflow-lean-report --write')],
  ['telemetry next is command shaped', result.steps.find((item) => item.id === 'telemetry').next.startsWith('/')],
  ['renders checklist', markdown.includes('# Forgeflow Lean Prime') && markdown.includes('Lean decision evidence')],
  ['boundary is read-only', result.boundary.includes('read-only') && result.boundary.includes('does not write')],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.task === 'tighten lean parity' && opts.primeTask === 'prime lean parity' && opts.writePlan && opts.writeReport && opts.json],
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
