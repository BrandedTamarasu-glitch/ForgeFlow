#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  commandNames,
  commandSources,
  expectedInstallSources,
  expectedRuntimeSources,
  expectedTemplateSources,
  groupRuntimeHelpers,
  healthInventory,
  helperGroupForSource,
  inventorySummary,
  coordinationPressure,
  managedRuntimeHelpers,
  parityStatus,
  runtimeHelperEntries,
  releaseCheckCommands,
} = require('./runtime-inventory');
const { RUNTIME_HELPERS } = require('./install-manifest');

const root = path.resolve(__dirname, '..', '..');
const sources = commandSources(root);
const names = commandNames(root);
const health = healthInventory(root);
const helpers = managedRuntimeHelpers();
const expectedRuntime = expectedRuntimeSources();
const expectedTemplates = expectedTemplateSources();
const expectedInstall = expectedInstallSources(root);
const helperEntries = runtimeHelperEntries();
const summary = inventorySummary(root);
const pressure = coordinationPressure(helperEntries);
const parity = parityStatus(root);
const releaseCheck = releaseCheckCommands(root);
const releaseGate = releaseCheckCommands(root, path.join('docs', 'wiki', 'Release-Gate.md'));
const releaseProcess = releaseCheckCommands(root, path.join('docs', 'wiki', 'Release-Process.md'));
const driftRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-runtime-inventory-drift-'));
fs.mkdirSync(path.join(driftRoot, 'commands'), { recursive: true });
fs.mkdirSync(path.join(driftRoot, 'docs', 'wiki'), { recursive: true });
fs.writeFileSync(path.join(driftRoot, 'commands', 'forgeflow-health.md'), [
  'EXPECTED_COMMANDS=(',
  '  forgeflow-health forgeflow-release-check',
  ')',
  'EXPECTED_RUNTIME_HELPERS=(',
  ')',
].join('\n'));
fs.writeFileSync(path.join(driftRoot, 'commands', 'forgeflow-release-check.md'), '# Release check\n');
fs.writeFileSync(path.join(driftRoot, 'docs', 'wiki', 'Release-Gate.md'), '# Release gate\n');
fs.writeFileSync(path.join(driftRoot, 'docs', 'wiki', 'Release-Process.md'), '# Release process\n');
const driftParity = parityStatus(driftRoot);

function sameList(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

const checks = [
  ['finds commands', sources.includes('commands/forgeflow-health.md') && names.includes('forgeflow-health')],
  ['includes nested commands', sources.includes('commands/agent-chat/on.md') && names.includes('agent-chat/on')],
  ['matches health command inventory', sameList(names, health.commands)],
  ['runtime helper list matches install manifest', sameList(helpers, RUNTIME_HELPERS.slice().sort())],
  ['runtime helper list includes new lean gap helpers', helpers.includes('scripts/forgeflow/render-lean-behavior-eval.js') && helpers.includes('scripts/forgeflow/render-lean-session.js') && helpers.includes('scripts/forgeflow/render-lean-portability-pack.js') && helpers.includes('scripts/forgeflow/render-lean-eval-pack.js') && helpers.includes('scripts/forgeflow/render-lean-adapter-contract.js') && helpers.includes('scripts/forgeflow/render-lean-adapter-drift.js') && helpers.includes('scripts/forgeflow/render-lean-adapter-smoke.js') && helpers.includes('scripts/forgeflow/render-lean-benchmark-runner.js') && helpers.includes('scripts/forgeflow/render-lean-correctness.js') && helpers.includes('scripts/forgeflow/render-lean-hook-contract.js') && helpers.includes('scripts/forgeflow/render-lean-host-adapters.js') && helpers.includes('scripts/forgeflow/render-lean-host-command-parity.js') && helpers.includes('scripts/forgeflow/render-lean-host-packages.js') && helpers.includes('scripts/forgeflow/render-lean-robustness-eval.js') && helpers.includes('scripts/forgeflow/render-lean-rule-canary.js') && helpers.includes('scripts/forgeflow/lean-config.js') && helpers.includes('scripts/forgeflow/lean-rule-builder.js')],
  ['expected runtime sources match managed helpers', sameList(expectedRuntime, helpers)],
  ['expected template sources are managed templates', expectedTemplates.includes('templates/forgeflow-budget.json') && expectedTemplates.every((source) => source.startsWith('templates/'))],
  ['expected install sources include dynamic and static surfaces', expectedInstall.includes('commands/forgeflow-health.md') && expectedInstall.includes('hooks/forgeflow-gate.js') && expectedInstall.includes('templates/forgeflow-budget.json') && expectedInstall.includes('scripts/forgeflow/runtime-inventory.js')],
  ['runtime helper entries expose groups', helperEntries.length === helpers.length && helperEntries.every((item) => item.source && item.helper_group && item.installed_name)],
  ['inventory summary exposes registry counts', summary.command_count === sources.length && summary.runtime_helper_count === helpers.length && summary.helper_groups.length > 0],
  ['inventory summary exposes canonical registry', summary.command_names.length === names.length && summary.managed_registry.runtime_helpers === helpers.length && summary.managed_registry.install_manifest_sources > helpers.length],
  ['inventory summary exposes coordination pressure', summary.coordination_pressure.status === 'attention' && summary.coordination_pressure.pressure_reasons.some((reason) => reason.startsWith('large-helper-group:')) && summary.coordination_pressure.hot_files.some((item) => item.path === 'scripts/forgeflow/install-manifest.js') && summary.coordination_pressure.canonical_checks.includes('node scripts/forgeflow/test-runtime-inventory.js')],
  ['coordination pressure is advisory', pressure.boundary.includes('does not install') && pressure.next_safe_slice.includes('runtime-inventory.js') && pressure.pressure_reasons.includes('health-release-docs-share-helper-inventory')],
  ['parity status compares health and release surfaces', parity.status === 'pass' && parity.command_count === names.length && parity.checks.health_commands_match === true && parity.checks.health_runtime_helpers_match === true && parity.checks.release_check_present === true && parity.checks.release_gate_matches === true && parity.checks.release_process_matches === true && parity.release_checks.includes('node scripts/forgeflow/test-runtime-inventory.js')],
  ['parity status carries coordination pressure', parity.coordination_pressure.shared_registry === 'scripts/forgeflow/runtime-inventory.js'],
  ['parity status catches helper and release drift', driftParity.status === 'attention' && driftParity.checks.health_runtime_helpers_match === false && driftParity.checks.release_check_present === false],
  ['groups runtime helpers', helperGroupForSource('scripts/forgeflow/install-manifest.js') === 'install-update-health' && helperGroupForSource('scripts/forgeflow/render-efficiency-gap-plan.js') === 'adoption-guidance' && helperGroupForSource('scripts/forgeflow/record-review-outcome.js') === 'learning-recorders' && helperGroupForSource('scripts/forgeflow/user-profile.js') === 'user-profile' && helperGroupForSource('scripts/forgeflow/command-wrapper-contract.js') === 'command-wrapper' && helperGroupForSource('scripts/forgeflow/render-command-wrapper-batch.js') === 'command-wrapper'],
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
