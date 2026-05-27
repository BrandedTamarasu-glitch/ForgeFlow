#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { runHealthCheck } = require('./health-check');
const { showCodeMap } = require('./show-code-map');
const { showProjectTrends } = require('./show-project-trends');
const { buildReport } = require('./render-forgeflow-report');
const { explainRecommendations } = require('./guidance-contract');

function usage() {
  console.error('Usage: smoke-check.js [--mode downstream|source|full] [--root <dir>] [--project-dir <dir>] [--patterns-dir <dir>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) {
    console.error(`Missing value for ${name}`);
    usage();
    process.exit(2);
  }
  return value;
}

function parseArgs(argv) {
  const opts = {
    root: '',
    projectDir: '',
    patternsDir: '',
    mode: 'downstream',
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
    } else if (arg === '--patterns-dir') {
      opts.patternsDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--mode') {
      opts.mode = requireValue(argv, arg, i);
      if (!['downstream', 'source', 'full'].includes(opts.mode)) {
        console.error(`Unknown smoke mode: ${opts.mode}`);
        usage();
        process.exit(2);
      }
      i += 1;
    } else if (arg === '--downstream') {
      opts.mode = 'downstream';
    } else if (arg === '--source' || arg === '--release') {
      opts.mode = 'source';
    } else if (arg === '--full') {
      opts.mode = 'full';
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      usage();
      process.exit(2);
    }
  }
  return opts;
}

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function defaultPatternsDir(root) {
  return path.join(root, 'forgeflow-patterns');
}

function statusRank(status) {
  return { pass: 0, skip: 0, warn: 1, fail: 2 }[status] ?? 2;
}

function combineStatus(checks) {
  return checks.reduce((status, check) => (statusRank(check.status) > statusRank(status) ? check.status : status), 'pass');
}

function check(name, status, detail = {}) {
  const explanation = detail.recommendations && detail.recommendations.length > 0
    ? explainRecommendations(detail.recommendations)
    : null;
  return {
    name,
    status,
    ...(explanation && explanation.next_actions.length > 0 ? explanation : {}),
    ...detail,
  };
}

function nextAction(command, reason) {
  return [{ action: command.replace(/\s+/g, '-'), command, reason, evidence: '', clears: '' }];
}

function codeMapGapSummary(gaps = {}) {
  const productionTotal = gaps.limits ? gaps.limits.production_total || 0 : 0;
  const testFixtureTotal = gaps.limits ? gaps.limits.test_fixture_total || 0 : 0;
  const expectedTotal = gaps.triage ? gaps.triage.expected_total || 0 : 0;
  const needsReviewTotal = gaps.triage ? gaps.triage.needs_review_total || 0 : 0;
  return {
    production_total: productionTotal,
    test_fixture_total: testFixtureTotal,
    expected_total: expectedTotal,
    needs_review_total: needsReviewTotal,
    explanation: needsReviewTotal > 0
      ? `${needsReviewTotal} gap(s) need review. ${expectedTotal} expected gap(s) are informational.`
      : `${expectedTotal} expected gap(s) are informational; no import gaps currently need review.`,
  };
}

function helperRoot() {
  return path.resolve(__dirname, '..', '..');
}

function resolveNodeTestRoot(root, script, helperRepoRoot = helperRoot()) {
  void helperRepoRoot;
  return fs.existsSync(path.join(root, script)) ? root : null;
}

function runOptionalNodeTest(root, script, displayCommand, helperRepoRoot = helperRoot()) {
  const testRoot = resolveNodeTestRoot(root, script, helperRepoRoot);
  if (!testRoot) {
    return {
      status: 'skip',
      exit_code: null,
      stdout: '',
      stderr: '',
      reason: 'source-tree test not available in this install',
      command: displayCommand,
    };
  }
  const result = spawnSync(process.execPath, [path.join(testRoot, script)], { cwd: testRoot, encoding: 'utf8' });
  return {
    status: result.status === 0 ? 'pass' : 'fail',
    exit_code: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    command: displayCommand,
  };
}

function sourceCheck(root, name, script, helperRepoRoot = helperRoot()) {
  const result = runOptionalNodeTest(root, script, `node ${script}`, helperRepoRoot);
  return check(name, result.status, {
    command: result.command,
    summary: result.stdout || result.stderr,
    reason: result.reason,
  });
}

function runSourceSmoke(root, helperRepoRoot = helperRoot()) {
  return [
    sourceCheck(root, 'command-coverage', 'scripts/forgeflow/test-command-coverage.js', helperRepoRoot),
    sourceCheck(root, 'doc-links', 'scripts/forgeflow/test-doc-links.js', helperRepoRoot),
    sourceCheck(root, 'plugin-manifest', 'scripts/forgeflow/test-plugin-manifest.js', helperRepoRoot),
    sourceCheck(root, 'release-version', 'scripts/forgeflow/test-release-version.js', helperRepoRoot),
    sourceCheck(root, 'install-manifest', 'scripts/forgeflow/test-install-manifest.js', helperRepoRoot),
    sourceCheck(root, 'update-forgeflow', 'scripts/forgeflow/test-update-forgeflow.js', helperRepoRoot),
    sourceCheck(root, 'dogfood-self-test', 'scripts/forgeflow/test-dogfood-self-test.js', helperRepoRoot),
    sourceCheck(root, 'installed-runtime-dogfood', 'scripts/forgeflow/test-installed-runtime-dogfood.js', helperRepoRoot),
  ];
}

function healthStatus(health, trends) {
  if (!health || health.status !== 'pass') return 'fail';
  const recommendations = health.recommendations || [];
  if (recommendations.length === 0) return 'pass';
  const unresolved = recommendations.filter((item) => {
    if (!['refresh-project-trends', 'refresh-latest-insights'].includes(item.action)) return true;
    const freshness = trends && trends.latest_insights && trends.latest_insights.freshness
      ? trends.latest_insights.freshness.status
      : 'missing';
    const refreshStatus = trends && trends.refresh ? trends.refresh.status : 'missing';
    return !(refreshStatus === 'pass' && freshness === 'current');
  });
  return unresolved.length > 0 ? 'warn' : 'pass';
}

function runDownstreamSmoke({ root, projectDir, patternsDir }) {
  const checks = [];

  let health = null;
  let healthIndex = -1;
  try {
    health = runHealthCheck({ root });
    healthIndex = checks.push(check('health', health.status === 'pass' ? (health.recommendations.length > 0 ? 'warn' : 'pass') : 'fail', {
      command: 'forgeflow-health',
      summary: health.status,
      recommendations: health.recommendations,
      ...(health.status !== 'pass' ? {
        reason: 'Forgeflow health check did not pass.',
        evidence: `Health status is ${health.status}.`,
        clears: 'Run forgeflow-health --fix for safe repairs, then rerun forgeflow-health.',
        next_actions: nextAction('forgeflow-health --fix', 'Apply safe health repairs before rerunning smoke.'),
      } : {}),
    })) - 1;
  } catch (err) {
    healthIndex = checks.push(check('health', 'fail', {
      command: 'forgeflow-health',
      error: err.message,
      reason: 'Forgeflow health check could not complete.',
      evidence: err.message,
      clears: 'Fix the health helper error, then rerun forgeflow-health.',
      next_actions: nextAction('forgeflow-health', 'Rerun health after fixing the helper error.'),
    })) - 1;
  }

  let trends = null;
  try {
    trends = showProjectTrends({ root, projectDir, refresh: true });
    const freshness = trends.freshness ? trends.freshness.status : 'missing';
    const latestFreshness = trends.latest_insights && trends.latest_insights.freshness ? trends.latest_insights.freshness.status : 'missing';
    const failureDigestFreshness = trends.failure_digest && trends.failure_digest.freshness ? trends.failure_digest.freshness.status : 'not-applicable';
    const refreshStatus = trends.refresh ? trends.refresh.status : 'missing';
    const trendStatus = refreshStatus === 'pass' && freshness === 'current' && latestFreshness === 'current' ? 'pass' : 'fail';
    const warningActions = (trends.recommendations || []).map((item) => item.action);
    const trendExplanation = trendStatus === 'pass' ? {} : {
      reason: 'Project trends refresh did not make guidance current.',
      evidence: `Refresh status ${refreshStatus}; project freshness ${freshness}; latest-insights freshness ${latestFreshness}.`,
      clears: 'Run forgeflow-trends --refresh after resolving project-learning or latest-insights gate issues.',
      next_actions: nextAction('forgeflow-trends --refresh', 'Refresh project trends and latest insights for the current checkout.'),
    };
    checks.push(check('trends-refresh', trendStatus === 'pass' && warningActions.length > 0 ? 'warn' : trendStatus, {
      command: 'forgeflow-trends --refresh',
      refresh_status: refreshStatus,
      freshness,
      latest_insights_freshness: latestFreshness,
      failure_digest_freshness: failureDigestFreshness,
      recommendations: trends.recommendations || [],
      import_gaps: trends.import_gaps || null,
      ...trendExplanation,
    }));
  } catch (err) {
    checks.push(check('trends-refresh', 'fail', {
      command: 'forgeflow-trends --refresh',
      error: err.message,
      reason: 'Project trends refresh could not complete.',
      evidence: err.message,
      clears: 'Fix the trends refresh error, then rerun forgeflow-trends --refresh.',
      next_actions: nextAction('forgeflow-trends --refresh', 'Rerun trends refresh after fixing the helper error.'),
    }));
  }

  if (healthIndex >= 0 && health) {
    const status = healthStatus(health, trends);
    checks[healthIndex] = {
      ...checks[healthIndex],
      status,
      resolved_recommendations: status === 'pass'
        ? (health.recommendations || []).filter((item) => ['refresh-project-trends', 'refresh-latest-insights'].includes(item.action))
        : [],
    };
  }

  let report = null;
  try {
    report = buildReport({ root, projectDir, patternsDir, refresh: true, noDrift: true, record: false });
    const latestFreshness = report.latest_insights && report.latest_insights.freshness ? report.latest_insights.freshness.status : 'missing';
    const failureDigestFreshness = report.project_trends && report.project_trends.failure_digest && report.project_trends.failure_digest.freshness
      ? report.project_trends.failure_digest.freshness.status
      : 'not-applicable';
    const budgetStatus = report.context && report.context.budget ? report.context.budget.status : 'missing';
    const refreshStatus = report.project_trends && report.project_trends.refresh ? report.project_trends.refresh.status : 'missing';
    const reportStatus = refreshStatus === 'pass' && latestFreshness === 'current'
      ? (budgetStatus === 'pass' && failureDigestFreshness !== 'attention' ? 'pass' : 'warn')
      : 'fail';
    const reportExplanation = reportStatus === 'pass' ? {} : {
      reason: reportStatus === 'fail'
        ? 'Forgeflow report refresh did not make latest insights current.'
        : 'Forgeflow report refreshed but advisory report gates still need attention.',
      evidence: `Refresh status ${refreshStatus}; latest-insights freshness ${latestFreshness}; budget status ${budgetStatus}; failure-digest freshness ${failureDigestFreshness}.`,
      clears: reportStatus === 'fail'
        ? 'Run forgeflow-report --refresh --no-drift after resolving latest-insights freshness issues.'
        : 'Trim context scope or refresh the failure digest until report advisory gates return pass.',
      next_actions: nextAction('forgeflow-report --refresh --no-drift', 'Refresh the report and inspect remaining advisory gates.'),
    };
    checks.push(check('report-refresh', reportStatus, {
      command: 'forgeflow-report --refresh --no-drift',
      refresh_status: refreshStatus,
      budget_status: budgetStatus,
      latest_insights_freshness: latestFreshness,
      failure_digest_freshness: failureDigestFreshness,
      recommendations: report.recommendations || [],
      priorities: report.priorities || [],
      ...reportExplanation,
    }));
  } catch (err) {
    checks.push(check('report-refresh', 'fail', {
      command: 'forgeflow-report --refresh --no-drift',
      error: err.message,
      reason: 'Forgeflow report refresh could not complete.',
      evidence: err.message,
      clears: 'Fix the report refresh error, then rerun forgeflow-report --refresh --no-drift.',
      next_actions: nextAction('forgeflow-report --refresh --no-drift', 'Rerun report refresh after fixing the helper error.'),
    }));
  }

  try {
    const codeMap = showCodeMap({ root, projectDir, recordHistory: false });
    const gaps = codeMap.summary.import_gaps || {};
    const gapSummary = codeMapGapSummary(gaps);
    const codeMapExplanation = gapSummary.needs_review_total > 0 ? {
      reason: 'Code map has import gaps that need review.',
      evidence: `${gapSummary.needs_review_total} import gap(s) need review; ${gapSummary.production_total} production-scope gap(s) reported in total; ${gapSummary.expected_total} expected gap(s) are informational.`,
      clears: 'Run forgeflow-code-map, then fix or classify the import gaps marked as needing review.',
      next_actions: nextAction('forgeflow-code-map', 'Review import gaps marked as needing review.'),
    } : gapSummary.expected_total > 0 ? {
      summary: gapSummary.explanation,
    } : {};
    checks.push(check('code-map', gapSummary.needs_review_total > 0 ? 'warn' : 'pass', {
      command: 'forgeflow-code-map',
      unresolved_total: gaps.limits ? gaps.limits.unresolved_total : 0,
      skipped_dynamic_total: gaps.limits ? gaps.limits.skipped_dynamic_total : 0,
      production_total: gapSummary.production_total,
      test_fixture_total: gapSummary.test_fixture_total,
      expected_total: gapSummary.expected_total,
      needs_review_total: gapSummary.needs_review_total,
      import_gap_explanation: gapSummary.explanation,
      triage_categories: gaps.triage ? gaps.triage.categories.slice(0, 5) : [],
      ...codeMapExplanation,
    }));
  } catch (err) {
    checks.push(check('code-map', 'fail', {
      command: 'forgeflow-code-map',
      error: err.message,
      reason: 'Forgeflow code map could not complete.',
      evidence: err.message,
      clears: 'Fix the code-map helper error, then rerun forgeflow-code-map.',
      next_actions: nextAction('forgeflow-code-map', 'Rerun code map after fixing the helper error.'),
    }));
  }

  return checks;
}

function smokeCheck(opts = {}) {
  const root = opts.root || process.cwd();
  const projectDir = opts.projectDir || defaultProjectDir(root);
  const patternsDir = opts.patternsDir || defaultPatternsDir(root);
  const mode = opts.mode || 'downstream';
  const checks = [];

  if (mode === 'downstream' || mode === 'full') {
    checks.push(...runDownstreamSmoke({ root, projectDir, patternsDir }));
  }
  if (mode === 'source' || mode === 'full') {
    const sourceChecks = runSourceSmoke(root);
    checks.push(...sourceChecks);
    if (sourceChecks.length > 0 && sourceChecks.every((item) => item.status === 'skip')) {
      checks.push(check('source-release-guards', 'fail', {
        command: 'forgeflow-smoke --mode source',
        reason: 'Source-mode release guards were not available in this checkout.',
        evidence: 'Every source release check was skipped because source-tree tests were not found.',
        clears: 'Run source-mode smoke from the Forgeflow source checkout, or use downstream smoke for installed project readiness.',
        next_actions: nextAction('forgeflow-smoke --mode source', 'Rerun from a Forgeflow source checkout where release tests are present.'),
      }));
    }
  }

  return {
    schema_version: '1',
    generated_at: new Date().toISOString(),
    mode,
    root,
    project_dir: projectDir,
    patterns_dir: patternsDir,
    status: combineStatus(checks),
    checks,
  };
}

function renderMarkdown(result) {
  const lines = [
    `# Forgeflow Smoke Check (${result.mode || 'downstream'}): ${result.status.toUpperCase()}`,
    '',
    `Root: ${result.root}`,
    `Project dir: ${result.project_dir}`,
    '',
    '| Check | Status | Command | Summary |',
    '|---|---|---|---|',
  ];
  for (const item of result.checks) {
    const nextActions = (item.next_actions || [])
      .map((entry) => entry.command || entry.action || entry.reason)
      .filter(Boolean)
      .join(', ');
    const primarySummary = item.status === 'warn' || item.status === 'fail'
      ? (item.reason || item.error || item.summary || '')
      : (item.error || item.summary || item.reason || '');
    const summaryParts = [
      primarySummary,
      item.evidence ? `Evidence: ${item.evidence}` : '',
      item.clears ? `Clears: ${item.clears}` : '',
      nextActions ? `Next: ${nextActions}` : '',
      !item.reason && item.recommendations && item.recommendations.length > 0 ? item.recommendations.map((entry) => entry.command || entry.reason).join(', ') : '',
    ].filter(Boolean);
    const summary = summaryParts.join(' ');
    lines.push(`| ${item.name} | ${item.status} | ${item.command || ''} | ${String(summary || '').replace(/\|/g, '\\|')} |`);
  }
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = smokeCheck(opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderMarkdown(result)}\n`);
  }
  if (result.status === 'fail') process.exit(1);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = {
  combineStatus,
  codeMapGapSummary,
  healthStatus,
  renderMarkdown,
  resolveNodeTestRoot,
  runDownstreamSmoke,
  runOptionalNodeTest,
  runSourceSmoke,
  smokeCheck,
};
