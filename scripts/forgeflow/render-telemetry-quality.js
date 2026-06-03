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

function sourceQuality(source, count, invalidLines, missing) {
  let score = 100;
  const notes = [];
  if (missing) {
    score -= 55;
    notes.push('missing');
  }
  if (invalidLines > 0) {
    score -= 50;
    notes.push('invalid-lines');
  }
  if (count > 0 && count < 2) {
    score -= 10;
    notes.push('sparse');
  }
  const bounded = Math.max(0, Math.min(100, score));
  return {
    source,
    records: count,
    invalid_lines: invalidLines,
    score: bounded,
    confidence: bounded >= 80 ? 'high' : bounded >= 55 ? 'medium' : 'low',
    notes,
  };
}

function buildTrustSummary(counts, invalid, missing) {
  const missingSet = new Set(missing);
  const sources = [
    sourceQuality('review-outcomes', counts.review_outcomes, invalid.review_outcomes, missingSet.has('review-outcomes')),
    sourceQuality('agent-feedback', counts.agent_feedback, invalid.agent_feedback, missingSet.has('agent-feedback')),
    sourceQuality('next-work-outcomes', counts.next_work_outcomes, invalid.next_work_outcomes, missingSet.has('next-work-outcomes')),
    sourceQuality('metrics-events', counts.metrics_events, invalid.metrics_events, missingSet.has('metrics-events')),
  ];
  const trusted = sources.filter((item) => item.confidence === 'high').map((item) => item.source);
  const weakest = sources
    .filter((item) => item.confidence === 'low')
    .sort((a, b) => a.score - b.score)
    .map((item) => item.source);
  const average = sources.length > 0
    ? Math.round(sources.reduce((sum, item) => sum + item.score, 0) / sources.length)
    : 0;
  return {
    status: weakest.length > 0 ? 'attention' : 'pass',
    confidence: average >= 80 ? 'high' : average >= 55 ? 'medium' : 'low',
    average_score: average,
    trusted_sources: trusted,
    weakest_sources: weakest,
    sources,
    next_quality_action: weakest.length > 0
      ? `Refresh or record evidence for ${weakest[0]}.`
      : 'No low-confidence telemetry sources need immediate refresh.',
    boundary: 'Telemetry trust scores rank local calibration evidence only. They do not approve work or replace current code, tests, review, or user instructions.',
  };
}

function buildEvidenceLadder(trustSummary) {
  const lowSources = new Set(trustSummary.weakest_sources || []);
  const reviewSource = (trustSummary.sources || []).find((source) => source.source === 'review-outcomes');
  const highOutcomeSources = (trustSummary.sources || []).filter((source) => (
    ['review-outcomes', 'agent-feedback', 'next-work-outcomes'].includes(source.source)
      && source.confidence === 'high'
      && source.records >= 2
  ));
  const routingReady = reviewSource && reviewSource.confidence === 'high' && reviewSource.records >= 2 && highOutcomeSources.length >= 2;
  const sourceSteps = (trustSummary.sources || []).map((source) => ({
    source: source.source,
    status: lowSources.has(source.source) ? 'needs-real-evidence' : 'usable',
    records: source.records,
    confidence: source.confidence,
    next_action: lowSources.has(source.source)
      ? `Record observed ${source.source} evidence after the next real workflow event.`
      : 'Keep watching this source for drift.',
  }));
  return {
    status: routingReady ? 'usable-for-calibration' : 'too-thin-for-routing-changes',
    minimum_for_routing_changes: 'At least two review outcomes and two records from one additional high-confidence outcome source should exist before changing prompts or routing.',
    routing_ready: Boolean(routingReady),
    source_steps: sourceSteps,
    do_not_do: [
      'backfill missing telemetry',
      'infer outcomes from chat tone',
      'export local records',
      'change review routing from sparse evidence',
    ],
    stop_rule: 'Treat thin telemetry as a prompt to capture future observed outcomes, not as evidence to change workflow behavior.',
  };
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
  const counts = {
    metrics_files: metrics.files,
    metrics_events: metrics.events,
    review_outcomes: reviewOutcomes.records || 0,
    agent_feedback: agentFeedback.records || 0,
    next_work_outcomes: nextWork.records || 0,
  };
  const trustSummary = buildTrustSummary(counts, invalid, missing);
  const evidenceLadder = buildEvidenceLadder(trustSummary);
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
    counts,
    trust_summary: trustSummary,
    evidence_ladder: evidenceLadder,
    trusted_sources: trustSummary.trusted_sources,
    weakest_sources: trustSummary.weakest_sources,
    next_quality_action: trustSummary.next_quality_action,
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
  lines.push(
    '',
    '## Trust Summary',
    '',
    `- Status: ${result.trust_summary.status}`,
    `- Confidence: ${result.trust_summary.confidence}`,
    `- Average score: ${result.trust_summary.average_score}`,
    `- Trusted sources: ${result.trusted_sources.length ? result.trusted_sources.join(', ') : 'none'}`,
    `- Weakest sources: ${result.weakest_sources.length ? result.weakest_sources.join(', ') : 'none'}`,
    `- Next quality action: ${result.next_quality_action}`,
    `- Boundary: ${result.trust_summary.boundary}`,
  );
  if (result.evidence_ladder) {
    lines.push('', '## Evidence Ladder', '');
    lines.push(`- Status: ${result.evidence_ladder.status}`);
    lines.push(`- Minimum for routing changes: ${result.evidence_ladder.minimum_for_routing_changes}`);
    lines.push(`- Stop rule: ${result.evidence_ladder.stop_rule}`);
  }
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

module.exports = { buildEvidenceLadder, buildTelemetryQuality, buildTrustSummary, parseArgs, renderMarkdown };
