#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  summarize,
  validateOutcome,
} = require('./record-review-outcome');
const {
  applyConfig,
  checkBudget,
  defaultConfigPath,
  readConfig,
} = require('./check-context-budget');
const {
  summarize: summarizeContext,
  walk: walkContext,
} = require('./summarize-context-telemetry');

function usage() {
  console.error([
    'Usage: render-evaluation-report.js --outcomes <jsonl> [--out <md>] [--json]',
    '       [--context-root <dir>] [--context-file <json>] [--budget-config <json>]',
  ].join('\n'));
}

function parseArgs(argv) {
  const opts = {
    outcomes: '',
    contextRoot: '',
    contextFiles: [],
    budgetConfig: '',
    out: '',
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--outcomes') {
      opts.outcomes = path.resolve(argv[++i] || '');
    } else if (arg === '--context-root') {
      opts.contextRoot = path.resolve(argv[++i] || '');
    } else if (arg === '--context-file') {
      opts.contextFiles.push(path.resolve(argv[++i] || ''));
    } else if (arg === '--budget-config') {
      opts.budgetConfig = path.resolve(argv[++i] || '');
    } else if (arg === '--out') {
      opts.out = path.resolve(argv[++i] || '');
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

function readOutcomes(filePath) {
  if (!filePath) {
    throw new Error('--outcomes is required');
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`Outcomes file not found: ${filePath}`);
  }

  const records = [];
  const rejected = [];
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const record = JSON.parse(trimmed);
      const errors = validateOutcome(record);
      if (errors.length > 0) {
        rejected.push({ line: index + 1, errors });
      } else {
        records.push(record);
      }
    } catch (err) {
      rejected.push({ line: index + 1, errors: [err.message] });
    }
  });
  return { records, rejected };
}

function percent(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function round(value) {
  return Number(value.toFixed(2));
}

function buildEvaluation(records, rejected = []) {
  const summary = summarize(records);
  const totals = summary.totals;
  const evaluatedFindings = totals.findings_confirmed + totals.findings_rejected;
  const verifierTotal = totals.verifier_confirmed + totals.verifier_rejected + totals.verifier_blocked;
  const reviewHours = totals.review_minutes / 60;
  const autoFixTotal = totals.auto_fix_success + totals.auto_fix_failed;
  const evaluation = {
    schema_version: '1',
    generated_at: new Date().toISOString(),
    records: summary.records,
    rejected_records: rejected.length,
    modes: summary.modes,
    agents: summary.agents,
    totals,
    rates: {
      confirmation_rate_pct: percent(totals.findings_confirmed, evaluatedFindings),
      false_positive_rate_pct: percent(totals.findings_rejected, evaluatedFindings),
      verifier_rejection_rate_pct: percent(totals.verifier_rejected, verifierTotal),
      auto_fix_success_rate_pct: percent(totals.auto_fix_success, autoFixTotal),
      auto_fix_failure_rate_pct: percent(totals.auto_fix_failed, autoFixTotal),
      regression_rate_pct: percent(totals.post_merge_regression, summary.records),
      average_review_minutes: summary.records ? round(totals.review_minutes / summary.records) : 0,
      findings_per_review: summary.records ? round(totals.findings_total / summary.records) : 0,
      confirmed_findings_per_review: summary.records ? round(totals.findings_confirmed / summary.records) : 0,
      rejected_findings_per_review: summary.records ? round(totals.findings_rejected / summary.records) : 0,
      confirmed_findings_per_hour: reviewHours ? round(totals.findings_confirmed / reviewHours) : 0,
      rejected_findings_per_hour: reviewHours ? round(totals.findings_rejected / reviewHours) : 0,
    },
    classes: summary.classes,
    workflows: workflowComparisons(records),
  };
  return evaluation;
}

function buildContextEvaluation(files, budgetConfigPath = '') {
  if (!files || files.length === 0) {
    return {
      files: 0,
      skipped: 0,
      percent_saved: 0,
      estimated_baseline_tokens: 0,
      estimated_compact_tokens: 0,
      estimated_saved_tokens: 0,
      budget_status: 'not-run',
      budget_violations: 0,
      budget_over_by_tokens: 0,
      by_kind: {},
    };
  }

  const summary = summarizeContext(files);
  const configPath = budgetConfigPath || defaultConfigPath();
  const budgetOpts = applyConfig({
    files,
    maxCompactTokens: 16000,
    maxCompactTokensSet: false,
    kindLimits: {},
    warnOnly: true,
    warnOnlySet: true,
  }, readConfig(configPath));
  budgetOpts.configPath = fs.existsSync(configPath) ? configPath : '';
  const budget = checkBudget(files, budgetOpts);
  return {
    files: summary.files,
    skipped: summary.skipped,
    percent_saved: summary.percent_saved,
    estimated_baseline_tokens: summary.totals.estimated_baseline_tokens,
    estimated_compact_tokens: summary.totals.estimated_compact_tokens,
    estimated_saved_tokens: summary.totals.estimated_saved_tokens,
    budget_status: budget.status,
    budget_violations: budget.violations.length,
    budget_over_by_tokens: budget.violations.reduce((sum, item) => sum + item.over_by, 0),
    by_kind: summary.by_kind,
  };
}

function attachContextEvaluation(report, context) {
  return {
    ...report,
    context,
  };
}

function workflowFor(record) {
  const value = String(record?.review?.workflow || '').trim().toLowerCase();
  if (['no-agent', 'single-agent', 'forgeflow'].includes(value)) return value;
  return 'forgeflow';
}

function workflowComparisons(records) {
  const groups = {};
  for (const record of records) {
    const workflow = workflowFor(record);
    if (!groups[workflow]) groups[workflow] = [];
    groups[workflow].push(record);
  }

  return Object.fromEntries(Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([workflow, items]) => {
      const summary = summarize(items);
      const totals = summary.totals;
      const evaluatedFindings = totals.findings_confirmed + totals.findings_rejected;
      return [workflow, {
        records: summary.records,
        findings_total: totals.findings_total,
        findings_confirmed: totals.findings_confirmed,
        findings_rejected: totals.findings_rejected,
        confirmation_rate_pct: percent(totals.findings_confirmed, evaluatedFindings),
        false_positive_rate_pct: percent(totals.findings_rejected, evaluatedFindings),
        average_review_minutes: summary.records ? round(totals.review_minutes / summary.records) : 0,
        post_merge_regression: totals.post_merge_regression,
      }];
    }));
}

function renderTable(rows) {
  if (rows.length === 0) return 'No rows.';
  return rows.map((row) => `| ${row.join(' | ')} |`).join(os.EOL);
}

function renderMarkdown(report) {
  const lines = [
    '# Forgeflow Evaluation Report',
    '',
    `Generated: ${report.generated_at}`,
    `Records: ${report.records}`,
    `Rejected records: ${report.rejected_records}`,
    '',
    '## Quality',
    '',
    renderTable([
      ['Metric', 'Value'],
      ['---', '---:'],
      ['Confirmed findings', String(report.totals.findings_confirmed)],
      ['Rejected findings', String(report.totals.findings_rejected)],
      ['Confirmation rate', `${report.rates.confirmation_rate_pct}%`],
      ['False positive rate', `${report.rates.false_positive_rate_pct}%`],
      ['Verifier rejection rate', `${report.rates.verifier_rejection_rate_pct}%`],
      ['Auto-fix success rate', `${report.rates.auto_fix_success_rate_pct}%`],
      ['Auto-fix failure rate', `${report.rates.auto_fix_failure_rate_pct}%`],
      ['Post-merge regression rate', `${report.rates.regression_rate_pct}%`],
      ['Average review minutes', String(report.rates.average_review_minutes)],
    ]),
    '',
    '## Efficiency',
    '',
    renderTable([
      ['Metric', 'Value'],
      ['---', '---:'],
      ['Findings per review', String(report.rates.findings_per_review)],
      ['Confirmed findings per review', String(report.rates.confirmed_findings_per_review)],
      ['Rejected findings per review', String(report.rates.rejected_findings_per_review)],
      ['Confirmed findings per hour', String(report.rates.confirmed_findings_per_hour)],
      ['Rejected findings per hour', String(report.rates.rejected_findings_per_hour)],
    ]),
    '',
    '## Context Efficiency',
    '',
    renderTable([
      ['Metric', 'Value'],
      ['---', '---:'],
      ['Telemetry files', String(report.context?.files || 0)],
      ['Estimated baseline tokens', String(report.context?.estimated_baseline_tokens || 0)],
      ['Estimated compact tokens', String(report.context?.estimated_compact_tokens || 0)],
      ['Estimated saved tokens', String(report.context?.estimated_saved_tokens || 0)],
      ['Percent saved', `${report.context?.percent_saved || 0}%`],
      ['Budget status', report.context?.budget_status || 'not-run'],
      ['Budget violations', String(report.context?.budget_violations || 0)],
      ['Budget over by tokens', String(report.context?.budget_over_by_tokens || 0)],
    ]),
    '',
    '## Modes',
    '',
    renderTable([
      ['Mode', 'Reviews'],
      ['---', '---:'],
      ...Object.entries(report.modes).map(([mode, count]) => [mode, String(count)]),
    ]),
    '',
    '## Workflow Comparison',
    '',
    renderTable([
      ['Workflow', 'Reviews', 'Confirmed', 'Rejected', 'Confirmation', 'False Positives', 'Avg Minutes', 'Regressions'],
      ['---', '---:', '---:', '---:', '---:', '---:', '---:', '---:'],
      ...Object.entries(report.workflows).map(([workflow, item]) => [
        workflow,
        String(item.records),
        String(item.findings_confirmed),
        String(item.findings_rejected),
        `${item.confirmation_rate_pct}%`,
        `${item.false_positive_rate_pct}%`,
        String(item.average_review_minutes),
        String(item.post_merge_regression),
      ]),
    ]),
    '',
    '## Finding Classes',
    '',
    renderTable([
      ['Class', 'Total', 'Confirmed', 'Rejected'],
      ['---', '---:', '---:', '---:'],
      ...Object.entries(report.classes).map(([name, item]) => [
        name,
        String(item.findings_total),
        String(item.findings_confirmed),
        String(item.findings_rejected),
      ]),
    ]),
  ];
  return `${lines.join(os.EOL)}${os.EOL}`;
}

function writeReport(report, outPath, json = false) {
  const output = json ? `${JSON.stringify(report, null, 2)}\n` : renderMarkdown(report);
  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, output);
  }
  return output;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { records, rejected } = readOutcomes(opts.outcomes);
  const contextFiles = opts.contextFiles.length > 0
    ? opts.contextFiles
    : (opts.contextRoot ? walkContext(opts.contextRoot) : []);
  const context = buildContextEvaluation(contextFiles, opts.budgetConfig);
  const report = attachContextEvaluation(buildEvaluation(records, rejected), context);
  const output = writeReport(report, opts.out, opts.json);
  if (opts.json || !opts.out) process.stdout.write(output);
  else console.log(`Evaluation report written to ${opts.out}`);
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
  attachContextEvaluation,
  buildEvaluation,
  buildContextEvaluation,
  readOutcomes,
  renderMarkdown,
  workflowComparisons,
  writeReport,
};
