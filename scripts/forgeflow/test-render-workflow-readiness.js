#!/usr/bin/env node
const path = require('path');
const {
  buildWorkflowReadiness,
  parseArgs,
  renderMarkdown,
} = require('./render-workflow-readiness');

const root = path.resolve('.');
const actionable = buildWorkflowReadiness({
  root,
  projectDir: '.forgeflow/Demo',
  reviewWave: {
    status: 'split-before-review',
    next_reason: 'Context is over budget.',
    current_compact_tokens: 26000,
    target_compact_tokens: 16000,
    over_by_tokens: 10000,
    first_wave: { name: 'risk-core' },
    follow_through: {
      status: 'wave-files-needed',
      next_command: '/forgeflow-review-wave-prep --write-wave-files',
      review_ready: false,
    },
  },
  outcome: {
    missing_count: 3,
    streams: [
      { name: 'next-work-outcomes', action: 'capture-next', status: 'missing' },
      { name: 'review-outcomes', action: 'capture-next', status: 'missing' },
      { name: 'agent-feedback', action: 'capture-next', status: 'missing' },
    ],
  },
  profile: {
    setup_plan: {
      status: 'needs-required-operating-preferences',
      missing_required_flags: ['--communication'],
      missing_recommended_flags: ['--ui'],
      next_prompt: { flag: '--communication', prompt: 'How should Forgeflow update you while it works?' },
    },
  },
  telemetry: {
    status: 'thin',
    evidence_score: 40,
    weakest_sources: ['review-outcomes'],
    missing: ['review-outcomes'],
    next_quality_action: 'Refresh or record evidence for review-outcomes.',
    trust_summary: { status: 'attention' },
  },
  runtime: {
    status: 'pass',
    checks: { health_commands_match: true },
    command_count: 1,
    runtime_helper_count: 1,
  },
  wrapper: {
    groups: {
      high_risk: [{ source: 'commands/review.md', issue: 'missing-safe-args', action: 'Design safe args.' }],
    },
  },
});

const ready = buildWorkflowReadiness({
  root,
  projectDir: '.forgeflow/Demo',
  reviewWave: {
    status: 'current-packet-ok',
    next_reason: 'Context is within budget.',
    current_compact_tokens: 1000,
    target_compact_tokens: 16000,
    over_by_tokens: 0,
    first_wave: null,
  },
  outcome: { missing_count: 0, streams: [] },
  profile: { setup_plan: { status: 'ready-for-check', missing_required_flags: [], missing_recommended_flags: [] } },
  telemetry: {
    status: 'ready',
    evidence_score: 100,
    weakest_sources: [],
    missing: [],
    next_quality_action: 'No low-confidence telemetry sources need immediate refresh.',
    trust_summary: { status: 'pass' },
  },
  runtime: { status: 'pass', checks: {}, command_count: 1, runtime_helper_count: 1 },
  wrapper: { groups: { high_risk: [] } },
});

const readyToBuildWave = buildWorkflowReadiness({
  root,
  projectDir: '.forgeflow/Demo',
  reviewWave: {
    status: 'split-before-review',
    next_reason: 'Context is over budget.',
    current_compact_tokens: 26000,
    target_compact_tokens: 16000,
    over_by_tokens: 10000,
    first_wave: { name: 'risk-core', wave_file: 'waves/risk-core-files.txt' },
    follow_through: {
      status: 'ready-to-build-first-wave',
      next_command: 'node scripts/forgeflow/build-context-pack.js --files waves/risk-core-files.txt --json',
      review_ready: true,
    },
  },
  outcome: { missing_count: 0, streams: [] },
  profile: { setup_plan: { status: 'ready-for-check', missing_required_flags: [], missing_recommended_flags: [] } },
  telemetry: {
    status: 'ready',
    evidence_score: 100,
    weakest_sources: [],
    missing: [],
    next_quality_action: 'No low-confidence telemetry sources need immediate refresh.',
    trust_summary: { status: 'pass' },
  },
  runtime: { status: 'pass', checks: {}, command_count: 1, runtime_helper_count: 1 },
  wrapper: { groups: { high_risk: [] } },
});

const contextIncomplete = buildWorkflowReadiness({
  root,
  projectDir: '.forgeflow/Demo',
  reviewWave: {
    status: 'context-incomplete',
    next_reason: 'The latest context pack is incomplete.',
    current_compact_tokens: 0,
    target_compact_tokens: 16000,
    over_by_tokens: 0,
    first_wave: null,
    follow_through: {
      status: 'rebuild-context-pack',
      next_command: 'node scripts/forgeflow/build-context-pack.js --json',
      review_ready: false,
    },
  },
  outcome: { missing_count: 0, streams: [] },
  profile: { setup_plan: { status: 'ready-for-check', missing_required_flags: [], missing_recommended_flags: [] } },
  telemetry: {
    status: 'ready',
    evidence_score: 100,
    weakest_sources: [],
    missing: [],
    next_quality_action: 'No low-confidence telemetry sources need immediate refresh.',
    trust_summary: { status: 'pass' },
  },
  runtime: { status: 'pass', checks: {}, command_count: 1, runtime_helper_count: 1 },
  wrapper: { groups: { high_risk: [{ source: 'commands/review.md', issue: 'missing-safe-args', action: 'Design safe args.' }] } },
});

const partialShapes = buildWorkflowReadiness({
  root,
  projectDir: '.forgeflow/Demo',
  reviewWave: {
    status: 'current-packet-ok',
    next_reason: 'Context is within budget.',
    current_compact_tokens: 1000,
    target_compact_tokens: 16000,
    over_by_tokens: 0,
  },
  outcome: { missing_count: 1 },
  profile: { setup_plan: { status: 'ready-for-check' } },
  telemetry: { status: 'thin' },
  runtime: { status: 'pass' },
  wrapper: { groups: { high_risk: [] } },
});

const markdown = renderMarkdown(actionable);
const opts = parseArgs(['--root', '.', '--project-dir', '.forgeflow/Demo', '--metrics-root', '.metrics', '--json']);
let invalidBlocked = false;
try {
  parseArgs(['--write-wave-files']);
} catch (err) {
  invalidBlocked = /Unknown argument/.test(err.message);
}

const checks = [
  ['actionable status', actionable.status === 'actionable' && actionable.attention_count === 4],
  ['next action is first attention phase', actionable.next === '/forgeflow-review-wave-prep --write-wave-files'],
  ['adds automation runbook', actionable.automation_runbook.status === 'actionable' && actionable.automation_runbook.next_step.id === 'context-budget-review-waves' && actionable.automation_runbook.stop_rules.some((item) => item.includes('commands/review.md'))],
  ['includes paused high-risk review item', actionable.paused_high_risk[0].source === 'commands/review.md'],
  ['ready status', ready.status === 'ready' && ready.next === '/forgeflow-workflow-readiness'],
  ['ready-to-build wave carries follow-through command', readyToBuildWave.next.includes('build-context-pack.js --files waves/risk-core-files.txt') && readyToBuildWave.phases[0].evidence.follow_through_status === 'ready-to-build-first-wave' && readyToBuildWave.phases[0].evidence.review_ready === true],
  ['incomplete context avoids review command', contextIncomplete.next === 'node scripts/forgeflow/build-context-pack.js --json' && !contextIncomplete.phases[0].next.includes('/review')],
  ['partial helper shapes degrade safely', partialShapes.status === 'actionable' && partialShapes.phases[1].evidence.streams.length === 0 && partialShapes.phases[3].reason.includes('Refresh telemetry quality')],
  ['renders phase and validation output', markdown.includes('# Forgeflow Workflow Readiness') && markdown.includes('Paused High-Risk Items') && markdown.includes('Automation Runbook') && markdown.includes('Automation Stop Rules') && markdown.includes('Stop rule:') && markdown.includes('test-render-context-wave-plan.js')],
  ['boundary blocks mutation', actionable.boundary.includes('does not write wave files') && actionable.boundary.includes('record outcomes') && actionable.boundary.includes('change review routing')],
  ['parses args', opts.root === path.resolve('.') && opts.projectDir === path.resolve('.forgeflow/Demo') && opts.metricsRoot === path.resolve('.metrics') && opts.json === true],
  ['rejects unsupported write flag', invalidBlocked],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('workflow readiness: ok');
