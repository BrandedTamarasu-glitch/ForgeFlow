#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const {
  RUNTIME_HELPERS,
  categoryFor,
  destinationFor,
  isManagedSource,
  manifestEntry,
  shouldPreserveDestination,
} = require('./install-manifest');

const repoRoot = path.resolve(__dirname, '..', '..');
const home = '/tmp/claude-home';
const checks = [
  ['agent managed', isManagedSource('agents/smith-review.md')],
  ['custom agent preserve', shouldPreserveDestination('agents/custom-local.md')],
  ['command subdir destination', destinationFor('commands/agent-chat/on.md', home) === '/tmp/claude-home/commands/agent-chat/on.md'],
  ['template destination', destinationFor('templates/forgeflow-budget.json', home) === '/tmp/claude-home/templates/forgeflow-budget.json'],
  ['script category', categoryFor('scripts/forgeflow/health-check.js') === 'runtime-script'],
  ['script destination', destinationFor('scripts/forgeflow/health-check.js', home) === '/tmp/claude-home/forgeflow/scripts/forgeflow/health-check.js'],
  ['future script category', categoryFor('scripts/forgeflow/future-helper.js') === 'runtime-script'],
  ['future script destination', destinationFor('scripts/forgeflow/future-helper.js', home) === '/tmp/claude-home/forgeflow/scripts/forgeflow/future-helper.js'],
  ['shell script executable', manifestEntry('scripts/forgeflow/ensure-forgeflow-state.sh', home).executable === true],
  ['runtime helpers include code topology', RUNTIME_HELPERS.includes('scripts/forgeflow/build-code-topology.js')],
  ['runtime helpers include agent drift', RUNTIME_HELPERS.includes('scripts/forgeflow/check-agent-drift.js')],
  ['runtime helpers include updater', RUNTIME_HELPERS.includes('scripts/forgeflow/update-forgeflow.js')],
  ['runtime helpers include version helper', RUNTIME_HELPERS.includes('scripts/forgeflow/forgeflow-version.js')],
  ['runtime helpers include template installer', RUNTIME_HELPERS.includes('scripts/forgeflow/install-template.js')],
  ['runtime helpers include latest insights state', RUNTIME_HELPERS.includes('scripts/forgeflow/latest-insights-state.js')],
  ['runtime helpers include project intelligence', RUNTIME_HELPERS.includes('scripts/forgeflow/build-project-intelligence.js')],
  ['runtime helpers include guidance contract', RUNTIME_HELPERS.includes('scripts/forgeflow/guidance-contract.js')],
  ['runtime helpers include context contract checker', RUNTIME_HELPERS.includes('scripts/forgeflow/check-context-contract.js')],
  ['runtime helpers include failure digest triage', RUNTIME_HELPERS.includes('scripts/forgeflow/failure-digest-triage.js')],
  ['runtime helpers include agent feedback recorder', RUNTIME_HELPERS.includes('scripts/forgeflow/record-agent-feedback.js')],
  ['runtime helpers include agent feedback rollup', RUNTIME_HELPERS.includes('scripts/forgeflow/rollup-agent-feedback.js')],
  ['runtime helpers include adoption pack renderer', RUNTIME_HELPERS.includes('scripts/forgeflow/render-adoption-pack.js')],
  ['runtime helpers include context retention', RUNTIME_HELPERS.includes('scripts/forgeflow/render-context-retention.js')],
  ['context retention helper executable in source tree', (fs.statSync(path.join(repoRoot, 'scripts/forgeflow/render-context-retention.js')).mode & 0o111) !== 0],
  ['runtime helpers include first run guide', RUNTIME_HELPERS.includes('scripts/forgeflow/render-first-run-guide.js')],
  ['runtime helpers include first run result recorder', RUNTIME_HELPERS.includes('scripts/forgeflow/record-first-run-result.js')],
  ['runtime helpers include first run rollup', RUNTIME_HELPERS.includes('scripts/forgeflow/rollup-first-run-results.js')],
  ['runtime helpers include next work outcome recorder', RUNTIME_HELPERS.includes('scripts/forgeflow/record-next-work-outcome.js')],
  ['runtime helpers include learning status helper', RUNTIME_HELPERS.includes('scripts/forgeflow/show-learning-status.js')],
  ['runtime helpers include project health timeline', RUNTIME_HELPERS.includes('scripts/forgeflow/show-project-health-timeline.js')],
  ['runtime helpers include implementation notes recorder', RUNTIME_HELPERS.includes('scripts/forgeflow/record-implementation-notes.js')],
  ['runtime helpers include implementation notes checker', RUNTIME_HELPERS.includes('scripts/forgeflow/check-implementation-notes.js')],
  ['runtime helpers include project learnings checker', RUNTIME_HELPERS.includes('scripts/forgeflow/check-project-learnings.js')],
  ['runtime helpers include pilot evidence recorder', RUNTIME_HELPERS.includes('scripts/forgeflow/record-pilot-evidence.js')],
  ['runtime helpers include project learning recorder', RUNTIME_HELPERS.includes('scripts/forgeflow/record-project-learning.js')],
  ['runtime helpers include user profile helpers', RUNTIME_HELPERS.includes('scripts/forgeflow/user-profile.js') && RUNTIME_HELPERS.includes('scripts/forgeflow/record-user-profile.js') && RUNTIME_HELPERS.includes('scripts/forgeflow/check-user-profile.js') && RUNTIME_HELPERS.includes('scripts/forgeflow/show-user-profile.js')],
  ['runtime helpers include profile review and compliance', RUNTIME_HELPERS.includes('scripts/forgeflow/render-profile-review.js') && RUNTIME_HELPERS.includes('scripts/forgeflow/check-profile-compliance.js')],
  ['runtime helpers include next-action contract', RUNTIME_HELPERS.includes('scripts/forgeflow/next-action-contract.js')],
  ['runtime helpers include output contract', RUNTIME_HELPERS.includes('scripts/forgeflow/output-contract.js')],
  ['runtime helpers include review-auto classifier', RUNTIME_HELPERS.includes('scripts/forgeflow/classify-review-auto.js')],
  ['runtime helpers include review-auto evidence', RUNTIME_HELPERS.includes('scripts/forgeflow/render-review-auto-evidence.js')],
  ['runtime helpers include first useful win report', RUNTIME_HELPERS.includes('scripts/forgeflow/render-first-useful-win.js')],
  ['runtime helpers include first task report', RUNTIME_HELPERS.includes('scripts/forgeflow/render-first-task-report.js')],
  ['runtime helpers include update verify', RUNTIME_HELPERS.includes('scripts/forgeflow/render-update-verify.js')],
  ['runtime helpers include learning signal policy', RUNTIME_HELPERS.includes('scripts/forgeflow/learning-signal-policy.js')],
  ['runtime helpers include pattern review', RUNTIME_HELPERS.includes('scripts/forgeflow/render-pattern-review.js')],
  ['runtime helpers include runtime drift snapshot', RUNTIME_HELPERS.includes('scripts/forgeflow/runtime-drift-snapshot.js')],
  ['runtime helpers include pilot evidence rollup', RUNTIME_HELPERS.includes('scripts/forgeflow/rollup-pilot-evidence.js')],
  ['runtime helpers include pattern learnings rollup', RUNTIME_HELPERS.includes('scripts/forgeflow/rollup-pattern-learnings.js')],
  ['runtime helpers include project learnings rollup', RUNTIME_HELPERS.includes('scripts/forgeflow/rollup-project-learnings.js')],
  ['runtime helpers include runtime contract', RUNTIME_HELPERS.includes('scripts/forgeflow/runtime-helper-contract.js')],
  ['runtime helpers include project learnings display', RUNTIME_HELPERS.includes('scripts/forgeflow/show-project-learnings.js')],
  ['runtime helpers include forgeflow report', RUNTIME_HELPERS.includes('scripts/forgeflow/render-forgeflow-report.js')],
  ['runtime helpers include guided repair', RUNTIME_HELPERS.includes('scripts/forgeflow/render-guided-repair.js')],
  ['runtime helpers include insight injection', RUNTIME_HELPERS.includes('scripts/forgeflow/render-insight-injection.js')],
  ['runtime helpers include release readiness', RUNTIME_HELPERS.includes('scripts/forgeflow/render-release-readiness.js')],
  ['runtime helpers include release verify', RUNTIME_HELPERS.includes('scripts/forgeflow/render-release-verify.js')],
  ['runtime helpers include post-release install verify', RUNTIME_HELPERS.includes('scripts/forgeflow/render-post-release-install-verify.js')],
  ['runtime helpers include pilot script renderer', RUNTIME_HELPERS.includes('scripts/forgeflow/render-pilot-script.js')],
  ['runtime helpers include evaluation report', RUNTIME_HELPERS.includes('scripts/forgeflow/render-evaluation-report.js')],
  ['runtime helpers include smoke check', RUNTIME_HELPERS.includes('scripts/forgeflow/smoke-check.js')],
  ['runtime helpers include compact output', RUNTIME_HELPERS.includes('scripts/forgeflow/compact-command-output.js')],
  ['runtime helpers include failure digest', RUNTIME_HELPERS.includes('scripts/forgeflow/build-failure-digest.js')],
  ['runtime helpers include noisy command advisor', RUNTIME_HELPERS.includes('scripts/forgeflow/advise-noisy-command.js')],
  ['test helper not consumer managed', !isManagedSource('scripts/forgeflow/test-health-check.js')],
  ['future test helper not consumer managed', !isManagedSource('scripts/forgeflow/test-future-helper.js')],
  ['non managed rejected', !isManagedSource('services/dashboard/server.js')],
  ['path escape rejected', !isManagedSource('../scripts/forgeflow/health-check.js')],
  ['command traversal rejected', !isManagedSource('commands/../pwned.md')],
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
