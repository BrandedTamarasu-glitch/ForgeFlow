#!/usr/bin/env node
const path = require('path');
const { buildReviewWavePrep } = require('./render-review-wave-prep');
const { buildOutcomeCapturePlan } = require('./render-outcome-capture-plan');
const { buildProfileBootstrap } = require('./render-profile-bootstrap');
const { buildTelemetryQuality } = require('./render-telemetry-quality');
const { parityStatus } = require('./runtime-inventory');
const { buildWrapperDriftPlan } = require('./render-wrapper-drift-plan');

function usage() {
  console.error('Usage: render-workflow-readiness.js [--root <repo>] [--project-dir <dir>] [--metrics-root <dir>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', metricsRoot: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--metrics-root') {
      opts.metricsRoot = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function phaseStatus(attention) {
  return attention ? 'attention' : 'pass';
}

function phase(id, title, status, next, reason, validation, boundary, evidence = {}) {
  return {
    id,
    title,
    status,
    next,
    reason,
    validation,
    boundary,
    evidence,
  };
}

function contextPhase(reviewWave) {
  const attention = reviewWave.status === 'split-before-review' || reviewWave.status === 'context-incomplete';
  const followThrough = reviewWave.follow_through || {};
  const next = followThrough.next_command
    || (reviewWave.status === 'split-before-review'
      ? '/forgeflow-review-wave-prep --write-wave-files'
      : (reviewWave.status === 'context-incomplete' ? 'node scripts/forgeflow/build-context-pack.js --json' : '/forgeflow-review-wave-prep'));
  return phase(
    'context-budget-review-waves',
    'Context-budget review waves',
    phaseStatus(attention),
    next,
    reviewWave.next_reason,
    [
      'node scripts/forgeflow/test-render-context-wave-plan.js',
      'node scripts/forgeflow/test-render-review-wave-prep.js',
      'node scripts/forgeflow/test-check-context-budget.js',
    ],
    'Review-wave readiness is advisory. It never trims proof files or raw-required evidence automatically.',
    {
      review_wave_status: reviewWave.status,
      current_compact_tokens: reviewWave.current_compact_tokens,
      target_compact_tokens: reviewWave.target_compact_tokens,
      over_by_tokens: reviewWave.over_by_tokens,
      first_wave: reviewWave.first_wave ? reviewWave.first_wave.name : '',
      follow_through_status: followThrough.status || '',
      review_ready: followThrough.review_ready === true,
    }
  );
}

function outcomePhase(outcome) {
  const streams = Array.isArray(outcome.streams) ? outcome.streams : [];
  const missingCount = Number(outcome.missing_count || 0);
  const attention = missingCount > 0;
  return phase(
    'outcome-calibration',
    'Outcome calibration capture',
    phaseStatus(attention),
    attention ? '/forgeflow-workflow-ending-capture --event auto' : '/forgeflow-outcome-capture-plan',
    attention
      ? `${missingCount} outcome stream(s) need real observed evidence before calibration should be trusted.`
      : 'Outcome calibration streams have evidence; keep recording only after real workflow events.',
    [
      'node scripts/forgeflow/test-render-outcome-capture-plan.js',
      'node scripts/forgeflow/test-record-next-work-outcome.js',
      'node scripts/forgeflow/test-record-review-outcome.js',
      'node scripts/forgeflow/test-rollup-agent-feedback.js',
    ],
    'Outcome readiness never records or fabricates evidence. Recorder commands require observed workflow results.',
    {
      missing_count: missingCount,
      streams: streams.map((item) => ({ name: item.name, action: item.action, status: item.status })),
    }
  );
}

function profilePhase(profile) {
  const setup = profile.setup_plan || {};
  const attention = setup.status !== 'ready-for-check';
  return phase(
    'user-profile-explicitness',
    'User-profile explicitness',
    phaseStatus(attention),
    attention ? '/forgeflow-profile-bootstrap --prompts' : '/forgeflow-profile-review',
    attention
      ? 'Required operating preferences are not explicit enough for confident profile injection.'
      : 'Required operating preferences are present; review conflicts before relying on profile guidance.',
    [
      'node scripts/forgeflow/test-render-profile-bootstrap.js',
      'node scripts/forgeflow/test-profile-review.js',
      'node scripts/forgeflow/test-profile-compliance.js',
      'node scripts/forgeflow/test-user-profile.js',
    ],
    'Profile readiness uses only explicit user-provided preferences. It does not infer preferences from chat, code, or history.',
    {
      setup_status: setup.status || 'unknown',
      missing_required_flags: setup.missing_required_flags || [],
      missing_recommended_flags: setup.missing_recommended_flags || [],
      next_prompt: setup.next_prompt || null,
    }
  );
}

function telemetryPhase(telemetry) {
  const trustSummary = telemetry.trust_summary || {};
  const attention = telemetry.status !== 'ready' || trustSummary.status !== 'pass';
  return phase(
    'thin-telemetry',
    'Thin telemetry quality',
    phaseStatus(attention),
    attention ? '/forgeflow-learning-action' : '/forgeflow-telemetry-quality',
    attention
      ? telemetry.next_quality_action || 'Refresh telemetry quality before relying on calibration.'
      : 'Telemetry and outcome evidence are strong enough for advisory calibration.',
    [
      'node scripts/forgeflow/test-render-telemetry-quality.js',
      'node scripts/forgeflow/test-render-forgeflow-report.js',
      'node scripts/forgeflow/test-summarize-calibration.js',
      'node scripts/forgeflow/test-summarize-context-telemetry.js',
    ],
    'Telemetry readiness does not export records, rewire hooks, change routing, or approve work.',
    {
      telemetry_status: telemetry.status,
      evidence_score: telemetry.evidence_score,
      weakest_sources: telemetry.weakest_sources || [],
      missing: telemetry.missing || [],
    }
  );
}

function runtimePhase(runtime) {
  const attention = runtime.status !== 'pass';
  return phase(
    'runtime-inventory-pressure',
    'Runtime inventory pressure',
    phaseStatus(attention),
    attention ? '/forgeflow-runtime-drift --preview-repair' : '/forgeflow-version',
    attention
      ? 'Runtime inventory parity needs attention before more command/helper surfaces are added.'
      : 'Runtime command/helper parity is currently green; keep using the shared inventory tests for future changes.',
    [
      'node scripts/forgeflow/test-runtime-inventory.js',
      'node scripts/forgeflow/test-install-manifest.js',
      'node scripts/forgeflow/test-command-coverage.js',
      'node scripts/forgeflow/test-update-forgeflow.js',
      'node scripts/forgeflow/test-release-version.js',
    ],
    'Runtime readiness is read-only. It compares parity surfaces but does not repair, install, edit docs, commit, or push.',
    {
      runtime_status: runtime.status,
      checks: runtime.checks,
      command_count: runtime.command_count,
      runtime_helper_count: runtime.runtime_helper_count,
    }
  );
}

function pausedHighRisk(wrapper) {
  const highRisk = wrapper.groups && Array.isArray(wrapper.groups.high_risk) ? wrapper.groups.high_risk : [];
  return highRisk.map((item) => ({
    source: item.source,
    issue: item.issue,
    action: item.action,
    status: 'paused-high-risk',
    boundary: 'Do not automate this item without a separate design/review slice.',
  }));
}

function runbookStep(item, index) {
  return {
    order: index + 1,
    id: item.id,
    title: item.title,
    status: item.status,
    command: item.next,
    requires_user_input: item.id === 'user-profile-explicitness',
    writes_when_run: item.id === 'context-budget-review-waves' && item.next.includes('--write-wave-files'),
    observed_evidence_required: item.id === 'outcome-calibration' || item.id === 'thin-telemetry',
    stop_rule: item.boundary,
  };
}

function buildAutomationRunbook(phases, paused) {
  const steps = phases.map(runbookStep);
  const firstAction = steps.find((item) => item.status === 'attention') || null;
  return {
    status: firstAction ? 'actionable' : 'ready',
    next_step: firstAction,
    steps,
    paused_high_risk_count: paused.length,
    stop_rules: [
      'Pause before recording outcomes unless the workflow has real observed evidence.',
      'Pause before writing profile records unless the user explicitly confirms the preference text.',
      'Pause before changing commands/review.md safe argument handling; that slice needs separate design and review.',
    ],
    boundary: 'The runbook sequences existing commands. It does not execute them, write files, record evidence, infer preferences, or route reviewers.',
  };
}

function buildWorkflowReadiness(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const reviewWave = opts.reviewWave || buildReviewWavePrep({ root });
  const outcome = opts.outcome || buildOutcomeCapturePlan({ root, projectDir });
  const profile = opts.profile || buildProfileBootstrap({ root, projectDir, home: opts.home });
  const telemetry = opts.telemetry || buildTelemetryQuality({ root, projectDir, metricsRoot: opts.metricsRoot });
  const runtime = opts.runtime || parityStatus(root);
  const wrapper = opts.wrapper || buildWrapperDriftPlan({ root });
  const phases = [
    contextPhase(reviewWave),
    outcomePhase(outcome),
    profilePhase(profile),
    telemetryPhase(telemetry),
    runtimePhase(runtime),
  ];
  const attention = phases.filter((item) => item.status === 'attention');
  const paused = pausedHighRisk(wrapper);
  const firstAction = attention[0] || null;
  const automationRunbook = buildAutomationRunbook(phases, paused);
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    status: attention.length > 0 ? 'actionable' : 'ready',
    phase_count: phases.length,
    attention_count: attention.length,
    phases,
    paused_high_risk: paused,
    automation_runbook: automationRunbook,
    next: firstAction ? firstAction.next : '/forgeflow-workflow-readiness',
    next_reason: firstAction
      ? firstAction.reason
      : 'All safe workflow-readiness phases are currently passing; recheck before the next agent-heavy workflow.',
    boundary: 'Workflow readiness is read-only. It does not write wave files, record outcomes, infer preferences, change review routing, repair installs, edit files, commit, push, or call GitHub.',
  };
}

function inlineCode(value) {
  return `\`${String(value || '').replace(/`/g, '\\`')}\``;
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Workflow Readiness',
    '',
    `Status: ${result.status}`,
    `Attention phases: ${result.attention_count}/${result.phase_count}`,
    '',
    result.boundary,
    '',
    '## Phases',
    '',
  ];
  for (const item of result.phases) {
    lines.push(`- ${item.title}: ${item.status}`);
    lines.push(`  - Next: ${inlineCode(item.next)}`);
    lines.push(`  - Reason: ${item.reason}`);
    lines.push(`  - Boundary: ${item.boundary}`);
  }
  lines.push('', '## Paused High-Risk Items', '');
  if (result.paused_high_risk.length === 0) lines.push('- None.');
  for (const item of result.paused_high_risk) {
    lines.push(`- ${item.source}: ${item.issue}`);
    lines.push(`  - Action: ${item.action}`);
    lines.push(`  - Boundary: ${item.boundary}`);
  }
  if (result.automation_runbook) {
    lines.push('', '## Automation Runbook', '');
    lines.push(`- Status: ${result.automation_runbook.status}`);
    if (result.automation_runbook.next_step) {
      lines.push(`- Next step: ${result.automation_runbook.next_step.id} - ${inlineCode(result.automation_runbook.next_step.command)}`);
    }
    for (const step of result.automation_runbook.steps) {
      lines.push(`- ${step.order}. ${step.id}: ${step.status}`);
      lines.push(`  - Command: ${inlineCode(step.command)}`);
      if (step.requires_user_input) lines.push('  - Requires user input: yes');
      if (step.observed_evidence_required) lines.push('  - Observed evidence required: yes');
      if (step.writes_when_run) lines.push('  - Writes when run: yes');
      lines.push(`  - Stop rule: ${step.stop_rule}`);
    }
    if (result.automation_runbook.stop_rules.length > 0) {
      lines.push('', '## Automation Stop Rules', '');
      for (const rule of result.automation_runbook.stop_rules) lines.push(`- ${rule}`);
    }
  }
  lines.push('', '## Validation', '');
  const validation = [...new Set(result.phases.flatMap((item) => item.validation || []))];
  for (const command of validation) lines.push(`- ${inlineCode(command)}`);
  lines.push('', `Next: ${inlineCode(result.next)}`, `Why: ${result.next_reason}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildWorkflowReadiness(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(1);
  }
}

module.exports = {
  buildWorkflowReadiness,
  buildAutomationRunbook,
  contextPhase,
  outcomePhase,
  parseArgs,
  profilePhase,
  renderMarkdown,
  runtimePhase,
  telemetryPhase,
};
