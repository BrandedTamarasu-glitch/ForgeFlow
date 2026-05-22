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
  ['runtime helpers include code topology', RUNTIME_HELPERS.includes('scripts/forgeflow/build-code-topology.js')],
  ['runtime helpers include agent drift', RUNTIME_HELPERS.includes('scripts/forgeflow/check-agent-drift.js')],
  ['runtime helpers include updater', RUNTIME_HELPERS.includes('scripts/forgeflow/update-forgeflow.js')],
  ['runtime helpers include version helper', RUNTIME_HELPERS.includes('scripts/forgeflow/forgeflow-version.js')],
  ['runtime helpers include template installer', RUNTIME_HELPERS.includes('scripts/forgeflow/install-template.js')],
  ['runtime helpers include latest insights state', RUNTIME_HELPERS.includes('scripts/forgeflow/latest-insights-state.js')],
  ['runtime helpers include guidance contract', RUNTIME_HELPERS.includes('scripts/forgeflow/guidance-contract.js')],
  ['runtime helpers include failure digest triage', RUNTIME_HELPERS.includes('scripts/forgeflow/failure-digest-triage.js')],
  ['runtime helpers include implementation notes recorder', RUNTIME_HELPERS.includes('scripts/forgeflow/record-implementation-notes.js')],
  ['runtime helpers include implementation notes checker', RUNTIME_HELPERS.includes('scripts/forgeflow/check-implementation-notes.js')],
  ['runtime helpers include project learnings checker', RUNTIME_HELPERS.includes('scripts/forgeflow/check-project-learnings.js')],
  ['runtime helpers include pilot evidence recorder', RUNTIME_HELPERS.includes('scripts/forgeflow/record-pilot-evidence.js')],
  ['runtime helpers include project learning recorder', RUNTIME_HELPERS.includes('scripts/forgeflow/record-project-learning.js')],
  ['runtime helpers include pilot evidence rollup', RUNTIME_HELPERS.includes('scripts/forgeflow/rollup-pilot-evidence.js')],
  ['runtime helpers include pattern learnings rollup', RUNTIME_HELPERS.includes('scripts/forgeflow/rollup-pattern-learnings.js')],
  ['runtime helpers include project learnings rollup', RUNTIME_HELPERS.includes('scripts/forgeflow/rollup-project-learnings.js')],
  ['runtime helpers include project learnings display', RUNTIME_HELPERS.includes('scripts/forgeflow/show-project-learnings.js')],
  ['runtime helpers include forgeflow report', RUNTIME_HELPERS.includes('scripts/forgeflow/render-forgeflow-report.js')],
  ['runtime helpers include pilot script renderer', RUNTIME_HELPERS.includes('scripts/forgeflow/render-pilot-script.js')],
  ['runtime helpers include evaluation report', RUNTIME_HELPERS.includes('scripts/forgeflow/render-evaluation-report.js')],
  ['runtime helpers include smoke check', RUNTIME_HELPERS.includes('scripts/forgeflow/smoke-check.js')],
  ['runtime helpers include compact output', RUNTIME_HELPERS.includes('scripts/forgeflow/compact-command-output.js')],
  ['runtime helpers include failure digest', RUNTIME_HELPERS.includes('scripts/forgeflow/build-failure-digest.js')],
  ['runtime helpers include noisy command advisor', RUNTIME_HELPERS.includes('scripts/forgeflow/advise-noisy-command.js')],
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
