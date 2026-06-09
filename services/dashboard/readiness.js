'use strict';
const fs = require('fs');
const path = require('path');
const { renderDogfoodRefreshPlan } = require('../../scripts/forgeflow/render-dogfood-refresh-plan');

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

function card(id, label, status, summary, next) {
  return {
    id,
    label,
    status,
    summary,
    next: next || '',
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

function overallStatus(cards) {
  const statuses = cards.map((item) => item.status);
  if (statuses.some((item) => ['fail', 'failed', 'error', 'invalid', 'blocked'].includes(item))) return 'attention';
  if (statuses.some((item) => ['missing', 'warn', 'warning', 'watch', 'refresh-needed', 'attention'].includes(item))) return 'watch';
  return 'ready';
}

async function scanReadiness(opts = {}) {
  const projectRoot = path.resolve(opts.projectRoot || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(projectRoot));
  const contextDir = path.join(projectDir, 'context');
  const latestDir = path.join(contextDir, 'latest');
  const [
    latestInsights,
    contextTelemetry,
    releaseReadiness,
    dogfoodReport,
    projectModel,
  ] = await Promise.all([
    readJson(path.join(latestDir, 'latest-insights-report.json'), projectDir),
    readJson(path.join(latestDir, 'context-telemetry.json'), projectDir),
    readJson(path.join(projectDir, 'release-readiness', 'last.json'), projectDir),
    readJson(path.join(contextDir, 'dogfood-report.json'), projectDir),
    readJson(path.join(contextDir, 'project-operating-model.json'), projectDir),
  ]);

  let refreshPlan;
  try {
    refreshPlan = renderDogfoodRefreshPlan({ root: projectRoot, projectDir });
  } catch (err) {
    refreshPlan = { status: 'error', reason: err.message, next: '/forgeflow-dogfood-refresh-plan' };
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
    },
    next: cards.find((item) => item.next)?.next || '',
    boundary: 'Dashboard readiness is read-only. It reads local artifacts and does not refresh, write, spawn agents, call GitHub, export telemetry, commit, push, or promote automation.',
  };
}

module.exports = { scanReadiness };
