#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { adviseContext } = require('./advise-context');
const {
  currentGitState,
  latestInsightsFreshness,
  latestInsightsReadiness,
  repoRoot,
} = require('./latest-insights-state');
const { compareCodeMapTrend, importGapSummary, readCodeMapHistory } = require('./show-code-map');

function usage() {
  console.error('Usage: show-project-trends.js [--project-dir <dir>] [--refresh] [--json]');
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
    projectDir: '',
    refresh: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--refresh') {
      opts.refresh = true;
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

function readFile(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function parseGeneratedAt(markdown) {
  const match = String(markdown || '').match(/^- Generated at:\s*(.+)$/mu);
  return match ? match[1].trim() : '';
}

function latestCodeMapTrend(history) {
  const records = Array.isArray(history) ? history.filter((item) => item && item.summary) : [];
  if (records.length < 2) return { status: records.length === 1 ? 'first-run' : 'missing' };
  return compareCodeMapTrend(records[records.length - 1], records.slice(0, -1));
}

function parseProjectLearnings(markdown) {
  const sourceLine = String(markdown || '').split(/\r?\n/).find((line) => line.startsWith('- Code map history:')) || '';
  const consumedTrend = /trend\s+compared/.test(sourceLine);
  const snapshotMatch = sourceLine.match(/Code map history:\s*(\d+)\s+snapshot/);
  return {
    present: Boolean(markdown),
    generated_at: parseGeneratedAt(markdown),
    consumed_code_map_trend: consumedTrend,
    consumed_code_map_history_snapshots: snapshotMatch ? Number.parseInt(snapshotMatch[1], 10) : null,
    code_map_history_source: sourceLine.replace(/^- /, ''),
  };
}

function freshnessStatus(items) {
  if (items.some((item) => item.severity === 'missing')) return 'missing';
  if (items.some((item) => item.severity === 'attention')) return 'attention';
  return 'current';
}

function projectFreshness({ current, latest, historySnapshots = 0, projectLearnings, allowRefreshLag = false }) {
  const items = [];
  if (!latest) {
    items.push({
      code: 'code-map-missing',
      severity: 'missing',
      message: 'No code-map history snapshot is available.',
    });
  } else if (current.available && current.commit_short && latest.commit_short && current.commit_short !== latest.commit_short) {
    items.push({
      code: 'code-map-commit-stale',
      severity: 'attention',
      message: `Latest code-map snapshot is for ${latest.commit_short}, current HEAD is ${current.commit_short}.`,
    });
  }
  if (latest && current.available && current.dirty && !latest.dirty) {
    items.push({
      code: 'code-map-dirty-stale',
      severity: 'attention',
      message: 'Current worktree has local changes that the latest clean code-map snapshot did not include.',
    });
  }
  if (!projectLearnings.present) {
    items.push({
      code: 'project-learnings-missing',
      severity: 'missing',
      message: 'Project learnings are not present.',
    });
  } else if (!projectLearnings.generated_at) {
    items.push({
      code: 'project-learnings-generated-at-missing',
      severity: 'attention',
      message: 'Project learnings do not include generated-at metadata.',
    });
  } else if (
    Number.isFinite(projectLearnings.consumed_code_map_history_snapshots)
    && historySnapshots > projectLearnings.consumed_code_map_history_snapshots
    && !(allowRefreshLag && historySnapshots === projectLearnings.consumed_code_map_history_snapshots + 1)
  ) {
    items.push({
      code: 'project-learnings-code-map-stale',
      severity: 'attention',
      message: `Project learnings consumed ${projectLearnings.consumed_code_map_history_snapshots} code-map snapshot(s), but ${historySnapshots} are available.`,
    });
  }
  return {
    status: freshnessStatus(items),
    current_commit: current.commit_short || '',
    current_dirty: Boolean(current.dirty),
    issues: items,
  };
}

function topList(items, limit = 5) {
  return (items || []).slice(0, limit);
}

function refreshProjectGuidance(projectDir) {
  const { showProjectLearnings } = require('./show-project-learnings');
  const result = showProjectLearnings({ projectDir, check: true });
  return {
    status: result.check && result.check.status === 'pass' ? 'pass' : 'attention',
    project_learnings: result.out || '',
    check_status: result.check ? result.check.status : '',
    context_smoke_status: result.context_smoke ? result.context_smoke.status : '',
    latest_insights_status: result.context_smoke ? result.context_smoke.latest_insights_status : '',
    latest_insights_ready: Boolean(result.latest_insights_ready),
  };
}

function readJson(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_err) {
    return null;
  }
}

function latestImportGaps(contextDir, limit = 5) {
  const topology = readJson(path.join(contextDir, 'code-topology.json'))
    || readJson(path.join(contextDir, 'latest', 'code-topology.json'));
  if (!topology || topology.schema_version !== '1') {
    return {
      status: 'missing',
      unresolved_total: 0,
      skipped_dynamic_total: 0,
      unresolved: [],
      skipped_dynamic: [],
    };
  }
  const gaps = importGapSummary(topology, limit);
  const unresolvedTotal = gaps.limits.unresolved_total || 0;
  const skippedDynamicTotal = gaps.limits.skipped_dynamic_total || 0;
  const productionTotal = gaps.limits.production_total || 0;
  const testFixtureTotal = gaps.limits.test_fixture_total || 0;
  return {
    status: productionTotal > 0 ? 'attention' : (unresolvedTotal > 0 || skippedDynamicTotal > 0 ? 'info' : 'clear'),
    unresolved_total: unresolvedTotal,
    skipped_dynamic_total: skippedDynamicTotal,
    production_total: productionTotal,
    test_fixture_total: testFixtureTotal,
    unresolved: gaps.unresolved,
    skipped_dynamic: gaps.skipped_dynamic,
    triage: gaps.triage || { expected_total: 0, needs_review_total: 0, categories: [] },
  };
}

function trendRecommendations({ freshness, latestInsights, refresh, importGaps }) {
  const recommendations = [];
  const hasProjectFreshnessIssue = freshness && freshness.issues && freshness.issues.length > 0;
  const insightsFreshness = latestInsights && latestInsights.freshness ? latestInsights.freshness : null;
  const hasInsightsFreshnessIssue = insightsFreshness && insightsFreshness.issues && insightsFreshness.issues.length > 0;
  if ((hasProjectFreshnessIssue || hasInsightsFreshnessIssue) && !refresh) {
    recommendations.push({
      severity: 'attention',
      action: 'refresh-project-trends',
      command: 'forgeflow-trends --refresh',
      reason: 'Project guidance artifacts are stale or missing for the current checkout.',
    });
  }
  if (refresh && refresh.status !== 'pass') {
    recommendations.push({
      severity: 'attention',
      action: 'inspect-refresh',
      command: 'forgeflow-learnings --project --check',
      reason: 'The trends refresh did not complete cleanly.',
    });
  }
  if (importGaps && importGaps.status === 'attention') {
    recommendations.push({
      severity: 'attention',
      action: 'review-import-gaps',
      command: 'forgeflow-code-map',
      reason: `Code map has ${importGaps.production_total} production-scope import gap(s).`,
    });
  }
  return recommendations;
}

function showProjectTrends(opts = {}) {
  const root = opts.root || repoRoot();
  const projectDir = opts.projectDir || defaultProjectDir(root);
  const refresh = opts.refresh ? refreshProjectGuidance(projectDir) : null;
  const contextDir = path.join(projectDir, 'context');
  const historyPath = path.join(contextDir, 'code-map-history.jsonl');
  const learningsPath = path.join(projectDir, 'project-learnings.md');
  const history = readCodeMapHistory(historyPath);
  const trend = latestCodeMapTrend(history);
  const latest = history.length > 0 ? history[history.length - 1] : null;
  const projectLearnings = parseProjectLearnings(readFile(learningsPath));
  const advisor = adviseContext({
    root: projectDir,
    codeMapHistoryFiles: fs.existsSync(historyPath) ? [historyPath] : [],
    record: Boolean(opts.refresh),
  });
  const current = currentGitState(root);
  const latestInsights = latestInsightsReadiness(projectDir, root);
  const importGaps = latestImportGaps(contextDir);

  const freshness = projectFreshness({
    current,
    latest,
    historySnapshots: history.length,
    projectLearnings,
    allowRefreshLag: refresh && refresh.status === 'pass',
  });
  const result = {
    schema_version: '1',
    project_dir: projectDir,
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    refresh,
    paths: {
      code_map_history: fs.existsSync(historyPath) ? path.relative(root, historyPath) : null,
      project_learnings: fs.existsSync(learningsPath) ? path.relative(root, learningsPath) : null,
      latest_insights_report: fs.existsSync(latestInsights.path) ? path.relative(root, latestInsights.path) : null,
    },
    code_map: {
      history_snapshots: history.length,
      latest_generated_at: latest ? latest.generated_at || '' : '',
      latest_commit: latest ? latest.commit_short || '' : '',
      latest_dirty: latest ? Boolean(latest.dirty) : false,
      summary: latest ? latest.summary || null : null,
      trend,
      new_high_fan_in: topList(trend.new_high_fan_in),
      new_high_fan_out: topList(trend.new_high_fan_out),
    },
    import_gaps: importGaps,
    project_learnings: projectLearnings,
    freshness,
    latest_insights: latestInsights,
    advisor: {
      budget_status: advisor.budget.status,
      code_topology_status: advisor.code_topology.status,
      code_map_trends_status: advisor.code_map_trends.status,
      recommendation_actions: advisor.recommendations.map((item) => item.action),
      recommendations: advisor.recommendations.slice(0, 5).map((item) => ({
        severity: item.severity,
        action: item.action,
        command: item.command,
        reason: item.reason,
      })),
      estimated_compact_tokens: advisor.summary.totals.estimated_compact_tokens,
      estimated_saved_tokens: advisor.summary.totals.estimated_saved_tokens,
      percent_saved: advisor.summary.percent_saved,
    },
  };
  result.recommendations = trendRecommendations({ freshness, latestInsights, refresh, importGaps });
  return result;
}

function renderMarkdown(result) {
  const trend = result.code_map.trend || {};
  return [
    '# Forgeflow Project Trends',
    '',
    `Project: ${result.project_dir}`,
    `Generated at: ${result.generated_at}`,
    result.refresh ? `Refresh: ${result.refresh.status}` : 'Refresh: not requested',
    '',
    '## Recommendations',
    '',
    ...(result.recommendations.length > 0
      ? result.recommendations.map((item) => `- ${item.command}: ${item.reason}`)
      : ['- (none)']),
    '',
    '## Code Map Trend',
    '',
    `- Status: ${trend.status || 'missing'}`,
    `- History snapshots: ${result.code_map.history_snapshots}`,
    `- Latest snapshot: ${result.code_map.latest_generated_at || '(none)'}`,
    `- Source files delta: ${trend.source_files_delta ?? 0}`,
    `- Local edges delta: ${trend.local_edges_delta ?? 0}`,
    `- Unresolved imports delta: ${trend.unresolved_imports_delta ?? 0}`,
    `- Changed sections delta: ${trend.changed_sections_delta ?? 0}`,
    `- New high fan-in: ${result.code_map.new_high_fan_in.length > 0 ? result.code_map.new_high_fan_in.join(', ') : '(none)'}`,
    `- New high fan-out: ${result.code_map.new_high_fan_out.length > 0 ? result.code_map.new_high_fan_out.join(', ') : '(none)'}`,
    '',
    '## Import Gaps',
    '',
    `- Status: ${result.import_gaps.status}`,
    `- Unresolved imports: ${result.import_gaps.unresolved_total}`,
    `- Skipped dynamic imports: ${result.import_gaps.skipped_dynamic_total}`,
    `- Production-scope gaps: ${result.import_gaps.production_total || 0}`,
    `- Test/fixture-scope gaps: ${result.import_gaps.test_fixture_total || 0}`,
    `- Likely expected gaps: ${result.import_gaps.triage ? result.import_gaps.triage.expected_total || 0 : 0}`,
    `- Needs review: ${result.import_gaps.triage ? result.import_gaps.triage.needs_review_total || 0 : 0}`,
    `- Top triage: ${result.import_gaps.triage && result.import_gaps.triage.categories.length > 0 ? result.import_gaps.triage.categories.slice(0, 3).map((item) => `${item.category} (${item.total})`).join(', ') : '(none)'}`,
    `- First unresolved: ${result.import_gaps.unresolved.length > 0 ? `${result.import_gaps.unresolved[0].source}: ${result.import_gaps.unresolved[0].specifier}` : '(none)'}`,
    `- First dynamic: ${result.import_gaps.skipped_dynamic.length > 0 ? `${result.import_gaps.skipped_dynamic[0].source}: dynamic import ${result.import_gaps.skipped_dynamic[0].expression}` : '(none)'}`,
    '',
    '## Freshness',
    '',
    `- Status: ${result.freshness.status}`,
    `- Current HEAD: ${result.freshness.current_commit || '(unknown)'}`,
    `- Current dirty: ${result.freshness.current_dirty ? 'yes' : 'no'}`,
    `- Issues: ${result.freshness.issues.length > 0 ? result.freshness.issues.map((item) => `${item.code}: ${item.message}`).join('; ') : '(none)'}`,
    '',
    '## Latest Insights',
    '',
    `- Status: ${result.latest_insights.status}`,
    `- Gate: ${result.latest_insights.check_status || '(unknown)'}`,
    `- Freshness: ${result.latest_insights.freshness ? result.latest_insights.freshness.status : 'unknown'}`,
    `- Issues: ${result.latest_insights.freshness && result.latest_insights.freshness.issues.length > 0 ? result.latest_insights.freshness.issues.map((item) => `${item.code}: ${item.message}`).join('; ') : '(none)'}`,
    '',
    '## Project Learnings',
    '',
    `- Present: ${result.project_learnings.present ? 'yes' : 'no'}`,
    `- Consumed code-map trend: ${result.project_learnings.consumed_code_map_trend ? 'yes' : 'no'}`,
    result.project_learnings.code_map_history_source ? `- Source: ${result.project_learnings.code_map_history_source}` : '- Source: (none)',
    '',
    '## Advisor',
    '',
    `- Budget: ${result.advisor.budget_status}`,
    `- Code topology: ${result.advisor.code_topology_status}`,
    `- Code map trends: ${result.advisor.code_map_trends_status}`,
    `- Percent saved: ${result.advisor.percent_saved}%`,
    `- Recommendations: ${result.advisor.recommendation_actions.join(', ') || '(none)'}`,
    ...(result.advisor.recommendations.length > 0
      ? result.advisor.recommendations.map((item) => `- Next: ${item.command}: ${item.reason}`)
      : []),
  ].join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = showProjectTrends(opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderMarkdown(result)}\n`);
  }
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
  latestInsightsFreshness,
  latestInsightsReadiness,
  latestCodeMapTrend,
  parseProjectLearnings,
  latestImportGaps,
  projectFreshness,
  renderMarkdown,
  showProjectTrends,
};
