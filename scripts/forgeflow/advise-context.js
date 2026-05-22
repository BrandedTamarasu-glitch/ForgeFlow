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
const { compareCodeMapTrend } = require('./show-code-map');
const { uniqueRecommendations } = require('./guidance-contract');
const { appendFileSafe, isPathInside, safeReadTextFile } = require('./file-safety');

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

function assertHistoryPath(historyPath, root) {
  if (!isPathInside(root, historyPath)) {
    throw new Error(`Refusing context advisor history outside root: ${historyPath}`);
  }
}

function readHistory(historyPath, root) {
  if (!historyPath || !fs.existsSync(historyPath)) return [];
  assertHistoryPath(historyPath, root);
  const records = [];
  for (const line of safeReadTextFile(historyPath, root).content.split(/\r?\n/)) {
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

function appendHistory(historyPath, root, record) {
  assertHistoryPath(historyPath, root);
  appendFileSafe(historyPath, `${JSON.stringify(record)}\n`);
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

function readCodeMapHistoryFile(file) {
  const records = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      if (record && record.schema_version === '1' && record.summary) records.push(record);
    } catch (_err) {
      // Ignore corrupt advisory history lines.
    }
  }
  return records;
}

function codeMapTrends(files) {
  const trends = {
    files: 0,
    compared: 0,
    unresolved_imports_delta: 0,
    changed_sections_delta: 0,
    new_high_fan_in: [],
    new_high_fan_out: [],
    status: 'missing',
  };

  for (const file of files) {
    if (path.basename(file) !== 'code-map-history.jsonl') continue;
    trends.files += 1;
    const records = readCodeMapHistoryFile(file);
    if (records.length < 2) continue;
    const trend = compareCodeMapTrend(records[records.length - 1], records.slice(0, -1));
    if (trend.status !== 'compared') continue;
    trends.compared += 1;
    trends.unresolved_imports_delta += Number(trend.unresolved_imports_delta || 0);
    trends.changed_sections_delta += Number(trend.changed_sections_delta || 0);
    trends.new_high_fan_in.push(...(trend.new_high_fan_in || []));
    trends.new_high_fan_out.push(...(trend.new_high_fan_out || []));
  }

  trends.new_high_fan_in = [...new Set(trends.new_high_fan_in)].slice(0, 10);
  trends.new_high_fan_out = [...new Set(trends.new_high_fan_out)].slice(0, 10);
  if (trends.files > 0) {
    trends.status = trends.compared > 0
      ? (trends.unresolved_imports_delta > 0 || trends.changed_sections_delta > 0 || trends.new_high_fan_in.length > 0 || trends.new_high_fan_out.length > 0 ? 'attention' : 'stable')
      : 'insufficient-history';
  }
  return trends;
}

function walkCodeMapHistory(dir, files = []) {
  if (!dir || !fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkCodeMapHistory(file, files);
    } else if (entry.isFile() && entry.name === 'code-map-history.jsonl') {
      files.push(file);
    }
  }
  return files;
}

function telemetryPreference(file, telemetry) {
  const normalized = file.split(path.sep);
  const contextIndex = normalized.lastIndexOf('context');
  const inLatest = contextIndex >= 0 && normalized[contextIndex + 1] === 'latest';
  const generatedAt = Date.parse(telemetry.generated_at || telemetry.ts || '') || 0;
  return {
    file,
    inLatest,
    generatedAt,
  };
}

function telemetryKey(file, telemetry) {
  const normalized = file.split(path.sep);
  const contextIndex = normalized.lastIndexOf('context');
  const kind = telemetry.kind || 'unknown';
  if (contextIndex >= 0) {
    const projectRoot = normalized.slice(0, contextIndex).join(path.sep);
    return `${projectRoot}${path.sep}context${path.sep}${kind}${path.sep}${path.basename(file)}`;
  }
  return `${path.dirname(file)}${path.sep}${kind}${path.sep}${path.basename(file)}`;
}

function preferTelemetry(a, b) {
  if (a.inLatest !== b.inLatest) return b.inLatest ? b : a;
  if (a.generatedAt !== b.generatedAt) return b.generatedAt > a.generatedAt ? b : a;
  return b.file.localeCompare(a.file) < 0 ? b : a;
}

function selectTelemetryFiles(files) {
  const selected = new Map();
  const corrupt = [];

  for (const file of files) {
    let telemetry = null;
    try {
      telemetry = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (_err) {
      corrupt.push(file);
      continue;
    }
    if (!telemetry || telemetry.schema_version !== '1') {
      corrupt.push(file);
      continue;
    }

    const key = telemetryKey(file, telemetry);
    const candidate = telemetryPreference(file, telemetry);
    const current = selected.get(key);
    selected.set(key, current ? preferTelemetry(current, candidate) : candidate);
  }

  return [
    ...Array.from(selected.values()).map((item) => item.file),
    ...corrupt,
  ].sort();
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
    return uniqueRecommendations(recommendations);
  }

  for (const violation of budget.violations) {
    const splitSuggestion = {
      strategy: 'split-before-review',
      first_slice: 'Run a narrower context pack for the highest-risk changed files only.',
      second_slice: 'Run a follow-up packet for remaining docs, tests, or lower-risk files after the first review is resolved.',
      command: 'Rebuild context with a smaller --files list or lower --lines value before spawning agents.',
    };
    recommendations.push({
      severity: budget.status === 'fail' ? 'high' : 'warn',
      action: 'trim-budget-violation',
      kind: violation.kind,
      file: violation.file,
      reason: `${violation.kind} is ${violation.over_by} estimated compact tokens over budget.`,
      command: splitSuggestion.command,
      split_suggestion: splitSuggestion,
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

  return uniqueRecommendations(recommendations);
}

function adviseContext(opts = {}) {
  const root = opts.root || defaultRoot();
  const walkedFiles = opts.files || walk(root);
  const files = opts.dedupeTelemetry === false ? walkedFiles : selectTelemetryFiles(walkedFiles);
  const config = loadConfig(opts);
  const summary = summarize(files);
  const budget = checkBudget(files, config);
  const codeTopology = topologyCoverage(files);
  const codeMapTrend = codeMapTrends(opts.codeMapHistoryFiles || walkCodeMapHistory(root));
  const result = {
    schema_version: '1',
    root,
    files: files.slice().sort(),
    summary,
    budget,
    code_topology: codeTopology,
    code_map_trends: codeMapTrend,
    recommendations: recommend(summary, budget),
  };
  if (codeMapTrend.unresolved_imports_delta > 0) {
    result.recommendations.push({
      severity: 'warn',
      action: 'review-code-map-unresolved-growth',
      reason: `Code-map history shows ${codeMapTrend.unresolved_imports_delta} new unresolved import(s).`,
      command: 'Run /forgeflow-code-map and inspect unresolved imports before relying on topology guidance.',
    });
  }
  if (codeMapTrend.new_high_fan_in.length > 0 || codeMapTrend.new_high_fan_out.length > 0) {
    result.recommendations.push({
      severity: 'info',
      action: 'review-code-map-new-hotspots',
      reason: 'Code-map history shows new fan-in/fan-out hotspots.',
      command: 'Use the code-map Trends section to prioritize review and planning reads.',
    });
  }
  const historyPath = opts.history || defaultHistoryPath(root);
  const history = readHistory(historyPath, root);
  const record = historyRecord(result, opts.now || new Date());
  result.history = {
    path: historyPath,
    recorded: false,
    previous_runs: history.length,
    current: record,
    trend: compareTrend(record, history[history.length - 1]),
  };
  if (opts.record) {
    appendHistory(historyPath, root, record);
    result.history.recorded = true;
  }
  result.recommendations = uniqueRecommendations(result.recommendations);
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
    `Code map trends: ${result.code_map_trends.status}`,
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
      if (item.split_suggestion) {
        lines.push(`  Split: ${item.split_suggestion.first_slice} Then ${item.split_suggestion.second_slice}`);
      }
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

  if (result.code_map_trends.status !== 'missing') {
    lines.push('', '## Code Map Trends', '');
    lines.push(`- History files: ${result.code_map_trends.files}`);
    lines.push(`- Compared histories: ${result.code_map_trends.compared}`);
    lines.push(`- Unresolved imports delta: ${result.code_map_trends.unresolved_imports_delta}`);
    lines.push(`- Changed sections delta: ${result.code_map_trends.changed_sections_delta}`);
    lines.push(`- New high fan-in: ${result.code_map_trends.new_high_fan_in.length > 0 ? result.code_map_trends.new_high_fan_in.join(', ') : '(none)'}`);
    lines.push(`- New high fan-out: ${result.code_map_trends.new_high_fan_out.length > 0 ? result.code_map_trends.new_high_fan_out.join(', ') : '(none)'}`);
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
  codeMapTrends,
  selectTelemetryFiles,
  walkCodeMapHistory,
  recommend,
  renderMarkdown,
  topologyCoverage,
};
