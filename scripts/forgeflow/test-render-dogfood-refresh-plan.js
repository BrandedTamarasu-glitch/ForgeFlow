#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  parseArgs,
  renderDogfoodRefreshPlan,
  renderMarkdown,
} = require('./render-dogfood-refresh-plan');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-dogfood-refresh-'));
  return { root, projectDir: path.join(root, '.forgeflow', 'Demo') };
}

function seedComplete(projectDir) {
  writeJson(path.join(projectDir, 'context', 'architecture.json'), { schema_version: '1' });
  writeJson(path.join(projectDir, 'context', 'ownership-map.json'), { schema_version: '1' });
  writeJson(path.join(projectDir, 'context', 'invocation-hints.json'), { schema_version: '1' });
  writeJson(path.join(projectDir, 'context', 'latest', 'synthesis-input.json'), {
    context_blocks: [{ name: 'architecture-intelligence' }],
  });
  writeJson(path.join(projectDir, 'context', 'latest', 'packet-artifacts.json'), { packet_count: 4 });
  writeJson(path.join(projectDir, 'context', 'latest', 'context-telemetry.json'), { compact_tokens: 900 });
  writeJson(path.join(projectDir, 'context', 'latest', 'latest-insights-report.json'), { status: 'injected' });
  writeJson(path.join(projectDir, 'context', 'latest', 'code-topology.json'), { nodes: [] });
}

const missing = makeRoot();
fs.mkdirSync(path.join(missing.projectDir, 'context', 'latest'), { recursive: true });
const missingPlan = renderDogfoodRefreshPlan(missing);
const missingMarkdown = renderMarkdown(missingPlan);

const complete = makeRoot();
seedComplete(complete.projectDir);
const completePlan = renderDogfoodRefreshPlan(complete);

const invalid = makeRoot();
fs.mkdirSync(path.join(invalid.projectDir, 'context'), { recursive: true });
fs.writeFileSync(path.join(invalid.projectDir, 'context', 'architecture.json'), '{nope');
const invalidPlan = renderDogfoodRefreshPlan(invalid);

const opts = parseArgs(['--root', complete.root, '--project-dir', complete.projectDir, '--json']);

const checks = [
  ['missing evidence produces refresh-needed', missingPlan.status === 'refresh-needed'],
  ['missing evidence starts with code map', missingPlan.steps[0].command === '/forgeflow-code-map'],
  ['missing evidence includes write commands', missingPlan.steps.some((item) => item.command === '/forgeflow-architecture --write') && missingPlan.steps.some((item) => item.command === '/forgeflow-dogfood-report --write')],
  ['markdown renders read-only boundary', missingMarkdown.includes('does not run commands')],
  ['complete evidence is ready', completePlan.status === 'ready' && completePlan.next === '/forgeflow-dogfood-report --write'],
  ['invalid evidence asks repair first', invalidPlan.status === 'repair-evidence-first' && invalidPlan.invalid_artifacts.length === 1],
  ['parses args', opts.root === complete.root && opts.projectDir === complete.projectDir && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('dogfood refresh plan: ok');
