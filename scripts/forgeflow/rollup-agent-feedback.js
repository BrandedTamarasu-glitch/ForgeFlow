#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { safeReadTextFile, writeFileSafe } = require('./file-safety');
const { containsProhibitedFeedbackContent, rollupFeedback } = require('./record-agent-feedback');
const { sensitiveMatches } = require('./privacy-boundary');

const VALID_SIGNALS = new Set(['useful', 'unclear', 'ignored', 'incorrect']);
const VALID_CONFIDENCE = new Set(['low', 'medium', 'high']);

function usage() {
  console.error('Usage: rollup-agent-feedback.js [--project-dir <dir>] [--out <path>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = {
    projectDir: '',
    out: '',
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--out') {
      opts.out = path.resolve(requireValue(argv, arg, i));
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

function git(args, cwd = process.cwd()) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) return '';
  return result.stdout.trimEnd();
}

function repoRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], cwd) || cwd;
}

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function defaultOut(projectDir) {
  return path.join(projectDir, 'context', 'agent-feedback-rollup.json');
}

function markdownOutFor(jsonOut) {
  return /\.json$/i.test(jsonOut) ? jsonOut.replace(/\.json$/i, '.md') : `${jsonOut}.md`;
}

function feedbackSchemaIssue(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return 'invalid-schema';
  if (!record.agent || typeof record.agent !== 'string') return 'invalid-schema';
  if (!VALID_SIGNALS.has(record.signal)) return 'invalid-schema';
  if (!record.summary || typeof record.summary !== 'string') return 'invalid-schema';
  if (!VALID_CONFIDENCE.has(record.confidence)) return 'invalid-schema';
  if (!Number.isInteger(record.evidence_count) || record.evidence_count < 1) return 'invalid-schema';
  return '';
}

function publicSafeSummary(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const labels = [...new Set(sensitiveMatches(text))];
  if (
    labels.length > 0
    || /(?:^|[\s("'`=:])(?:\/(?:home|Users|var|etc|tmp|private|opt|root|mnt|Volumes)\/|\.{1,2}\/|~\/|[A-Za-z]:\\|\\\\)[^\s)"'`]+/i.test(text)
    || /(?:^|\s)[A-Za-z_$][\w$.[\]-]*\s*=\s*\S+/.test(text)
    || /[`{};]/.test(text)
    || /=>/.test(text)
  ) {
    return labels.length > 0
      ? `[redacted feedback summary: ${labels.sort().join(', ')}]`
      : '[redacted feedback summary]';
  }
  return text.slice(0, 240);
}

function publicSafeExample(record) {
  return {
    signal: record.signal,
    summary: publicSafeSummary(record.summary),
    confidence: record.confidence,
    evidence_count: record.evidence_count,
  };
}

function daysSince(value, now = new Date()) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return null;
  return Math.floor((now.getTime() - timestamp) / 86400000);
}

function themeKey(record) {
  return publicSafeSummary(record.correction || record.summary)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 8)
    .join(' ') || 'unspecified feedback theme';
}

function correctionThemes(records, limit = 5) {
  const themes = {};
  for (const record of records.filter((item) => ['incorrect', 'unclear', 'ignored'].includes(item.signal))) {
    const key = themeKey(record);
    if (!themes[key]) {
      themes[key] = {
        theme: key,
        count: 0,
        signals: {},
        agents: [],
        latest_examples: [],
        manual_promotion: 'Only promote after a human confirms the pattern still applies to current code and review artifacts.',
      };
    }
    const theme = themes[key];
    theme.count += 1;
    theme.signals[record.signal] = (theme.signals[record.signal] || 0) + 1;
    if (!theme.agents.includes(record.agent)) theme.agents.push(record.agent);
    theme.latest_examples.push(publicSafeExample(record));
    theme.latest_examples = theme.latest_examples.slice(-3);
  }
  return Object.values(themes)
    .sort((a, b) => b.count - a.count || a.theme.localeCompare(b.theme))
    .slice(0, limit);
}

function promotionCandidates(records, limit = 5) {
  return records
    .filter((record) => record.evidence_count >= 2 && ['medium', 'high'].includes(record.confidence))
    .map((record) => ({
      agent: record.agent,
      signal: record.signal,
      summary: publicSafeSummary(record.summary),
      confidence: record.confidence,
      evidence_count: record.evidence_count,
      manual_promotion: 'Review current evidence, then rerun record-agent-feedback with --promote if the guidance still holds.',
    }))
    .slice(-limit);
}

function staleMarkers(records, now = new Date()) {
  const marker = {
    threshold_days: 30,
    stale_records: 0,
    missing_timestamp_records: 0,
    latest_age_days: null,
    status: 'current',
  };
  const ages = [];
  for (const record of records) {
    const age = daysSince(record.ts, now);
    if (age === null) {
      marker.missing_timestamp_records += 1;
      continue;
    }
    ages.push(age);
    if (age > marker.threshold_days) marker.stale_records += 1;
  }
  if (ages.length > 0) marker.latest_age_days = Math.min(...ages);
  if (marker.stale_records > 0) marker.status = 'stale';
  else if (marker.missing_timestamp_records > 0) marker.status = 'unknown';
  return marker;
}

function readFeedback(projectDir) {
  const file = path.join(projectDir, 'agent-feedback.jsonl');
  const valid = [];
  const skipped = [];
  if (!fs.existsSync(file)) return { file, valid, skipped, status: 'missing' };
  const lines = safeReadTextFile(file, projectDir).content.split(/\r?\n/);
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    if (!line) continue;
    try {
      const record = JSON.parse(line);
      const schemaIssue = feedbackSchemaIssue(record);
      if (schemaIssue) {
        skipped.push({ line: index + 1, reason: schemaIssue });
        continue;
      }
      const combined = [record.work_item, record.agent, record.signal, record.summary, record.correction].join('\n');
      if (containsProhibitedFeedbackContent(combined)) {
        skipped.push({ line: index + 1, reason: 'privacy-boundary' });
        continue;
      }
      valid.push(record);
    } catch (_err) {
      skipped.push({ line: index + 1, reason: 'malformed-json' });
    }
  }
  return {
    file,
    valid,
    skipped,
    status: valid.length > 0 ? 'present' : (skipped.length > 0 ? 'invalid' : 'empty'),
  };
}

function qualityByAgent(records) {
  const agents = {};
  for (const record of records) {
    if (!agents[record.agent]) {
      agents[record.agent] = {
        records: 0,
        useful: 0,
        corrective: 0,
        promotable: 0,
        latest_examples: [],
      };
    }
    const item = agents[record.agent];
    item.records += 1;
    if (record.signal === 'useful') item.useful += 1;
    if (['incorrect', 'unclear', 'ignored'].includes(record.signal)) item.corrective += 1;
    if (record.evidence_count >= 2 && ['medium', 'high'].includes(record.confidence)) item.promotable += 1;
    item.latest_examples.push(publicSafeExample(record));
    item.latest_examples = item.latest_examples.slice(-3);
  }
  return agents;
}

function rollupAgentFeedback(opts = {}) {
  const root = repoRoot();
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const out = path.resolve(opts.out || defaultOut(projectDir));
  const markdownOut = markdownOutFor(out);
  const feedback = readFeedback(projectDir);
  const base = rollupFeedback(feedback.valid);
  const corrective = (base.by_signal.incorrect || 0) + (base.by_signal.unclear || 0) + (base.by_signal.ignored || 0);
  const result = {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    status: feedback.status,
    project_dir: projectDir,
    source_file: feedback.file,
    records: base.records,
    by_signal: base.by_signal,
    by_agent: base.by_agent,
    promotable: base.promotable,
    corrective,
    skipped_lines: feedback.skipped.length,
    skipped_reasons: feedback.skipped.slice(0, 10),
    agents: qualityByAgent(feedback.valid),
    latest_examples: feedback.valid.slice(-5).map((record) => ({
      agent: record.agent,
      ...publicSafeExample(record),
    })),
    correction_themes: correctionThemes(feedback.valid),
    promotion_candidates: promotionCandidates(feedback.valid),
    stale_markers: staleMarkers(feedback.valid),
    boundary: 'Advisory only. Verify feedback against current code, tests, and review artifacts before changing agent prompts or project guidance.',
    artifacts: {
      json: out,
      markdown: markdownOut,
    },
  };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  writeFileSafe(out, `${JSON.stringify(result, null, 2)}\n`);
  writeFileSafe(markdownOut, renderMarkdown(result));
  return result;
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Agent Feedback Rollup',
    '',
    `Generated at: ${result.generated_at}`,
    `Status: ${result.status}`,
    `Records: ${result.records}`,
    `Promotable: ${result.promotable}`,
    `Corrective: ${result.corrective}`,
    `Skipped lines: ${result.skipped_lines}`,
    '',
    result.boundary,
    '',
    '## Signals',
    '',
  ];
  const signals = Object.entries(result.by_signal || {});
  lines.push(...(signals.length > 0 ? signals.map(([signal, count]) => `- ${signal}: ${count}`) : ['- (none)']));
  lines.push('', '## Agents', '');
  const agents = Object.entries(result.agents || {});
  if (agents.length === 0) {
    lines.push('- (none)');
  } else {
    for (const [agent, item] of agents) {
      lines.push(`- ${agent}: ${item.records} record(s), ${item.useful} useful, ${item.corrective} corrective, ${item.promotable} promotable`);
      for (const example of item.latest_examples) {
        lines.push(`  - ${example.signal}: ${example.summary} [confidence: ${example.confidence}, evidence: ${example.evidence_count}]`);
      }
    }
  }
  lines.push('', '## Correction Themes', '');
  lines.push(...(result.correction_themes.length > 0
    ? result.correction_themes.map((item) => `- ${item.theme}: ${item.count} signal(s), agents ${item.agents.join(', ')}. ${item.manual_promotion}`)
    : ['- (none)']));
  lines.push('', '## Promotion Candidates', '');
  lines.push(...(result.promotion_candidates.length > 0
    ? result.promotion_candidates.map((item) => `- ${item.agent} ${item.signal}: ${item.summary} [confidence: ${item.confidence}, evidence: ${item.evidence_count}] ${item.manual_promotion}`)
    : ['- (none)']));
  lines.push('', '## Staleness', '');
  lines.push(`- Status: ${result.stale_markers.status}`);
  lines.push(`- Stale records: ${result.stale_markers.stale_records}`);
  lines.push(`- Missing timestamps: ${result.stale_markers.missing_timestamp_records}`);
  lines.push('', '## Skipped Lines', '');
  lines.push(...(result.skipped_reasons.length > 0 ? result.skipped_reasons.map((item) => `- line ${item.line}: ${item.reason}`) : ['- (none)']));
  lines.push('', '## Artifacts', '', `- JSON: ${result.artifacts.json}`, `- Markdown: ${result.artifacts.markdown}`, `- Source: ${result.source_file}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = rollupAgentFeedback(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  feedbackSchemaIssue,
  parseArgs,
  publicSafeSummary,
  correctionThemes,
  promotionCandidates,
  readFeedback,
  renderMarkdown,
  rollupAgentFeedback,
  staleMarkers,
};
