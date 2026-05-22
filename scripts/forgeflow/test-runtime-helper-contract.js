#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  RUNTIME_HELPERS,
  manifestEntry,
} = require('./install-manifest');
const {
  affectedCommandsForSources,
  commandReferences,
  healthRuntimeHelpers,
  releaseCheckCoverage,
  runtimeHelperContract,
} = require('./runtime-helper-contract');
const { expectedInstallSources } = require('./health-check');
const { requiredManagedSources } = require('./update-forgeflow');

const repoRoot = path.resolve(__dirname, '..', '..');
const home = '/tmp/claude-home';
const contract = runtimeHelperContract({ root: repoRoot, home });
const healthCommand = require('fs').readFileSync(path.join(repoRoot, 'commands/forgeflow-health.md'), 'utf8');
const healthFallback = healthRuntimeHelpers(repoRoot);
const healthSources = expectedInstallSources();
const requiredSources = requiredManagedSources();
const healthEntry = contract.runtime_helpers.find((item) => item.source === 'scripts/forgeflow/health-check.js');
const updaterEntry = contract.runtime_helpers.find((item) => item.source === 'scripts/forgeflow/update-forgeflow.js');
const contractEntry = contract.runtime_helpers.find((item) => item.source === 'scripts/forgeflow/runtime-helper-contract.js');
const affected = affectedCommandsForSources([
  'scripts/forgeflow/health-check.js',
  'scripts/forgeflow/show-project-trends.js',
], { root: repoRoot });
const syntheticRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-runtime-contract-'));
fs.mkdirSync(path.join(syntheticRoot, 'commands'), { recursive: true });
fs.writeFileSync(path.join(syntheticRoot, 'commands', 'demo.md'), [
  '# Demo',
  '',
  '```bash',
  'echo scripts/forgeflow/show-project-trends.js.bak',
  'node scripts/forgeflow/show-project-trends.js',
  '```',
  '',
].join('\n'));
fs.writeFileSync(path.join(syntheticRoot, 'commands', 'false-positive.md'), [
  '# False Positive',
  '',
  '```bash',
  'echo scripts/forgeflow/show-project-trends.js.bak',
  '```',
  '',
].join('\n'));

const checks = [
  ['contract includes every runtime helper', contract.summary.total === RUNTIME_HELPERS.length],
  ['all helpers manifest owned', contract.summary.manifest_owned === RUNTIME_HELPERS.length],
  ['all helpers executable', contract.summary.executable === RUNTIME_HELPERS.length],
  ['all helpers health visible', contract.runtime_helpers.every((entry) => healthSources.includes(entry.source) && entry.health_visible)],
  ['all helpers health fallback visible', contract.runtime_helpers.every((entry) => entry.health_fallback_visible)],
  ['all helpers repair required', contract.runtime_helpers.every((entry) => requiredSources.includes(entry.source))],
  ['destinations match install manifest', contract.runtime_helpers.every((entry) => entry.destination === manifestEntry(entry.source, home).destination)],
  ['health helper command referenced', healthEntry.command_references.includes('commands/forgeflow-health.md')],
  ['updater command referenced', updaterEntry.command_references.includes('commands/update-forgeflow.md')],
  ['contract helper managed', contractEntry.manifest_owned && contractEntry.destination.endsWith('/forgeflow/scripts/forgeflow/runtime-helper-contract.js')],
  ['health fallback list includes runtime helpers', RUNTIME_HELPERS.every((source) => healthCommand.includes(path.basename(source)))],
  ['health visibility parsed from fallback list', RUNTIME_HELPERS.every((source) => healthFallback.has(path.basename(source)))],
  ['affected commands report helper users', affected.some((item) => item.command === 'commands/forgeflow-health.md' && item.helpers.includes('scripts/forgeflow/health-check.js'))],
  ['affected commands ignore release-check test mentions', !affected.some((item) => item.command === 'commands/forgeflow-release-check.md' && item.helpers.includes('scripts/forgeflow/health-check.js'))],
  ['command refs direct helper lookup', commandReferences(repoRoot, 'scripts/forgeflow/show-project-trends.js').includes('commands/forgeflow-trends.md')],
  ['command refs require token boundary', commandReferences(syntheticRoot, 'scripts/forgeflow/show-project-trends.js').length === 1 && commandReferences(syntheticRoot, 'scripts/forgeflow/show-project-trends.js')[0] === 'commands/demo.md'],
  ['release check covers contract helper test', releaseCheckCoverage(repoRoot, 'scripts/forgeflow/runtime-helper-contract.js').covered],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

if (failed > 0) process.exit(1);

console.log('runtime helper contract: ok');
