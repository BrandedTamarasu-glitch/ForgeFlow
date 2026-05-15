#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const args = process.argv.slice(2);

function parseArgs(argv) {
  const opts = {
    metricsFile: '',
    metricsRoot: '',
    reviewHistory: '',
    out: '',
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--metrics-file') {
      opts.metricsFile = argv[++i] || '';
    } else if (arg === '--metrics-root') {
      opts.metricsRoot = argv[++i] || '';
    } else if (arg === '--review-history') {
      opts.reviewHistory = argv[++i] || '';
    } else if (arg === '--out') {
      opts.out = argv[++i] || '';
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

function usage() {
  console.error('Usage: summarize-calibration.js [--metrics-file <jsonl>] [--metrics-root <dir>] [--review-history <path>] [--out <path>] [--json]');
}

function createSummary() {
  return {
    schema_version: '1',
    generated_at: new Date().toISOString(),
    source_files: [],
    agents: {},
    classes: {},
    totals: {
      finding_overturned: 0,
      finding_verified: 0,
      verifier_confirmed: 0,
      verifier_rejected: 0,
      verifier_blocked: 0,
      auto_fix_applied: 0,
      auto_fix_failed: 0,
    },
  };
}

function normalize(value) {
  return String(value || 'unknown').trim().toLowerCase().replace(/\s+/g, '-');
}

function bucketFor(map, key) {
  if (!map[key]) {
    map[key] = {
      overturned: 0,
      verified: 0,
      confirmed: 0,
      rejected: 0,
      blocked: 0,
      auto_fix_applied: 0,
      auto_fix_failed: 0,
    };
  }
  return map[key];
}

function applyRecord(summary, record) {
  if (!record || record.schema_version && record.schema_version !== '1') {
    return;
  }

  const detail = record.detail || {};

  if (record.event === 'finding-overturned') {
    const agent = normalize(detail.overturned_reviewer);
    const findingClass = normalize(detail.finding_class);
    bucketFor(summary.agents, agent).overturned++;
    bucketFor(summary.classes, findingClass).overturned++;
    summary.totals.finding_overturned++;
  } else if (record.event === 'finding-verified') {
    const agent = normalize(detail.reviewer);
    const findingClass = normalize(detail.finding_class);
    const decision = normalize(detail.decision);
    const agentBucket = bucketFor(summary.agents, agent);
    const classBucket = bucketFor(summary.classes, findingClass);
    agentBucket.verified++;
    classBucket.verified++;
    summary.totals.finding_verified++;

    if (decision === 'confirmed') {
      agentBucket.confirmed++;
      classBucket.confirmed++;
      summary.totals.verifier_confirmed++;
    } else if (decision === 'rejected') {
      agentBucket.rejected++;
      classBucket.rejected++;
      summary.totals.verifier_rejected++;
    } else if (decision === 'blocked') {
      agentBucket.blocked++;
      classBucket.blocked++;
      summary.totals.verifier_blocked++;
    }
  } else if (record.event === 'auto-fix-applied') {
    const agent = normalize(detail.agent);
    if (detail.success === true) {
      bucketFor(summary.agents, agent).auto_fix_applied++;
      summary.totals.auto_fix_applied++;
    } else {
      bucketFor(summary.agents, agent).auto_fix_failed++;
      summary.totals.auto_fix_failed++;
    }
  }
}

async function readJsonl(filePath, summary) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });
  summary.source_files.push(filePath);
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      applyRecord(summary, JSON.parse(trimmed));
    } catch {
      // Calibration summaries are best-effort; malformed rows are ignored.
    }
  }
}

async function collectMetricsFiles(opts) {
  if (opts.metricsFile) {
    return [opts.metricsFile];
  }

  const home = process.env.HOME || '';
  const root = opts.metricsRoot || path.join(home, '.claude', 'projects');
  const files = [];

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name === 'forgeflow-metrics.jsonl') {
        files.push(fullPath);
      }
    }
  }

  walk(root);
  return files.sort();
}

function applyReviewHistory(summary, historyPath) {
  if (!historyPath || !fs.existsSync(historyPath)) return;
  summary.source_files.push(historyPath);
  const text = fs.readFileSync(historyPath, 'utf8');
  const overturnPattern = /^-\s*REVIEWER:\s*([^|]+?)\s*\|\s*CLASS:\s*([^|]+?)\s*\|\s*FINDING:\s*(.+?)\s*$/gm;
  let match;
  while ((match = overturnPattern.exec(text)) !== null) {
    applyRecord(summary, {
      schema_version: '1',
      event: 'finding-overturned',
      detail: {
        overturned_reviewer: match[1].trim(),
        finding_class: match[2].trim(),
        finding: match[3].trim(),
      },
    });
  }
}

function sortObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

async function main() {
  const opts = parseArgs(args);
  const summary = createSummary();
  for (const file of await collectMetricsFiles(opts)) {
    await readJsonl(file, summary);
  }
  applyReviewHistory(summary, opts.reviewHistory);
  summary.agents = sortObject(summary.agents);
  summary.classes = sortObject(summary.classes);

  const output = JSON.stringify(summary, null, 2) + '\n';
  if (opts.out) {
    fs.mkdirSync(path.dirname(opts.out), { recursive: true });
    fs.writeFileSync(opts.out, output);
  }

  if (opts.json || !opts.out) {
    process.stdout.write(output);
  } else {
    console.log(`Calibration summary written to ${opts.out}`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.stack || String(err));
    process.exit(1);
  });
}

module.exports = { applyRecord, createSummary };
