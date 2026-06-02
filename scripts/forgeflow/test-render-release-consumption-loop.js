#!/usr/bin/env node
const path = require('path');
const {
  buildReleaseConsumptionLoop,
  parseArgs,
  renderMarkdown,
  updateStatusToStep,
  completionFor,
} = require('./render-release-consumption-loop');

function consumption(overrides = {}) {
  return {
    status: 'pass',
    downstream_smoke: { status: 'pass' },
    ...overrides,
  };
}

const ready = buildReleaseConsumptionLoop({
  root: '.',
  updateVerify: { status: 'ready' },
  consumption: consumption(),
});
const needsSmoke = buildReleaseConsumptionLoop({
  root: '.',
  updateVerify: { status: 'ready' },
  consumption: consumption({ downstream_smoke: { status: 'not-run' } }),
});
const needsRepair = buildReleaseConsumptionLoop({
  root: '.',
  updateVerify: { status: 'repair' },
  consumption: consumption(),
});
const restart = updateStatusToStep({ status: 'restart' });
const markdown = renderMarkdown(needsSmoke);
const opts = parseArgs(['--root', '.', '--project-dir', '.forgeflow/Demo', '--with-smoke', '--json']);

const checks = [
  ['ready loop complete', ready.status === 'complete' && ready.next_reason.includes('complete')],
  ['ready loop exposes completion badge', ready.completion_badge === 'release-consumption-complete' && ready.completion.summary.includes('all passed')],
  ['attention loop exposes attention badge', needsSmoke.completion_badge === 'release-consumption-attention'],
  ['completion helper reports first blocker', completionFor([{ name: 'a', status: 'pass' }, { name: 'b', status: 'pending' }]).summary.includes('b')],
  ['not-run smoke is pending', needsSmoke.status === 'attention' && needsSmoke.next_command === '/forgeflow-release-consumption --with-smoke'],
  ['repair update is first action', needsRepair.status === 'attention' && needsRepair.next_command === '/update-forgeflow --repair'],
  ['restart maps to attention', restart.status === 'attention' && restart.command.includes('restart Claude Code')],
  ['renders markdown', markdown.includes('# Forgeflow Release Consumption Loop') && markdown.includes('## Completion') && markdown.includes('downstream-smoke')],
  ['parses args', opts.root === path.resolve('.') && opts.projectDir === path.resolve('.forgeflow/Demo') && opts.withSmoke === true && opts.json === true],
  ['boundary read-only', ready.boundary.includes('read-only') && ready.boundary.includes('does not update')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('release consumption loop: ok');
