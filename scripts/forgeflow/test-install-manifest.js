#!/usr/bin/env node
const {
  RUNTIME_HELPERS,
  categoryFor,
  destinationFor,
  isManagedSource,
  manifestEntry,
  shouldPreserveDestination,
} = require('./install-manifest');

const home = '/tmp/claude-home';
const checks = [
  ['agent managed', isManagedSource('agents/smith-review.md')],
  ['custom agent preserve', shouldPreserveDestination('agents/custom-local.md')],
  ['command subdir destination', destinationFor('commands/agent-chat/on.md', home) === '/tmp/claude-home/commands/agent-chat/on.md'],
  ['template destination', destinationFor('templates/forgeflow-budget.json', home) === '/tmp/claude-home/templates/forgeflow-budget.json'],
  ['script category', categoryFor('scripts/forgeflow/health-check.js') === 'runtime-script'],
  ['script destination', destinationFor('scripts/forgeflow/health-check.js', home) === '/tmp/claude-home/forgeflow/scripts/forgeflow/health-check.js'],
  ['shell script executable', manifestEntry('scripts/forgeflow/ensure-forgeflow-state.sh', home).executable === true],
  ['runtime helpers include updater', RUNTIME_HELPERS.includes('scripts/forgeflow/update-forgeflow.js')],
  ['runtime helpers include version helper', RUNTIME_HELPERS.includes('scripts/forgeflow/forgeflow-version.js')],
  ['runtime helpers include template installer', RUNTIME_HELPERS.includes('scripts/forgeflow/install-template.js')],
  ['test helper not consumer managed', !isManagedSource('scripts/forgeflow/test-health-check.js')],
  ['non managed rejected', !isManagedSource('services/dashboard/server.js')],
  ['path escape rejected', !isManagedSource('../scripts/forgeflow/health-check.js')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log('install manifest: ok');
