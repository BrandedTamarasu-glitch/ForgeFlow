#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readAgentFeedback, readReviewOutcomes } = require('./build-project-intelligence');
const { readNextWorkOutcomes } = require('./record-next-work-outcome');

function usage() {
  console.error('Usage: render-telemetry-quality.js [--root <repo>] [--project-dir <dir>] [--metrics-root <dir>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', metricsRoot: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--metrics-root') {
      opts.metricsRoot = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function defaultMetricsRoot() {
  return path.join(os.homedir(), '.claude', 'projects');
}

function countMetrics(root) {
  let files = 0;
  let events = 0;
  let invalid_lines = 0;
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && entry.name === 'forgeflow-metrics.jsonl') {
        files += 1;
        for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((item) => item.trim())) {
          try {
            JSON.parse(line);
            events += 1;
          } catch (_err) {
            invalid_lines += 1;
          }
        }
      }
    }
  }
  walk(root);
  return { files, events, invalid_lines };
}

function buildTelemetryQuality(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const metricsRoot = path.resolve(opts.metricsRoot || defaultMetricsRoot());
  const agentFeedback = readAgentFeedback(projectDir);
  const reviewOutcomes = readReviewOutcomes(projectDir);
  const nextWork = readNextWorkOutcomes(projectDir);
  const metrics = countMetrics(metricsRoot);
  const missing = [];
  if ((reviewOutcomes.records || 0) === 0) missing.push('review-outcomes');
  if ((agentFeedback.records || 0) === 0) missing.push('agent-feedback');
  if ((nextWork.records || 0) === 0) missing.push('next-work-outcomes');
  if (metrics.events === 0) missing.push('metrics-events');
  const invalid = {
    review_outcomes: reviewOutcomes.status === 'invalid' ? Math.max(1, reviewOutcomes.invalid_lines || 0) : (reviewOutcomes.invalid_lines || 0),
    agent_feedback: agentFeedback.status === 'invalid' ? Math.max(1, agentFeedback.invalid_lines || 0) : (agentFeedback.invalid_lines || 0),
    next_work_outcomes: nextWork.status === 'invalid' ? Math.max(1, nextWork.invalid_lines || 0) : (nextWork.invalid_lines || 0),
    metrics_events: metrics.invalid_lines || 0,
  };
  const invalidTotal = Object.values(invalid).reduce((sum, value) => sum + value, 0);
  const evidenceScore = Math.max(0, 100 - (missing.length * 20) - (invalidTotal > 0 ? 20 : 0));
  const status = invalidTotal > 0 ? 'attention' : (missing.length > 0 ? 'thin' : 'ready');
  return {
    schema_version: '1',
    status,
    root,
    project_dir: projectDir,
    metrics_root: metricsRoot,
    evidence_score: evidenceScore,
    missing,
    invalid,
    invalid_total: invalidTotal,
    counts: {
      metrics_files: metrics.files,
      metrics_events: metrics.events,
      review_outcomes: reviewOutcomes.records || 0,
      agent_feedback: agentFeedback.records || 0,
      next_work_outcomes: nextWork.records || 0,
    },
    next: missing.length > 0
      ? 'Record real review outcomes, agent feedback, next-work outcomes, or run Forgeflow workflows until telemetry exists.'
      : (invalidTotal > 0 ? 'Fix or remove malformed local telemetry and outcome lines before relying on calibration.' : 'Use telemetry quality as review-routing and next-work calibration evidence.'),
    boundary: 'Telemetry quality is advisory. It does not backfill telemetry, infer outcomes, export local records, edit files, commit, or push.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Telemetry Quality',
    '',
    `Status: ${result.status}`,
    `Evidence score: ${result.evidence_score}`,
    '',
    result.boundary,
    '',
    '## Counts',
    '',
  ];
  for (const [key, value] of Object.entries(result.counts)) lines.push(`- ${key}: ${value}`);
  lines.push('', '## Invalid Lines', '');
  for (const [key, value] of Object.entries(result.invalid)) lines.push(`- ${key}: ${value}`);
  lines.push('', '## Missing', '');
  if (result.missing.length === 0) lines.push('- None.');
  else for (const item of result.missing) lines.push(`- ${item}`);
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildTelemetryQuality(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(1);
  }
}

module.exports = { buildTelemetryQuality, parseArgs, renderMarkdown };
