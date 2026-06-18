'use strict';
const fs = require('fs');
const path = require('path');
const { renderDogfoodRefreshPlan } = require('../../scripts/forgeflow/render-dogfood-refresh-plan');
const { buildLeanBenchmarkRunner } = require('../../scripts/forgeflow/render-lean-benchmark-runner');
const { buildLeanHostCliProbes } = require('../../scripts/forgeflow/render-lean-host-cli-probes');
const { buildLeanPrime } = require('../../scripts/forgeflow/render-lean-prime');
const { buildLeanStatus } = require('../../scripts/forgeflow/render-lean-status');
const { buildStaleArtifactPlan } = require('../../scripts/forgeflow/render-stale-artifact-plan');
const { latestFailureDigest } = require('../../scripts/forgeflow/show-project-trends');

function defaultProjectDir(projectRoot) {
  return path.join(projectRoot, '.forgeflow', path.basename(projectRoot));
}

function isInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function readJson(file, root) {
  try {
    const stat = await fs.promises.lstat(file);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink > 1) {
      return { status: 'invalid', reason: 'unsafe-file' };
    }
    const realRoot = await fs.promises.realpath(root);
    const realFile = await fs.promises.realpath(file);
    if (!isInside(realRoot, realFile)) return { status: 'invalid', reason: 'outside-root' };
    const parsed = JSON.parse(await fs.promises.readFile(realFile, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { status: 'invalid', reason: 'expected-object' };
    }
    return { status: 'present', value: parsed };
  } catch (err) {
    if (err.code === 'ENOENT') return { status: 'missing', reason: 'not-found' };
    return { status: 'invalid', reason: err.message };
  }
}

function card(id, label, status, summary, next, details = []) {
  return {
    id,
    label,
    status,
    summary,
    next: next || '',
    details: details.filter(Boolean).slice(0, 5),
  };
}

function statusFromRead(read, fallback = 'missing') {
  if (read.status !== 'present') return fallback;
  return read.value.status || read.value.readiness?.status || 'present';
}

function contextBudgetCard(contextTelemetry) {
  if (contextTelemetry.status !== 'present') {
    return card('context-budget', 'Context Budget', 'missing', 'No latest context telemetry artifact found.', '/forgeflow-review');
  }
  const value = contextTelemetry.value;
  const budgetStatus = value.budget_status || value.context_budget_status || value.summary?.budget_status || 'unknown';
  const compact = Number(value.compact_tokens || value.total_compact_tokens || value.summary?.compact_tokens || 0);
  const saved = Number(value.estimated_saved_tokens || value.saved_tokens || value.summary?.estimated_saved_tokens || 0);
  return card(
    'context-budget',
    'Context Budget',
    budgetStatus,
    `Compact tokens ${compact}; estimated saved tokens ${saved}.`,
    budgetStatus === 'pass' ? '' : '/forgeflow-context-advisor',
  );
}

function releaseReadinessCard(releaseReadiness) {
  if (releaseReadiness.status !== 'present') {
    return card('release-readiness', 'Release Readiness', 'missing', 'No saved release-readiness snapshot found.', '/forgeflow-release-readiness --save-current');
  }
  const status = releaseReadiness.value.status || 'unknown';
  const blockers = Array.isArray(releaseReadiness.value.blockers) ? releaseReadiness.value.blockers.length : 0;
  return card(
    'release-readiness',
    'Release Readiness',
    status,
    `${blockers} blocker(s) in latest saved snapshot.`,
    status === 'ready' ? '' : '/forgeflow-release-readiness',
    releaseReadiness.value.command_count ? [`${releaseReadiness.value.command_count} checks in latest snapshot.`] : [],
  );
}

function learningCard(latestInsights) {
  if (latestInsights.status !== 'present') {
    return card('learning-status', 'Learning Status', 'missing', 'No latest-insights report found.', '/forgeflow-learnings --project --check');
  }
  const status = latestInsights.value.status || latestInsights.value.latest_insights_readiness?.status || 'unknown';
  const freshness = latestInsights.value.freshness?.status || latestInsights.value.latest_insights_readiness?.freshness?.status || '';
  const summary = freshness ? `Latest insights ${status}; freshness ${freshness}.` : `Latest insights ${status}.`;
  return card(
    'learning-status',
    'Learning Status',
    status,
    summary,
    status === 'injected' || status === 'ready' ? '' : '/forgeflow-learnings --project --check',
  );
}

function dogfoodCard(dogfoodReport) {
  if (dogfoodReport.status !== 'present') {
    return card('dogfood-report', 'Dogfood Report', 'missing', 'No dogfood report snapshot found.', '/forgeflow-dogfood-report --write');
  }
  const decision = dogfoodReport.value.promotion_decision || 'unknown';
  return card(
    'dogfood-report',
    'Dogfood Report',
    dogfoodReport.value.status || decision,
    `Promotion decision: ${decision}.`,
    decision === 'consider-promote' ? '' : '/forgeflow-dogfood-refresh-plan',
    dogfoodReport.value.promotion_reason ? [dogfoodReport.value.promotion_reason] : [],
  );
}

function dogfoodRefreshCard(refreshPlan) {
  if (!refreshPlan || refreshPlan.status === 'error') {
    return card('dogfood-refresh-plan', 'Dogfood Refresh Plan', 'error', refreshPlan?.reason || 'Unable to render refresh plan.', '/forgeflow-dogfood-refresh-plan');
  }
  return card(
    'dogfood-refresh-plan',
    'Dogfood Refresh Plan',
    refreshPlan.status,
    refreshPlan.next_reason || 'Refresh plan rendered.',
    refreshPlan.next,
  );
}

function leanCard(leanStatus) {
  if (!leanStatus || leanStatus.status === 'error') {
    return card('lean-guidance', 'Lean Guidance', 'error', leanStatus?.reason || 'Unable to render lean status.', '/forgeflow-lean-prime');
  }
  const profile = leanStatus.lean_mode || 'unknown';
  const eligible = leanStatus.injection_eligible ? 'eligible' : 'blocked';
  return card(
    'lean-guidance',
    'Lean Guidance',
    leanStatus.injection_eligible ? 'ready' : leanStatus.status,
    `Profile ${profile}; context injection ${eligible}.`,
    leanStatus.injection_eligible ? '' : (leanStatus.next || '/forgeflow-lean-prime'),
  );
}

function leanPrimeCard(leanPrime) {
  if (!leanPrime || leanPrime.status === 'error') {
    return card('lean-prime', 'Lean Prime', 'error', leanPrime?.reason || 'Unable to render lean prime checklist.', '/forgeflow-lean-prime');
  }
  const blocked = (leanPrime.steps || []).filter((item) => item.status !== 'ready').length;
  const decisionMissing = (leanPrime.steps || []).some((item) => item.id === 'decision' && item.status !== 'ready');
  const next = decisionMissing
    ? '/forgeflow-lean-prime --prime-task "<work item>" --write-report'
    : (leanPrime.next || '');
  return card(
    'lean-prime',
    'Lean Prime',
    leanPrime.status,
    `${blocked} checklist step(s) need attention.`,
    next,
    leanPrime.bootstrap?.available ? [`Bootstrap: ${leanPrime.bootstrap.command}`] : [],
  );
}

function hostVerificationCard(hostProbes) {
  if (!hostProbes || hostProbes.status === 'error') {
    return card('host-verification', 'Host Verification', 'error', hostProbes?.reason || 'Unable to inspect host CLI probes.', '/forgeflow-lean-host-cli-probes');
  }
  const summary = hostProbes.summary || {};
  const verified = Number(summary.verified || 0);
  const probes = Number(summary.probes || 0);
  const missing = Number(summary.missing || 0);
  const status = missing > 0 ? 'partial' : (verified === probes && probes > 0 ? 'ready' : 'watch');
  const next = status === 'ready' ? '' : '/forgeflow-lean-host-cli-probes --write-template';
  return card(
    'host-verification',
    'Host Verification',
    status,
    `${verified}/${probes} host probe(s) verified; ${missing} missing.`,
    next,
    [
      `${Number(summary.strong_evidence || 0)} strong evidence item(s).`,
      `${Number(summary.pending_manual || 0)} probe(s) pending manual evidence.`,
    ],
  );
}

function benchmarkEvidenceCard(benchmarkRunner, benchmarkResults, benchmarkLedger) {
  if (!benchmarkRunner || benchmarkRunner.status === 'error') {
    return card('benchmark-evidence', 'Benchmark Evidence', 'error', benchmarkRunner?.reason || 'Unable to render benchmark evidence.', '/forgeflow-lean-benchmark-runner');
  }
  const resultsPresent = benchmarkResults.status === 'present';
  const ledgerPresent = benchmarkLedger.status === 'present';
  const runs = Number(benchmarkResults.value?.summary?.runs || benchmarkResults.value?.runs?.length || benchmarkLedger.value?.summary?.imported_runs || 0);
  const status = resultsPresent && runs > 0 ? 'ready' : (ledgerPresent ? 'watch' : 'missing');
  const next = status === 'ready' ? '/forgeflow-lean-benchmark-results --results .forgeflow/<project>/context/lean-benchmark-runner/normalized-results.json' : '/forgeflow-lean-benchmark-runner --write';
  const summary = status === 'ready'
    ? `${runs} normalized benchmark run(s) available.`
    : `${benchmarkRunner.tasks?.length || 0} task(s) scaffolded; no normalized benchmark evidence yet.`;
  return card('benchmark-evidence', 'Benchmark Evidence', status, summary, next, [
    benchmarkRunner.evidence ? `Evidence grade: ${benchmarkRunner.evidence.grade}.` : '',
    `${benchmarkRunner.historical_tasks?.length || 0} historical replay task(s) scaffolded.`,
  ]);
}

function guidanceAftercareCard(stalePlan) {
  if (!stalePlan || stalePlan.status === 'error') {
    return card('guidance-aftercare', 'Guidance Aftercare', 'error', stalePlan?.reason || 'Unable to render stale artifact plan.', '/forgeflow-stale-artifact-plan');
  }
  return card(
    'guidance-aftercare',
    'Guidance Aftercare',
    stalePlan.status,
    stalePlan.build_aftercare?.summary || stalePlan.next_reason || 'Guidance aftercare rendered.',
    stalePlan.commands?.[0] || '',
  );
}

function failureDigestCard(failureDigest) {
  if (!failureDigest || failureDigest.status === 'invalid') {
    return card('failure-digest', 'Failure Digest', 'invalid', failureDigest?.reason || 'Latest failure digest could not be read.', '/forgeflow-failure-digest');
  }
  if (!failureDigest.present) {
    return card(
      'failure-digest',
      'Failure Digest',
      'watch',
      'No captured validation failure digest yet.',
      '/forgeflow-failure-digest',
      [failureDigest.first_run_guidance || 'Capture the next failed validation output.'],
    );
  }
  return card(
    'failure-digest',
    'Failure Digest',
    failureDigest.status || 'present',
    failureDigest.summary || 'Latest failure digest is present.',
    failureDigest.raw_required ? '/forgeflow-failure-digest' : '',
    [
      failureDigest.mode ? `Mode: ${failureDigest.mode}.` : '',
      failureDigest.generated_at ? `Generated: ${failureDigest.generated_at}.` : '',
    ],
  );
}

function overallStatus(cards) {
  const statuses = cards.map((item) => item.status);
  if (statuses.some((item) => ['fail', 'failed', 'error', 'invalid', 'blocked'].includes(item))) return 'attention';
  if (statuses.some((item) => ['missing', 'warn', 'warning', 'watch', 'refresh-needed', 'attention'].includes(item))) return 'watch';
  return 'ready';
}

async function scanReadiness(opts = {}) {
  const projectRoot = path.resolve(opts.projectRoot || process.cwd());
  const helperRoot = path.resolve(opts.helperRoot || path.join(__dirname, '..', '..'));
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(projectRoot));
  const contextDir = path.join(projectDir, 'context');
  const latestDir = path.join(contextDir, 'latest');
  const [
    latestInsights,
    contextTelemetry,
    releaseReadiness,
    dogfoodReport,
    projectModel,
    benchmarkResults,
    benchmarkLedger,
  ] = await Promise.all([
    readJson(path.join(latestDir, 'latest-insights-report.json'), projectDir),
    readJson(path.join(latestDir, 'context-telemetry.json'), projectDir),
    readJson(path.join(projectDir, 'release-readiness', 'last.json'), projectDir),
    readJson(path.join(contextDir, 'dogfood-report.json'), projectDir),
    readJson(path.join(contextDir, 'project-operating-model.json'), projectDir),
    readJson(path.join(contextDir, 'lean-benchmark-runner', 'normalized-results.json'), projectDir),
    readJson(path.join(contextDir, 'lean-benchmark-runner', 'run-ledger.json'), projectDir),
  ]);

  let refreshPlan;
  let leanStatus;
  let leanPrime;
  let hostProbes;
  let benchmarkRunner;
  let stalePlan;
  let failureDigest;
  try {
    refreshPlan = renderDogfoodRefreshPlan({ root: projectRoot, projectDir });
  } catch (err) {
    refreshPlan = { status: 'error', reason: err.message, next: '/forgeflow-dogfood-refresh-plan' };
  }
  try {
    leanStatus = buildLeanStatus({ root: helperRoot, projectDir });
  } catch (err) {
    leanStatus = { status: 'error', reason: err.message, next: '/forgeflow-lean-prime' };
  }
  try {
    leanPrime = buildLeanPrime({ root: helperRoot, projectDir });
  } catch (err) {
    leanPrime = { status: 'error', reason: err.message, next: '/forgeflow-lean-prime', steps: [] };
  }
  try {
    hostProbes = buildLeanHostCliProbes({ root: helperRoot });
  } catch (err) {
    hostProbes = { status: 'error', reason: err.message, next: '/forgeflow-lean-host-cli-probes' };
  }
  try {
    benchmarkRunner = buildLeanBenchmarkRunner({ root: helperRoot, projectDir });
  } catch (err) {
    benchmarkRunner = { status: 'error', reason: err.message, next: '/forgeflow-lean-benchmark-runner' };
  }
  try {
    stalePlan = buildStaleArtifactPlan({ root: projectRoot, projectDir });
  } catch (err) {
    stalePlan = { status: 'error', reason: err.message, next: '/forgeflow-stale-artifact-plan' };
  }
  try {
    failureDigest = latestFailureDigest(projectDir);
  } catch (err) {
    failureDigest = { status: 'invalid', reason: err.message, present: false };
  }

  const cards = [
    card(
      'project-health',
      'Project Health',
      projectModel.status === 'present' ? 'present' : projectModel.status,
      projectModel.status === 'present' ? 'Project operating model artifact is present.' : 'Project operating model artifact is missing or invalid.',
      projectModel.status === 'present' ? '' : '/forgeflow-project-model',
    ),
    learningCard(latestInsights),
    contextBudgetCard(contextTelemetry),
    leanPrimeCard(leanPrime),
    leanCard(leanStatus),
    hostVerificationCard(hostProbes),
    benchmarkEvidenceCard(benchmarkRunner, benchmarkResults, benchmarkLedger),
    guidanceAftercareCard(stalePlan),
    failureDigestCard(failureDigest),
    releaseReadinessCard(releaseReadiness),
    dogfoodCard(dogfoodReport),
    dogfoodRefreshCard(refreshPlan),
  ];

  return {
    schema_version: '1',
    generated_at: new Date().toISOString(),
    project: path.basename(projectRoot),
    status: overallStatus(cards),
    cards,
    artifacts: {
      latest_insights: statusFromRead(latestInsights),
      context_telemetry: statusFromRead(contextTelemetry),
      release_readiness: statusFromRead(releaseReadiness),
      dogfood_report: statusFromRead(dogfoodReport),
      project_operating_model: statusFromRead(projectModel, projectModel.status),
      lean_guidance: leanStatus.status,
      lean_prime: leanPrime.status,
      host_verification: hostProbes.status,
      benchmark_evidence: statusFromRead(benchmarkResults),
      benchmark_run_ledger: statusFromRead(benchmarkLedger),
      guidance_aftercare: stalePlan.status,
      failure_digest: failureDigest.status,
    },
    lean_prime_steps: (leanPrime.steps || []).map((item) => ({
      id: item.id,
      status: item.status,
      next: item.next,
      reason: item.reason,
      label: item.label,
    })),
    next: cards.find((item) => item.next)?.next || '',
    boundary: 'Dashboard readiness is read-only. It reads local artifacts and does not refresh, write, spawn agents, call GitHub, export telemetry, commit, push, or promote automation.',
  };
}

module.exports = { scanReadiness };
