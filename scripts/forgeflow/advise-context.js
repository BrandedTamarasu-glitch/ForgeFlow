#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const {
  summarize,
  walk,
} = require('./summarize-context-telemetry');
const {
  applyConfig,
  checkBudget,
  defaultConfigPath,
  readConfig,
} = require('./check-context-budget');

function usage() {
  console.error([
    'Usage: advise-context.js [--root <dir>] [--config <json>] [--json] [--record]',
    '       [--history <jsonl>] [--max-compact-tokens <n>] [--max-kind <kind=n>]',
  ].join('\n'));
}

function parseArgs(argv) {
  const opts = {
    root: '',
    config: '',
    maxCompactTokens: 16000,
    maxCompactTokensSet: false,
    kindLimits: {},
    warnOnly: true,
    warnOnlySet: true,
    history: '',
    record: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(argv[++i] || '');
    } else if (arg === '--config') {
      opts.config = path.resolve(argv[++i] || '');
    } else if (arg === '--max-compact-tokens') {
      opts.maxCompactTokens = Number.parseInt(argv[++i] || '16000', 10);
      opts.maxCompactTokensSet = true;
    } else if (arg === '--max-kind') {
      const [kind, rawLimit] = String(argv[++i] || '').split('=');
      const limit = Number.parseInt(rawLimit || '', 10);
      if (!kind || !Number.isFinite(limit)) {
        console.error('Invalid --max-kind. Expected kind=n');
        process.exit(2);
      }
      opts.kindLimits[kind] = limit;
    } else if (arg === '--history') {
      opts.history = path.resolve(argv[++i] || '');
    } else if (arg === '--record') {
      opts.record = true;
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

function defaultRoot(cwd = process.cwd()) {
  return path.join(cwd, '.forgeflow');
}

function loadConfig(opts, cwd = process.cwd()) {
  const configPath = opts.config || defaultConfigPath(cwd);
  const exists = fs.existsSync(configPath);
  const config = exists ? readConfig(configPath) : {};
  const applied = applyConfig(opts, config);
  applied.configPath = exists ? configPath : '';
  return applied;
}

function defaultHistoryPath(root) {
  return path.join(root, 'context-advisor-history.jsonl');
}

function readHistory(historyPath) {
  if (!historyPath || !fs.existsSync(historyPath)) return [];
  const records = [];
  for (const line of fs.readFileSync(historyPath, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      if (record && record.schema_version === '1') records.push(record);
    } catch (_err) {
      // Ignore corrupt history lines; this file is advisory telemetry.
    }
  }
  return records;
}

function historyRecord(result, now = new Date()) {
  return {
    schema_version: '1',
    ts: now.toISOString(),
    root: result.root,
    files: result.summary.files,
    estimated_compact_tokens: result.summary.totals.estimated_compact_tokens,
    estimated_saved_tokens: result.summary.totals.estimated_saved_tokens,
    percent_saved: result.summary.percent_saved,
    budget_status: result.budget.status,
    budget_violations: result.budget.violations.length,
    recommendation_actions: result.recommendations.map((item) => item.action),
  };
}

function compareTrend(current, previous) {
  if (!previous) {
    return {
      status: 'insufficient-history',
      previous_ts: '',
      compact_token_delta: 0,
      saved_token_delta: 0,
      percent_saved_delta: 0,
      budget_violation_delta: 0,
    };
  }

  return {
    status: 'compared',
    previous_ts: previous.ts || '',
    compact_token_delta: current.estimated_compact_tokens - Number(previous.estimated_compact_tokens || 0),
    saved_token_delta: current.estimated_saved_tokens - Number(previous.estimated_saved_tokens || 0),
    percent_saved_delta: Number((current.percent_saved - Number(previous.percent_saved || 0)).toFixed(2)),
    budget_violation_delta: current.budget_violations - Number(previous.budget_violations || 0),
  };
}

function appendHistory(historyPath, record) {
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  fs.appendFileSync(historyPath, `${JSON.stringify(record)}\n`);
}

function topologyCoverage(files) {
  const coverage = {
    files: 0,
    source_files: 0,
    local_edges: 0,
    unresolved_imports: 0,
    skipped_dynamic_imports: 0,
    status: 'missing',
  };

  for (const file of files) {
    if (path.basename(file) !== 'code-topology-telemetry.json') continue;
    try {
      const telemetry = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!telemetry || telemetry.schema_version !== '1' || telemetry.kind !== 'code-topology') continue;
      const detail = telemetry.detail || {};
      coverage.files += 1;
      coverage.source_files += Number(detail.source_files || 0);
      coverage.local_edges += Number(detail.local_edges || 0);
      coverage.unresolved_imports += Number(detail.unresolved_imports || 0);
      coverage.skipped_dynamic_imports += Number(detail.skipped_dynamic_imports || 0);
    } catch (_err) {
      // Ignore corrupt advisory telemetry; summarize-context-telemetry tracks skipped files separately.
    }
  }

  if (coverage.files > 0) {
    coverage.status = coverage.unresolved_imports > 0 || coverage.skipped_dynamic_imports > 0
      ? 'attention'
      : 'covered';
  }
  return coverage;
}

function recommend(summary, budget) {
  const recommendations = [];

  if (summary.files === 0) {
    recommendations.push({
      severity: 'info',
      action: 'generate-context-telemetry',
      reason: 'No context telemetry artifacts were found.',
      command: 'Run the relevant Forgeflow command so context pack, memory context, or scope telemetry can be recorded.',
    });
    return recommendations;
  }

  for (const violation of budget.violations) {
    recommendations.push({
      severity: budget.status === 'fail' ? 'high' : 'warn',
      action: 'trim-budget-violation',
      kind: violation.kind,
      file: violation.file,
      reason: `${violation.kind} is ${violation.over_by} estimated compact tokens over budget.`,
      command: 'Narrow file scope, lower line limits, or split the task before spawning agents.',
    });
  }

  for (const [kind, bucket] of Object.entries(summary.by_kind)) {
    if (bucket.files > 0 && bucket.percent_saved < 20 && bucket.estimated_compact_tokens >= 2000) {
      recommendations.push({
        severity: 'warn',
        action: 'improve-compaction',
        kind,
        reason: `${kind} saved only ${bucket.percent_saved}% versus baseline.`,
        command: 'Prefer scope packets and compact memory before full artifact reads; remove repeated low-signal sections from generated packets.',
      });
    }
  }

  if (summary.totals.estimated_compact_tokens > 0 && summary.percent_saved >= 50 && budget.violations.length === 0) {
    recommendations.push({
      severity: 'info',
      action: 'context-healthy',
      reason: `Context telemetry shows ${summary.percent_saved}% estimated savings with no budget violations.`,
      command: 'Use the generated agent packets as the primary context source.',
    });
  }

  return recommendations;
}

function adviseContext(opts = {}) {
  const root = opts.root || defaultRoot();
  const files = opts.files || walk(root);
  const config = loadConfig(opts);
  const summary = summarize(files);
  const budget = checkBudget(files, config);
  const codeTopology = topologyCoverage(files);
  const result = {
    schema_version: '1',
    root,
    files: files.slice().sort(),
    summary,
    budget,
    code_topology: codeTopology,
    recommendations: recommend(summary, budget),
  };
  const historyPath = opts.history || defaultHistoryPath(root);
  const history = readHistory(historyPath);
  const record = historyRecord(result, opts.now || new Date());
  result.history = {
    path: historyPath,
    recorded: false,
    previous_runs: history.length,
    current: record,
    trend: compareTrend(record, history[history.length - 1]),
  };
  if (opts.record) {
    appendHistory(historyPath, record);
    result.history.recorded = true;
  }
  return result;
}

function renderMarkdown(result) {
  const lines = [
    `# Forgeflow Context Advisor: ${result.budget.status.toUpperCase()}`,
    '',
    `Telemetry files: ${result.summary.files}`,
    `Estimated compact tokens: ${result.summary.totals.estimated_compact_tokens}`,
    `Estimated saved tokens: ${result.summary.totals.estimated_saved_tokens}`,
    `Percent saved: ${result.summary.percent_saved}%`,
    `Budget violations: ${result.budget.violations.length}`,
    `Code topology: ${result.code_topology.status}`,
    `Trend: ${result.history.trend.status}`,
    '',
    '## Recommendations',
    '',
  ];

  if (result.recommendations.length === 0) {
    lines.push('- No recommendations.');
  } else {
    for (const item of result.recommendations) {
      lines.push(`- ${item.severity.toUpperCase()}: ${item.reason}`);
      lines.push(`  Action: ${item.command}`);
    }
  }

  if (result.history.trend.status === 'compared') {
    lines.push('', '## Trend', '');
    lines.push(`- Compact token delta: ${result.history.trend.compact_token_delta}`);
    lines.push(`- Saved token delta: ${result.history.trend.saved_token_delta}`);
    lines.push(`- Percent saved delta: ${result.history.trend.percent_saved_delta}`);
    lines.push(`- Budget violation delta: ${result.history.trend.budget_violation_delta}`);
  }

  if (result.code_topology.status !== 'missing') {
    lines.push('', '## Code Topology', '');
    lines.push(`- Runs: ${result.code_topology.files}`);
    lines.push(`- Source files: ${result.code_topology.source_files}`);
    lines.push(`- Local edges: ${result.code_topology.local_edges}`);
    lines.push(`- Unresolved imports: ${result.code_topology.unresolved_imports}`);
    lines.push(`- Skipped dynamic imports: ${result.code_topology.skipped_dynamic_imports}`);
  }

  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = adviseContext(opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log(renderMarkdown(result));
  }
  if (result.budget.status === 'fail') process.exit(1);
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
  adviseContext,
  compareTrend,
  historyRecord,
  recommend,
  renderMarkdown,
  topologyCoverage,
};
