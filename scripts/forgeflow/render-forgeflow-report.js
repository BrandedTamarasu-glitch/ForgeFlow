#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { adviseContext } = require('./advise-context');
const { checkAgentDrift } = require('./check-agent-drift');
const {
  latestInsightsFreshness,
  latestInsightsReadiness: readLatestInsightsReadiness,
} = require('./latest-insights-state');
const { showProjectTrends } = require('./show-project-trends');

const PERIOD_DAYS = {
  week: 7,
  month: 30,
  quarter: 90,
};
const FALSE_POSITIVE_THRESHOLD = 3;

function usage() {
  console.error([
    'Usage: render-forgeflow-report.js [--period week|month|quarter|all] [--metrics-root <dir>]',
    '       [--patterns-dir <dir>] [--project-dir <dir>] [--root <dir>] [--refresh] [--no-drift] [--json]',
  ].join('\n'));
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
    period: 'month',
    metricsRoot: '',
    patternsDir: '',
    projectDir: '',
    root: '',
    refresh: false,
    noDrift: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--period') {
      opts.period = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--metrics-root') {
      opts.metricsRoot = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--patterns-dir') {
      opts.patternsDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--refresh') {
      opts.refresh = true;
    } else if (arg === '--no-drift') {
      opts.noDrift = true;
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
  if (!['week', 'month', 'quarter', 'all'].includes(opts.period)) {
    console.error(`Invalid --period: ${opts.period}`);
    usage();
    process.exit(2);
  }
  return opts;
}

function cutoffForPeriod(period, now = new Date()) {
  if (period === 'all') return '1970-01-01T00:00:00.000Z';
  return new Date(now.getTime() - PERIOD_DAYS[period] * 86400000).toISOString();
}

function walk(dir, predicate, files = []) {
  if (!dir || !fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(file, predicate, files);
    } else if (entry.isFile() && predicate(file)) {
      files.push(file);
    }
  }
  return files;
}

function defaultMetricsRoot(home = os.homedir()) {
  return path.join(home, '.claude', 'projects');
}

function defaultPatternsDir(root = process.cwd(), home = os.homedir()) {
  const local = path.join(root, 'forgeflow-patterns');
  return fs.existsSync(local) ? local : path.join(home, '.claude', 'forgeflow-patterns');
}

function readJsonl(file) {
  const records = [];
  if (!file || !fs.existsSync(file)) return records;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch (_err) {
      records.push(null);
    }
  }
  return records;
}

function inWindow(record, cutoff) {
  if (!record || !record.ts) return false;
  const value = Date.parse(record.ts);
  return !Number.isNaN(value) && value >= Date.parse(cutoff);
}

function bump(object, key, amount = 1) {
  object[key] = (object[key] || 0) + amount;
}

function addVerdict(verdicts, record) {
  const detail = record.detail || {};
  const reviewer = String(detail.reviewer || 'unknown').toLowerCase();
  const verdict = String(detail.verdict || 'unknown').toUpperCase();
  if (!verdicts[reviewer]) verdicts[reviewer] = {};
  bump(verdicts[reviewer], verdict);
}

function inferInvocation(record) {
  if (record.event === 'command-invoked' || record.event === 'command-completed') return true;
  return ['verdict', 'auto-fix-round', 'auto-fix-applied', 'fleet-shard-complete'].includes(record.event);
}

function summarizeMetrics(records) {
  const summary = {
    files: 0,
    events: records.length,
    commands: {},
    events_by_type: {},
    verdicts: {},
    auto_fix: {
      rounds: 0,
      rounds_by_number: {},
      worker_success: 0,
      worker_failed: 0,
      worker_failures: {},
    },
    fleet: {
      shards_completed: 0,
    },
    projects: {},
    false_positives: {
      overturned_total: 0,
      by_reviewer_class: {},
      flagged: [],
    },
  };

  for (const record of records) {
    if (!record) continue;
    bump(summary.events_by_type, record.event || 'unknown');
    if (record.project) bump(summary.projects, record.project);
    if (record.command && inferInvocation(record)) bump(summary.commands, record.command);
    if (record.event === 'verdict') addVerdict(summary.verdicts, record);
    if (record.event === 'auto-fix-round') {
      const round = String((record.detail || {}).round || 'unknown');
      summary.auto_fix.rounds += 1;
      bump(summary.auto_fix.rounds_by_number, round);
    }
    if (record.event === 'auto-fix-applied') {
      if ((record.detail || {}).success) {
        summary.auto_fix.worker_success += 1;
      } else {
        summary.auto_fix.worker_failed += 1;
        bump(summary.auto_fix.worker_failures, (record.detail || {}).reason || 'unknown');
      }
    }
    if (record.event === 'fleet-shard-complete') {
      summary.fleet.shards_completed += 1;
    }
    if (record.event === 'finding-overturned') {
      const detail = record.detail || {};
      const reviewer = String(detail.overturned_reviewer || 'unknown').toLowerCase();
      const classTag = String(detail.finding_class || 'unknown').toLowerCase();
      const key = `${reviewer}|${classTag}`;
      if (!summary.false_positives.by_reviewer_class[key]) {
        summary.false_positives.by_reviewer_class[key] = {
          reviewer,
          class: classTag,
          count: 0,
          representative_finding: String(detail.finding || '').slice(0, 240),
        };
      }
      summary.false_positives.by_reviewer_class[key].count += 1;
      summary.false_positives.overturned_total += 1;
    }
  }

  summary.false_positives.flagged = Object.values(summary.false_positives.by_reviewer_class)
    .filter((item) => item.count >= FALSE_POSITIVE_THRESHOLD)
    .sort((a, b) => b.count - a.count || a.reviewer.localeCompare(b.reviewer));
  summary.commands = sortObject(summary.commands);
  summary.events_by_type = sortObject(summary.events_by_type);
  summary.projects = sortObject(summary.projects);
  return summary;
}

function collectMetrics(metricsRoot, cutoff) {
  const files = walk(metricsRoot, (file) => path.basename(file) === 'forgeflow-metrics.jsonl').sort();
  const records = [];
  for (const file of files) {
    for (const record of readJsonl(file)) {
      if (record && inWindow(record, cutoff)) records.push(record);
    }
  }
  const summary = summarizeMetrics(records);
  summary.files = files.length;
  return summary;
}

function sortObject(object) {
  return Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
}

function summarizePatternLog(patternsDir, cutoff, now = new Date()) {
  const file = path.join(patternsDir, '.learnings-log.jsonl');
  const records = readJsonl(file).filter((record) => record && record.ts);
  const latest = records.slice().sort((a, b) => String(a.ts).localeCompare(String(b.ts))).pop() || null;
  const periodRecords = records.filter((record) => inWindow(record, cutoff));
  const totals = periodRecords.reduce((acc, record) => {
    acc.projects_scanned += Number(record.projects_scanned || 0);
    acc.learnings_total += Number(record.learnings_total || 0);
    acc.updates_applied += Number(record.updates_applied || 0);
    acc.candidates += Number(record.candidates || 0);
    return acc;
  }, {
    projects_scanned: 0,
    learnings_total: 0,
    updates_applied: 0,
    candidates: 0,
  });
  const latestTs = latest ? latest.ts || '' : '';
  const daysSinceLatest = latestTs ? Math.floor((now.getTime() - Date.parse(latestTs)) / 86400000) : null;
  return {
    path: fs.existsSync(file) ? file : '',
    records: records.length,
    records_in_period: periodRecords.length,
    latest_ts: latestTs,
    days_since_latest: daysSinceLatest,
    status: latest ? (daysSinceLatest > 60 ? 'overdue' : 'current') : 'missing',
    totals,
  };
}

function contextSummary(root) {
  try {
    return adviseContext({ root: path.join(root, '.forgeflow'), record: true });
  } catch (err) {
    return {
      schema_version: '1',
      status: 'unavailable',
      error: err.message,
    };
  }
}

function projectTrendsSummary(root, projectDir, opts = {}) {
  try {
    return showProjectTrends({ root, projectDir, refresh: Boolean(opts.refresh) });
  } catch (err) {
    return {
      schema_version: '1',
      status: 'unavailable',
      error: err.message,
    };
  }
}

function latestInsightsReadiness(projectDir) {
  return readLatestInsightsReadiness(projectDir, path.dirname(path.dirname(projectDir)));
}

function driftSummary(noDrift, opts = {}) {
  if (noDrift) return { status: 'skipped', reason: '--no-drift' };
  try {
    return checkAgentDrift({ root: opts.root, threshold: opts.threshold || 70 });
  } catch (err) {
    return { status: 'unavailable', reason: err.message };
  }
}

function reportLogPath(patternsDir) {
  return path.join(patternsDir, '.report-log.jsonl');
}

function readReportHistory(patternsDir) {
  return readJsonl(reportLogPath(patternsDir)).filter((record) => record && record.schema_version === '1');
}

function trendVsPrior(history, current, period) {
  const prior = history.filter((record) => record.period === period).pop();
  if (!prior) {
    return {
      status: 'insufficient-history',
      invocation_delta: 0,
      flagged_reviewer_delta: 0,
      drifted_agent_delta: 0,
    };
  }
  return {
    status: 'compared',
    previous_ts: prior.ts || '',
    invocation_delta: current.total_invocations - Number(prior.total_invocations || 0),
    flagged_reviewer_delta: current.flagged_reviewers - Number(prior.flagged_reviewers || 0),
    drifted_agent_delta: current.drifted_agents - Number(prior.drifted_agents || 0),
  };
}

function writeReportLog(patternsDir, record) {
  fs.mkdirSync(patternsDir, { recursive: true });
  fs.appendFileSync(reportLogPath(patternsDir), `${JSON.stringify(record)}\n`);
}

function derivePriorities(report) {
  const priorities = [];
  for (const item of report.metrics.false_positives.flagged) {
    priorities.push(`Refine ${item.reviewer} for ${item.class} false positives (${item.count} overturns).`);
  }
  if (report.patterns.status === 'overdue' || report.patterns.status === 'missing') {
    priorities.push('Run /forgeflow-learnings to refresh pattern promotion signal.');
  }
  if (report.drift.status === 'fail' && Number(report.drift.drifted_agents || 0) > 0) {
    priorities.push(`Resync ${report.drift.drifted_agents} agent prompt(s) with canonical shared intelligence.`);
  }
  if (report.project_trends.freshness && report.project_trends.freshness.status !== 'current') {
    priorities.push('Refresh project code map and project learnings before relying on project trend guidance.');
  }
  if (report.latest_insights.status && !['injected', 'missing'].includes(report.latest_insights.status)) {
    priorities.push('Run /forgeflow-learnings --project --check to restore latest-insights injection.');
  }
  if (report.latest_insights.freshness && report.latest_insights.freshness.status === 'attention') {
    priorities.push('Refresh latest insights because the last injection report is stale for the current checkout.');
  }
  if (report.context.recommendations && report.context.recommendations.length > 0) {
    priorities.push(...report.context.recommendations.slice(0, 2).map((item) => item.command || item.reason));
  }
  return priorities.slice(0, 5);
}

function reportRecommendations(report) {
  const recommendations = [];
  const seen = new Set();
  function add(item) {
    if (!item || !item.command || seen.has(item.command)) return;
    seen.add(item.command);
    recommendations.push(item);
  }

  for (const item of report.project_trends.recommendations || []) add(item);
  const freshness = report.latest_insights.freshness || null;
  if (freshness && freshness.issues && freshness.issues.length > 0) {
    add({
      severity: 'attention',
      action: 'refresh-project-trends',
      command: 'forgeflow-trends --refresh',
      reason: 'Project guidance artifacts are stale or missing for the current checkout.',
    });
  }
  if (['blocked', 'error', 'invalid'].includes(report.latest_insights.status)) {
    add({
      severity: 'attention',
      action: 'inspect-learning-gate',
      command: 'forgeflow-learnings --project --check',
      reason: 'Latest insights are not ready for agent context.',
    });
  }
  return recommendations;
}

function buildReport(opts = {}) {
  const root = opts.root || process.cwd();
  const now = opts.now || new Date();
  const period = opts.period || 'month';
  const cutoff = opts.cutoff || cutoffForPeriod(period, now);
  const metricsRoot = opts.metricsRoot || defaultMetricsRoot();
  const patternsDir = opts.patternsDir || defaultPatternsDir(root);
  const history = readReportHistory(patternsDir);
  const metrics = collectMetrics(metricsRoot, cutoff);
  const patterns = summarizePatternLog(patternsDir, cutoff, now);
  const context = contextSummary(root);
  const projectTrends = projectTrendsSummary(root, opts.projectDir || path.join(root, '.forgeflow', path.basename(root)), {
    refresh: Boolean(opts.refresh),
  });
  const projectDir = opts.projectDir || path.join(root, '.forgeflow', path.basename(root));
  const latestInsights = latestInsightsReadiness(projectDir);
  const drift = driftSummary(Boolean(opts.noDrift), { root });
  const logRecord = {
    schema_version: '1',
    ts: now.toISOString(),
    period,
    total_invocations: Object.values(metrics.commands).reduce((sum, count) => sum + count, 0),
    flagged_reviewers: metrics.false_positives.flagged.length,
    drifted_agents: Number(drift.drifted_agents || 0),
  };
  const report = {
    schema_version: '1',
    generated_at: now.toISOString(),
    period,
    cutoff,
    metrics_root: metricsRoot,
    patterns_dir: patternsDir,
    metrics,
    patterns,
    context,
    project_trends: projectTrends,
    latest_insights: latestInsights,
    drift,
    report_history: {
      path: reportLogPath(patternsDir),
      previous_runs: history.length,
      recorded: false,
      trend: trendVsPrior(history, logRecord, period),
    },
    recommendations: [],
    priorities: [],
  };
  report.recommendations = reportRecommendations(report);
  report.priorities = derivePriorities(report);
  if (opts.record !== false) {
    writeReportLog(patternsDir, logRecord);
    report.report_history.recorded = true;
  }
  return report;
}

function plural(value, singular, pluralValue = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralValue}`;
}

function renderMarkdown(report) {
  const commandRows = Object.entries(report.metrics.commands);
  const verdictRows = Object.entries(report.metrics.verdicts);
  const flagged = report.metrics.false_positives.flagged;
  const projectTrends = report.project_trends || {};
  const codeMap = projectTrends.code_map || {};
  const trend = codeMap.trend || {};
  const freshness = projectTrends.freshness || {};
  const advisor = projectTrends.advisor || {};
  const latestInsights = report.latest_insights || {};
  const context = report.context || {};
  const lines = [
    `# Forgeflow Report (${report.period})`,
    '',
    `Generated: ${report.generated_at}`,
    `Cutoff: ${report.cutoff}`,
    `Metrics files: ${report.metrics.files}`,
    '',
    '## 1. Activity',
    '',
  ];
  if (commandRows.length === 0) {
    lines.push('No Forgeflow telemetry found for this period.');
  } else {
    lines.push('| Command | Invocations |');
    lines.push('|---|---:|');
    for (const [command, count] of commandRows) lines.push(`| ${command} | ${count} |`);
  }

  lines.push('', '## 2. Verdicts', '');
  if (verdictRows.length === 0) {
    lines.push('No verdict telemetry found for this period.');
  } else {
    lines.push('| Reviewer | Verdict Counts |');
    lines.push('|---|---|');
    for (const [reviewer, counts] of verdictRows) {
      lines.push(`| ${reviewer} | ${Object.entries(counts).map(([name, count]) => `${name}: ${count}`).join(', ')} |`);
    }
  }

  lines.push('', '## 3. Auto-fix Effectiveness', '');
  lines.push(`- Rounds: ${report.metrics.auto_fix.rounds}`);
  lines.push(`- Worker success: ${report.metrics.auto_fix.worker_success}`);
  lines.push(`- Worker failed: ${report.metrics.auto_fix.worker_failed}`);

  lines.push('', '## 4. False Positives', '');
  if (flagged.length === 0) {
    lines.push(`No reviewer/class pair reached the ${FALSE_POSITIVE_THRESHOLD}-overturn threshold.`);
    if (report.metrics.false_positives.overturned_total === 0) {
      lines.push('No overturn data in period. Arbiter tags may not have accrued yet.');
    }
  } else {
    lines.push('| Reviewer | Class | Overturns | Representative Finding |');
    lines.push('|---|---|---:|---|');
    for (const item of flagged) {
      lines.push(`| ${item.reviewer} | ${item.class} | ${item.count} | ${item.representative_finding || '(none)'} |`);
    }
  }

  lines.push('', '## 5. Pattern Library', '');
  lines.push(`- Status: ${report.patterns.status}`);
  lines.push(`- Last run: ${report.patterns.latest_ts || '(none)'}`);
  lines.push(`- Updates applied in period: ${report.patterns.totals.updates_applied}`);
  lines.push(`- Candidates in period: ${report.patterns.totals.candidates}`);
  if (report.patterns.status === 'overdue') lines.push('- Run `/forgeflow-learnings` to refresh.');

  lines.push('', '## 6. Drift', '');
  lines.push(`- Status: ${report.drift.status}`);
  if (Number.isFinite(report.drift.drifted_agents)) lines.push(`- Drifted agents: ${report.drift.drifted_agents}`);
  if (Number.isFinite(report.drift.actionable)) lines.push(`- Actionable sections: ${report.drift.actionable}`);
  if (report.drift.reason) lines.push(`- Reason: ${report.drift.reason}`);

  lines.push('', '## 7. Context Savings', '');
  if (context.status === 'unavailable') {
    lines.push(`- Status: unavailable (${context.error})`);
  } else {
    lines.push(`- Telemetry files: ${context.summary.files}`);
    lines.push(`- Estimated saved tokens: ${context.summary.totals.estimated_saved_tokens}`);
    lines.push(`- Percent saved: ${context.summary.percent_saved}%`);
    lines.push(`- Budget: ${context.budget.status}`);
    lines.push(`- Advisor actions: ${context.recommendations.map((item) => item.action).join(', ') || '(none)'}`);
  }

  lines.push('', '## 8. Project Trends', '');
  if (projectTrends.status === 'unavailable') {
    lines.push(`- Status: unavailable (${projectTrends.error})`);
  } else {
    lines.push(`- Code-map trend: ${trend.status || 'missing'}`);
    lines.push(`- Freshness: ${freshness.status || 'missing'}`);
    lines.push(`- Unresolved imports delta: ${trend.unresolved_imports_delta ?? 0}`);
    lines.push(`- Changed sections delta: ${trend.changed_sections_delta ?? 0}`);
    lines.push(`- New high fan-in: ${(codeMap.new_high_fan_in || []).join(', ') || '(none)'}`);
    lines.push(`- New high fan-out: ${(codeMap.new_high_fan_out || []).join(', ') || '(none)'}`);
    lines.push(`- Project learnings consumed trend: ${projectTrends.project_learnings && projectTrends.project_learnings.consumed_code_map_trend ? 'yes' : 'no'}`);
    lines.push(`- Advisor budget: ${advisor.budget_status || 'missing'}`);
    lines.push(`- Latest insights: ${latestInsights.status || 'missing'}`);
    if (latestInsights.reason) lines.push(`- Latest insights reason: ${latestInsights.reason}`);
    if (latestInsights.check_status) lines.push(`- Latest insights quality gate: ${latestInsights.check_status}`);
    if (latestInsights.freshness) lines.push(`- Latest insights freshness: ${latestInsights.freshness.status}`);
  }

  lines.push('', '## 9. Priorities', '');
  if (report.recommendations.length > 0) {
    lines.push('### Recommendations', '');
    for (const item of report.recommendations) {
      lines.push(`- ${item.command}: ${item.reason}`);
    }
    lines.push('');
    lines.push('### Derived Priorities', '');
  }
  if (report.priorities.length === 0) {
    lines.push('- No immediate priorities derived from local report signals.');
  } else {
    report.priorities.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  }

  lines.push('', '## Signals', '');
  lines.push(`- Report log: ${report.report_history.recorded ? 'recorded' : 'not recorded'} (${plural(report.report_history.previous_runs, 'prior run')})`);
  lines.push(`- Trend vs prior report: ${report.report_history.trend.status}`);
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const report = buildReport(opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderMarkdown(report)}\n`);
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
  buildReport,
  collectMetrics,
  cutoffForPeriod,
  latestInsightsReadiness,
  latestInsightsFreshness,
  reportRecommendations,
  renderMarkdown,
  summarizeMetrics,
  summarizePatternLog,
  trendVsPrior,
};
