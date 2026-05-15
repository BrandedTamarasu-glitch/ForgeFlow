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
    'Usage: advise-context.js [--root <dir>] [--config <json>] [--json]',
    '       [--max-compact-tokens <n>] [--max-kind <kind=n>]',
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
    if (bucket.files > 0 && bucket.percent_saved < 20) {
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
  return {
    schema_version: '1',
    root,
    files: files.slice().sort(),
    summary,
    budget,
    recommendations: recommend(summary, budget),
  };
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
  recommend,
  renderMarkdown,
};
