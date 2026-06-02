#!/usr/bin/env node
const path = require('path');
const { buildLearningActionRouter, captureGuidanceForSource, commandForSource, parseArgs, renderMarkdown } = require('./render-learning-action-router');

const learning = {
  status: 'attention',
  signal_quality: {
    weakest_sources: ['project-learnings', 'user-profile'],
  },
};
const telemetry = {
  status: 'attention',
  weakest_sources: ['review-outcomes', 'first-run-results', 'project-learnings'],
};
const result = buildLearningActionRouter({
  root: process.cwd(),
  learning,
  telemetry,
});
const healthy = buildLearningActionRouter({
  root: process.cwd(),
  learning: { status: 'pass', signal_quality: { weakest_sources: [] } },
  telemetry: { status: 'pass', weakest_sources: [] },
});
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', '.', '--project-dir', '.forgeflow/Forgeflow', '--metrics-root', '.metrics', '--json']);

const checks = [
  ['builds actionable result', result.schema_version === '1' && result.status === 'actionable'],
  ['dedupes action queue', result.actions.filter((item) => item.source === 'project-learnings').length === 1],
  ['routes project learnings', result.recommended_action.command === '/forgeflow-learnings --project --check'],
  ['routes workflow captures', result.actions.some((item) => item.source === 'review-outcomes' && item.command.includes('--event review'))],
  ['routes first-run evidence check', result.actions.some((item) => item.source === 'first-run-results' && item.command === '/forgeflow-first-run-rollup')],
  ['adds first-run capture template separately', result.actions.some((item) => item.source === 'first-run-results' && item.capture_guidance.requires_observed_values === true && item.capture_guidance.template.includes('/forgeflow-first-run-result --runtime <claude-code|codex>'))],
  ['adds workflow capture guidance', result.actions.some((item) => item.source === 'review-outcomes' && item.capture_guidance.requires_observed_values === false && item.capture_guidance.template === '/forgeflow-workflow-ending-capture --event review')],
  ['healthy fallback stable', healthy.status === 'ready' && healthy.next === '/forgeflow-learning-status'],
  ['maps source commands', commandForSource('agent_feedback') === '/forgeflow-workflow-ending-capture --event agent-feedback' && commandForSource('metrics-events') === '/forgeflow-smoke'],
  ['maps capture guidance', captureGuidanceForSource('user-profile').template === '/forgeflow-profile-bootstrap --prompts'],
  ['renders markdown', markdown.includes('# Forgeflow Learning Action Router') && markdown.includes('## Recommended Action') && markdown.includes('project-learnings: /forgeflow-learnings --project --check') && markdown.includes('Template: /forgeflow-learnings --project --check')],
  ['parses args', opts.root === path.resolve('.') && opts.projectDir === path.resolve('.forgeflow/Forgeflow') && opts.metricsRoot === path.resolve('.metrics') && opts.json === true],
  ['read-only boundary', result.boundary.includes('read-only') && result.recommended_action.boundary.includes('do not approve work')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('learning action router: ok');
