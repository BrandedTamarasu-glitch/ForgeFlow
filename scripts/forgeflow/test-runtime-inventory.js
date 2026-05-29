#!/usr/bin/env node
const path = require('path');
const {
  commandNames,
  commandSources,
  groupRuntimeHelpers,
  healthInventory,
  helperGroupForSource,
  managedRuntimeHelpers,
  releaseCheckCommands,
} = require('./runtime-inventory');
const { RUNTIME_HELPERS } = require('./install-manifest');

const root = path.resolve(__dirname, '..', '..');
const sources = commandSources(root);
const names = commandNames(root);
const health = healthInventory(root);
const helpers = managedRuntimeHelpers();
const releaseCheck = releaseCheckCommands(root);
const releaseGate = releaseCheckCommands(root, path.join('docs', 'wiki', 'Release-Gate.md'));
const releaseProcess = releaseCheckCommands(root, path.join('docs', 'wiki', 'Release-Process.md'));

function sameList(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

const checks = [
  ['finds commands', sources.includes('commands/forgeflow-health.md') && names.includes('forgeflow-health')],
  ['includes nested commands', sources.includes('commands/agent-chat/on.md') && names.includes('agent-chat/on')],
  ['matches health command inventory', sameList(names, health.commands)],
  ['runtime helper list matches install manifest', sameList(helpers, RUNTIME_HELPERS.slice().sort())],
  ['groups runtime helpers', helperGroupForSource('scripts/forgeflow/install-manifest.js') === 'install-update-health' && helperGroupForSource('scripts/forgeflow/render-efficiency-gap-plan.js') === 'learning-evidence'],
  ['summarizes helper groups', groupRuntimeHelpers(['scripts/forgeflow/install-manifest.js', 'scripts/forgeflow/update-forgeflow.js']).find((item) => item.group === 'install-update-health').count === 2],
  ['health lists runtime helpers', health.runtime_helpers.includes('render-next-work-ranking.js')],
  ['release docs match release check', sameList(releaseCheck, releaseGate) && sameList(releaseCheck, releaseProcess)],
  ['release check includes inventory tests', releaseCheck.includes('node scripts/forgeflow/test-runtime-inventory.js')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('runtime inventory: ok');
