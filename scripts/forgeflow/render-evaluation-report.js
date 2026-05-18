#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  summarize,
  validateOutcome,
} = require('./record-review-outcome');

function usage() {
  console.error('Usage: render-evaluation-report.js --outcomes <jsonl> [--out <md>] [--json]');
}

function parseArgs(argv) {
  const opts = {
    outcomes: '',
    out: '',
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--outcomes') {
      opts.outcomes = path.resolve(argv[++i] || '');
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
      auto_fix_success_rate_pct: percent(totals.auto_fix_success, totals.auto_fix_success + totals.auto_fix_failed),
      regression_rate_pct: percent(totals.post_merge_regression, summary.records),
      average_review_minutes: summary.records ? round(totals.review_minutes / summary.records) : 0,
    },
    classes: summary.classes,
  };
  return evaluation;
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
      ['Post-merge regression rate', `${report.rates.regression_rate_pct}%`],
      ['Average review minutes', String(report.rates.average_review_minutes)],
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
  const report = buildEvaluation(records, rejected);
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
  buildEvaluation,
  readOutcomes,
  renderMarkdown,
  writeReport,
};
