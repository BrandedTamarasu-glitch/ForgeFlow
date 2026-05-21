#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { runHealthCheck } = require('./health-check');
const { showCodeMap } = require('./show-code-map');
const { showProjectTrends } = require('./show-project-trends');
const { buildReport } = require('./render-forgeflow-report');

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
  return { name, status, ...detail };
}

function helperRoot() {
  return path.resolve(__dirname, '..', '..');
}

function resolveNodeTestRoot(root, script, helperRepoRoot = helperRoot()) {
  const candidates = [root, helperRepoRoot];
  return candidates.find((candidate) => fs.existsSync(path.join(candidate, script))) || null;
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
  ];
}

function healthStatus(health, trends) {
  if (!health || health.status !== 'pass') return 'fail';
  const recommendations = health.recommendations || [];
  if (recommendations.length === 0) return 'pass';
  const unresolved = recommendations.filter((item) => {
    if (item.action !== 'refresh-latest-insights') return true;
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
    })) - 1;
  } catch (err) {
    healthIndex = checks.push(check('health', 'fail', { command: 'forgeflow-health', error: err.message })) - 1;
  }

  let trends = null;
  try {
    trends = showProjectTrends({ root, projectDir, refresh: true });
    const freshness = trends.freshness ? trends.freshness.status : 'missing';
    const latestFreshness = trends.latest_insights && trends.latest_insights.freshness ? trends.latest_insights.freshness.status : 'missing';
    const refreshStatus = trends.refresh ? trends.refresh.status : 'missing';
    const trendStatus = refreshStatus === 'pass' && freshness === 'current' && latestFreshness === 'current' ? 'pass' : 'fail';
    const warningActions = (trends.recommendations || []).map((item) => item.action);
    checks.push(check('trends-refresh', trendStatus === 'pass' && warningActions.length > 0 ? 'warn' : trendStatus, {
      command: 'forgeflow-trends --refresh',
      refresh_status: refreshStatus,
      freshness,
      latest_insights_freshness: latestFreshness,
      recommendations: trends.recommendations || [],
      import_gaps: trends.import_gaps || null,
    }));
  } catch (err) {
    checks.push(check('trends-refresh', 'fail', { command: 'forgeflow-trends --refresh', error: err.message }));
  }

  if (healthIndex >= 0 && health) {
    const status = healthStatus(health, trends);
    checks[healthIndex] = {
      ...checks[healthIndex],
      status,
      resolved_recommendations: status === 'pass'
        ? (health.recommendations || []).filter((item) => item.action === 'refresh-latest-insights')
        : [],
    };
  }

  let report = null;
  try {
    report = buildReport({ root, projectDir, patternsDir, refresh: true, noDrift: true, record: false });
    const latestFreshness = report.latest_insights && report.latest_insights.freshness ? report.latest_insights.freshness.status : 'missing';
    const budgetStatus = report.context && report.context.budget ? report.context.budget.status : 'missing';
    const refreshStatus = report.project_trends && report.project_trends.refresh ? report.project_trends.refresh.status : 'missing';
    const reportStatus = refreshStatus === 'pass' && latestFreshness === 'current'
      ? (budgetStatus === 'pass' ? 'pass' : 'warn')
      : 'fail';
    checks.push(check('report-refresh', reportStatus, {
      command: 'forgeflow-report --refresh --no-drift',
      refresh_status: refreshStatus,
      budget_status: budgetStatus,
      latest_insights_freshness: latestFreshness,
      recommendations: report.recommendations || [],
      priorities: report.priorities || [],
    }));
  } catch (err) {
    checks.push(check('report-refresh', 'fail', { command: 'forgeflow-report --refresh --no-drift', error: err.message }));
  }

  try {
    const codeMap = showCodeMap({ root, projectDir, recordHistory: false });
    const gaps = codeMap.summary.import_gaps || {};
    const productionTotal = gaps.limits ? gaps.limits.production_total || 0 : 0;
    checks.push(check('code-map', productionTotal > 0 ? 'warn' : 'pass', {
      command: 'forgeflow-code-map',
      unresolved_total: gaps.limits ? gaps.limits.unresolved_total : 0,
      skipped_dynamic_total: gaps.limits ? gaps.limits.skipped_dynamic_total : 0,
      production_total: productionTotal,
      test_fixture_total: gaps.limits ? gaps.limits.test_fixture_total || 0 : 0,
    }));
  } catch (err) {
    checks.push(check('code-map', 'fail', { command: 'forgeflow-code-map', error: err.message }));
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
    checks.push(...runSourceSmoke(root));
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
    const summary = item.error
      || item.summary
      || item.reason
      || (item.recommendations && item.recommendations.length > 0 ? item.recommendations.map((entry) => entry.command || entry.reason).join(', ') : '');
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
  healthStatus,
  renderMarkdown,
  resolveNodeTestRoot,
  runDownstreamSmoke,
  runOptionalNodeTest,
  runSourceSmoke,
  smokeCheck,
};
