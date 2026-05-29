#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { safeReadTextFile } = require('./file-safety');
const { buildLearningStatus } = require('./show-learning-status');
const { buildNextWorkRanking } = require('./render-next-work-ranking');
const { buildOutcomeCapturePlan } = require('./render-outcome-capture-plan');
const { buildValidationFailureCapture } = require('./render-validation-failure-capture');
const { collectMetrics, cutoffForPeriod, summarizePatternLog } = require('./render-forgeflow-report');
const { tokenize } = require('./command-args');

function usage() {
  console.error([
    'Usage: render-efficiency-gap-plan.js [--root <repo>] [--project-dir <dir>] [--metrics-root <dir>]',
    '       [--patterns-dir <dir>] [--failed-command <cmd>] [--json]',
  ].join('\n'));
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function requireRawValue(argv, name, index) {
  const value = argv[index + 1];
  if (value === undefined || value === '') throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = {
    root: process.cwd(),
    projectDir: '',
    metricsRoot: '',
    patternsDir: '',
    failedCommand: '',
    json: false,
  };
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
    } else if (arg === '--patterns-dir') {
      opts.patternsDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--failed-command') {
      opts.failedCommand = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--args') {
      const parsed = parseArgs(tokenize(requireRawValue(argv, arg, i)));
      opts.json = opts.json || parsed.json;
      opts.failedCommand = parsed.failedCommand || opts.failedCommand;
      if (parsed.projectDir) opts.projectDir = parsed.projectDir;
      if (parsed.metricsRoot) opts.metricsRoot = parsed.metricsRoot;
      if (parsed.patternsDir) opts.patternsDir = parsed.patternsDir;
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

function defaultMetricsRoot(home = os.homedir()) {
  return path.join(home, '.claude', 'projects');
}

function defaultPatternsDir(root, home = os.homedir()) {
  const local = path.join(root, 'forgeflow-patterns');
  return fs.existsSync(local) ? local : path.join(home, '.claude', 'forgeflow-patterns');
}

function readJson(file, root) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(safeReadTextFile(file, root).content);
  } catch (_err) {
    return null;
  }
}

function countObjectValues(object) {
  return Object.values(object || {}).reduce((sum, count) => sum + Number(count || 0), 0);
}

function findCandidate(ranking, source) {
  return (ranking.candidates || []).find((item) => item.source === source) || null;
}

function sectionByName(learning, name) {
  return (learning.sections || []).find((section) => section.name === name) || {};
}

function gap(score, id, title, status, why, safeSlices, highRiskBoundary, evidence = {}, validateWith = []) {
  return {
    id,
    title,
    score,
    priority: score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low',
    status,
    why,
    safe_slices: safeSlices,
    high_risk_boundary: highRiskBoundary,
    evidence,
    validate_with: validateWith,
  };
}

function evidenceLines(evidence = {}) {
  const lines = [];
  if (Number.isFinite(evidence.missing_streams)) lines.push(`missing streams ${evidence.missing_streams}`);
  if (Number.isFinite(evidence.records)) lines.push(`records ${evidence.records}`);
  if (Number.isFinite(evidence.issues)) lines.push(`issues ${evidence.issues}`);
  if (Number.isFinite(evidence.suggestions)) lines.push(`suggestions ${evidence.suggestions}`);
  if (Array.isArray(evidence.hot_files) && evidence.hot_files.length > 0) lines.push(`hot files ${evidence.hot_files.slice(0, 2).join('; ')}`);
  if (evidence.failure_digest) lines.push(`failure digest ${evidence.failure_digest}`);
  if (evidence.capture_preview) lines.push(`capture preview ${evidence.capture_preview.status}/${evidence.capture_preview.mode}`);
  if (Number.isFinite(evidence.events)) lines.push(`telemetry events ${evidence.events}`);
  if (Number.isFinite(evidence.verdict_reviewers)) lines.push(`verdict reviewers ${evidence.verdict_reviewers}`);
  if (Number.isFinite(evidence.pattern_candidates)) lines.push(`pattern candidates ${evidence.pattern_candidates}`);
  if (evidence.context_budget) lines.push(`context budget ${evidence.context_budget}`);
  if (evidence.readiness_state) lines.push(`readiness ${evidence.readiness_state}`);
  return lines.length > 0 ? lines : ['current local evidence'];
}

function buildEfficiencyGapPlan(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const metricsRoot = path.resolve(opts.metricsRoot || defaultMetricsRoot());
  const patternsDir = path.resolve(opts.patternsDir || defaultPatternsDir(root));
  const intelligence = readJson(path.join(projectDir, 'context', 'project-intelligence-rollup.json'), projectDir) || {};
  const ranking = buildNextWorkRanking({ root, projectDir });
  const learning = buildLearningStatus({ root, projectDir });
  const outcomePlan = buildOutcomeCapturePlan({ root, projectDir });
  const metrics = collectMetrics(metricsRoot, cutoffForPeriod('month'));
  const patterns = summarizePatternLog(patternsDir, cutoffForPeriod('month'));
  const failureCapture = opts.failedCommand
    ? buildValidationFailureCapture({ root, projectDir, command: opts.failedCommand })
    : null;

  const profile = sectionByName(learning, 'user-profile');
  const telemetryVerdicts = Object.keys(metrics.verdicts || {}).length;
  const telemetryEvents = Number(metrics.events || 0);
  const outcomeCandidate = findCandidate(ranking, 'outcome-calibration');
  const profileCandidate = findCandidate(ranking, 'user-profile');
  const registryCandidate = findCandidate(ranking, 'hot-files');
  const failureCandidate = findCandidate(ranking, 'failure-digest');
  const hotFiles = intelligence.hot_files || [];

  const readinessEvidence = intelligence.readiness && intelligence.readiness.evidence || {};
  const contextCandidate = readinessEvidence.context_budget === 'pass' ? null : findCandidate(ranking, 'context-telemetry');
  const readinessState = intelligence.readiness && intelligence.readiness.state;
  const importGapStatus = readinessEvidence.import_gaps;
  const allCandidates = [
    gap(
      outcomeCandidate ? outcomeCandidate.score : 80,
      'outcome-calibration',
      'Outcome calibration evidence is sparse',
      outcomePlan.status,
      outcomePlan.missing_count > 0
        ? `${outcomePlan.missing_count} outcome stream(s) still need real recorder evidence.`
        : 'Outcome streams exist; keep recording new real review and recommendation outcomes.',
      [
        'Run /forgeflow-outcome-capture-plan after a real review or next-work decision.',
        'Record only observed results with record-next-work-outcome, record-review-outcome, or record-agent-feedback.',
        'Rerun /forgeflow-next-work-ranking and /forgeflow-learning-status to confirm the ranking demotes history-only candidates.',
      ],
      'Do not fabricate review outcomes, usefulness labels, or agent feedback to satisfy calibration.',
      { missing_streams: outcomePlan.missing_count, streams: outcomePlan.streams },
      [
        'node scripts/forgeflow/test-render-outcome-capture-plan.js',
        'node scripts/forgeflow/test-record-next-work-outcome.js',
        'node scripts/forgeflow/test-record-review-outcome.js',
        'node scripts/forgeflow/test-rollup-agent-feedback.js',
      ]
    ),
    gap(
      profileCandidate ? profileCandidate.score : 70,
      'user-profile',
      'User operating and project experience profile is not explicit enough',
      profile.status || 'missing',
      profile.status === 'pass'
        ? 'Profile guidance is usable; review it before large agent-heavy work.'
        : 'Agents are using default communication, autonomy, risk, validation, and project-style guidance.',
      [
        'Run /forgeflow-profile-bootstrap --prompts to collect explicit answers.',
        'Preview proposed records with explicit flags before writing.',
        'Run /forgeflow-profile-review and /forgeflow-profile --check before injecting guidance into agent packets.',
      ],
      'Do not infer preferences from chat history, behavior, or project code. Profile records require explicit user confirmation.',
      { records: profile.records || 0, issues: profile.issues || 0, suggestions: (intelligence.user_profile || {}).suggestion_count || 0 },
      [
        'node scripts/forgeflow/test-render-profile-bootstrap.js',
        'node scripts/forgeflow/test-profile-review.js',
        'node scripts/forgeflow/test-profile-compliance.js',
      ]
    ),
    gap(
      registryCandidate ? registryCandidate.score : 65,
      'runtime-inventory',
      'Runtime helper and command inventory still has hot-file pressure',
      registryCandidate ? 'attention' : 'watch',
      registryCandidate ? registryCandidate.why : 'Inventory files remain central even when no active drift is detected.',
      [
        'Prefer runtime-inventory.js for command, helper, health, and release parity checks.',
        'When adding a helper, update install-manifest, command coverage, health inventory, release checks, docs, and installed-runtime tests together.',
        'Run test-runtime-inventory, test-install-manifest, test-command-coverage, test-update-forgeflow, and test-release-version.',
      ],
      'Avoid a broad install/update rewrite unless a focused parity test proves current duplication is causing drift.',
      { hot_files: hotFiles.filter((item) => /install-manifest|health-check|release|update-forgeflow|smoke-check/.test(item)) },
      [
        'node scripts/forgeflow/test-runtime-inventory.js',
        'node scripts/forgeflow/test-runtime-drift-snapshot.js',
        'node scripts/forgeflow/test-forgeflow-version.js',
        'node scripts/forgeflow/test-update-forgeflow.js',
      ]
    ),
    gap(
      failureCandidate ? failureCandidate.score : 50,
      'failure-digest',
      'Failure digest workflow needs real failed-validation use',
      (intelligence.freshness || {}).failure_digest || 'not-applicable',
      failureCandidate ? failureCandidate.why : 'No current failure requires a digest, but the retry loop should be ready before the next failure.',
      [
        'When validation fails, run /forgeflow-validation-failure-capture --command "<failed command>" first.',
        'Capture compact output only for safe modes; keep diffs, file lists, patches, and hashes raw.',
        'Rerun the failed command after the fix and refresh trends if latest failure context becomes stale.',
      ],
      'Do not execute failed commands or write a digest from the planning helper; capture only real command output from a real failure.',
      { failure_digest: intelligence.freshness && intelligence.freshness.failure_digest, capture_preview: failureCapture },
      [
        'node scripts/forgeflow/test-render-validation-plan.js',
        'node scripts/forgeflow/test-render-validation-failure-capture.js',
        'node scripts/forgeflow/test-failure-digest.js',
      ]
    ),
    gap(
      telemetryVerdicts === 0 ? 65 : 45,
      'forgeflow-telemetry',
      'Forgeflow telemetry is too thin to judge workflow quality',
      telemetryVerdicts === 0 ? 'attention' : 'watch',
      telemetryVerdicts === 0
        ? 'No verdict telemetry exists for the current month, so reports cannot measure review precision or approval trends.'
        : 'Telemetry exists, but outcome and pattern evidence should keep accumulating.',
      [
        'Run /forgeflow-report --refresh after meaningful review cycles.',
        'Use review outcome and agent feedback recorders when Arbiter resolves findings.',
        'Watch false-positive, auto-fix, pattern-candidate, and invocation deltas before changing agent prompts.',
      ],
      'Do not backfill telemetry, mutate hook wiring, export telemetry, or change prompt/routing behavior from sparse telemetry without explicit user consent and enough real history.',
      {
        metrics_files: metrics.files,
        events: telemetryEvents,
        verdict_reviewers: telemetryVerdicts,
        commands: countObjectValues(metrics.commands),
        pattern_status: patterns.status,
        pattern_candidates: patterns.totals.candidates,
      },
      [
        'node scripts/forgeflow/test-render-forgeflow-report.js',
        'node scripts/forgeflow/test-summarize-calibration.js',
        'node scripts/forgeflow/test-summarize-context-telemetry.js',
      ]
    ),
    contextCandidate ? gap(
      contextCandidate.score,
      'context-budget',
      'Context budget needs review-wave automation',
      'attention',
      contextCandidate.why,
      [
        'Run /forgeflow-context-wave-plan before broad review.',
        'Use /forgeflow-review-wave-prep to select the first bounded review packet.',
        'Rerun check-context-budget after narrowing scope.',
      ],
      'Do not trim proof files, raw-required failure output, or exact evidence just to satisfy a budget.',
      { context_budget: 'attention' },
      [
        'node scripts/forgeflow/test-render-context-wave-plan.js',
        'node scripts/forgeflow/test-render-review-wave-prep.js',
        'node scripts/forgeflow/test-check-context-budget.js',
      ]
    ) : null,
    readinessState && readinessState !== 'ready' ? gap(
      72,
      'project-readiness',
      'Project intelligence readiness needs clearing',
      readinessState,
      'Project intelligence is not ready, so downstream recommendations may be stale or incomplete.',
      [
        'Run /forgeflow-trends --refresh.',
        'Run /forgeflow-learnings --project --check if learning gates block injection.',
        'Rerun /forgeflow-efficiency-gaps after readiness clears.',
      ],
      'Do not proceed from stale guidance when the clearing command reports blockers.',
      { readiness_state: readinessState },
      [
        'node scripts/forgeflow/test-build-project-intelligence.js',
        'node scripts/forgeflow/test-show-project-trends.js',
      ]
    ) : null,
    importGapStatus === 'attention' ? gap(
      68,
      'import-gap-triage',
      'Import-gap triage needs review before topology is trusted',
      'attention',
      'Project intelligence reports import gaps that may affect static topology guidance.',
      [
        'Run /forgeflow-code-map and inspect needs-review import gaps.',
        'Accept only known expected gaps locally.',
        'Rerun /forgeflow-trends --refresh after triage.',
      ],
      'Do not treat static import gaps as runtime failures without current-code evidence.',
      { import_gaps: importGapStatus },
      [
        'node scripts/forgeflow/test-show-code-map.js',
        'node scripts/forgeflow/test-show-project-trends.js',
      ]
    ) : null,
  ].filter(Boolean)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const gaps = allCandidates.slice(0, 5);

  return {
    schema_version: '1',
    status: gaps.length > 0 ? 'planned' : 'clear',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    metrics_root: metricsRoot,
    patterns_dir: patternsDir,
    readiness: intelligence.readiness || null,
    gap_count: gaps.length,
    candidate_count: allCandidates.length,
    gaps,
    next: gaps[0] ? gaps[0].title : 'No efficiency gaps identified.',
    validation: [
      'node scripts/forgeflow/test-render-efficiency-gap-plan.js',
      'node scripts/forgeflow/test-render-next-work-ranking.js',
      'node scripts/forgeflow/test-render-outcome-capture-plan.js',
      'node scripts/forgeflow/test-render-profile-bootstrap.js',
      'node scripts/forgeflow/test-render-validation-failure-capture.js',
      'node scripts/forgeflow/test-runtime-inventory.js',
      'node scripts/forgeflow/test-render-forgeflow-report.js',
    ],
    boundary: 'Efficiency gap planning is read-only advisory guidance. It does not record outcomes, infer preferences, execute failed commands, edit files, commit, push, or spawn agents.',
    automation_boundary: 'This helper automates local gap discovery, evidence grouping, next-command surfacing, and validation planning. Mutating work remains explicit through existing recorder, profile, update, repair, and capture commands.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Efficiency Gap Plan',
    '',
    `Status: ${result.status}`,
    `Generated: ${result.generated_at}`,
    `Gaps: ${result.gap_count}`,
    `Candidates considered: ${result.candidate_count}`,
    '',
    result.boundary,
    result.automation_boundary,
    '',
    '## Phases',
    '',
  ];
  result.gaps.forEach((item, index) => {
    lines.push(`### Phase ${index + 1}: ${item.title}`);
    lines.push('');
    lines.push(`- Priority: ${item.priority} (${item.score})`);
    lines.push(`- Status: ${item.status}`);
    lines.push(`- Why: ${item.why}`);
    lines.push(`- Evidence: ${evidenceLines(item.evidence).join('; ')}`);
    lines.push(`- Boundary: ${item.high_risk_boundary}`);
    lines.push('- Safe slices:');
    for (const slice of item.safe_slices) lines.push(`  - ${slice}`);
    lines.push('- Validate:');
    for (const command of item.validate_with) lines.push(`  - ${command}`);
    lines.push('');
  });
  lines.push('## Validation', '');
  for (const command of result.validation) lines.push(`- ${command}`);
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildEfficiencyGapPlan(opts);
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

module.exports = { buildEfficiencyGapPlan, parseArgs, renderMarkdown };
