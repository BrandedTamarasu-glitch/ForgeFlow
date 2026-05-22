#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { appendFileSafe, assertSafeDestination, assertSafeDirectory } = require('./file-safety');
const { containsSensitiveContent, recordProjectLearning } = require('./record-project-learning');

const VALID_SIGNALS = new Set(['useful', 'unclear', 'ignored', 'incorrect']);
const VALID_CONFIDENCE = new Set(['low', 'medium', 'high']);

function usage() {
  console.error([
    'Usage: record-agent-feedback.js [--project-dir <dir>] --agent <name> --signal useful|unclear|ignored|incorrect --summary <text>',
    '       [--work-item <id>] [--correction <text>] [--confidence low|medium|high] [--evidence-count <n>] [--promote] [--json]',
  ].join('\n'));
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

function parseArgs(argv) {
  const opts = {
    projectDir: '',
    agent: '',
    signal: '',
    summary: '',
    workItem: '',
    correction: '',
    confidence: 'medium',
    evidenceCount: 1,
    promote: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--agent') {
      opts.agent = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--signal') {
      opts.signal = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--summary') {
      opts.summary = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--work-item') {
      opts.workItem = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--correction') {
      opts.correction = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--confidence') {
      opts.confidence = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--evidence-count') {
      opts.evidenceCount = Number.parseInt(requireValue(argv, arg, i), 10);
      i += 1;
    } else if (arg === '--promote') {
      opts.promote = true;
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

function git(args, cwd) {
  const result = require('child_process').spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) return '';
  return result.stdout.trimEnd();
}

function repoRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], cwd) || cwd;
}

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/[|]/g, '/').trim();
}

function containsProhibitedFeedbackContent(value) {
  const text = String(value || '');
  return containsSensitiveContent(text)
    || /[`{};]/.test(text)
    || /\b(import|export|function|class|const|let|var)\s+[\w{*$]/.test(text)
    || /=>/.test(text)
    || /\b[A-Za-z_$][\w$]*\s*\([^)]*\)/.test(text)
    || /\b[A-Za-z_$][\w$.[\]-]*\s*=\s*\S+/.test(text)
    || /['"]?(statusLine|hooks|permissions|env|apiKey|token|password|secret)['"]?\s*:/i.test(text)
    || /(?:^|\n)\s*['"]?[A-Za-z][\w.-]*['"]?\s*:\s*\S+/.test(text)
    || /\bcustomer(?:\s+name)?\s*[:=]/i.test(text)
    || /\b(private|internal)\s+(architecture|topology|network|endpoint|service)\b/i.test(text);
}

function normalizeFeedback(opts = {}) {
  const record = {
    schema_version: '1',
    ts: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    work_item: cleanText(opts.workItem || 'unspecified'),
    agent: cleanText(opts.agent),
    signal: cleanText(opts.signal).toLowerCase(),
    summary: cleanText(opts.summary),
    correction: cleanText(opts.correction || ''),
    confidence: cleanText(opts.confidence || 'medium').toLowerCase(),
    evidence_count: Number.isInteger(opts.evidenceCount) ? opts.evidenceCount : Number.parseInt(opts.evidenceCount || '1', 10),
  };
  if (!record.agent) throw new Error('Agent is required');
  if (!VALID_SIGNALS.has(record.signal)) throw new Error(`Invalid feedback signal: ${record.signal}`);
  if (!record.summary) throw new Error('Feedback summary is required');
  if (!VALID_CONFIDENCE.has(record.confidence)) throw new Error(`Invalid feedback confidence: ${record.confidence}`);
  if (!Number.isInteger(record.evidence_count) || record.evidence_count < 1) {
    throw new Error('Feedback evidence_count must be a positive integer');
  }
  const combined = `${record.work_item}\n${record.agent}\n${record.signal}\n${record.summary}\n${record.correction}`;
  if (containsProhibitedFeedbackContent(combined)) {
    throw new Error('Feedback appears to violate the project-learning privacy boundary');
  }
  return record;
}

function promotionCategory(signal) {
  if (signal === 'useful') return 'stable-decision';
  if (signal === 'ignored') return 'repeated-follow-up';
  return 'recurring-pitfall';
}

function promotionLearning(record) {
  if (record.signal === 'useful') return `Agent guidance that worked: ${record.summary}`;
  if (record.signal === 'ignored') return `Repeatedly ignored guidance needs clearer task fit: ${record.summary}`;
  if (record.correction) return `Agent guidance needed correction: ${record.summary}. Correction: ${record.correction}`;
  return `Agent guidance needed correction: ${record.summary}`;
}

function rollupFeedback(records) {
  const summary = {
    schema_version: '1',
    records: records.length,
    by_signal: {},
    by_agent: {},
    promotable: 0,
  };
  for (const record of records) {
    summary.by_signal[record.signal] = (summary.by_signal[record.signal] || 0) + 1;
    summary.by_agent[record.agent] = (summary.by_agent[record.agent] || 0) + 1;
    if (record.evidence_count >= 2 && ['medium', 'high'].includes(record.confidence)) summary.promotable += 1;
  }
  return summary;
}

function readFeedback(file) {
  if (!file || !fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function recordAgentFeedback(opts = {}) {
  const root = repoRoot();
  const projectDir = opts.projectDir || defaultProjectDir(root);
  const out = path.join(projectDir, 'agent-feedback.jsonl');
  const record = normalizeFeedback(opts);
  if (opts.promote) {
    if (record.evidence_count < 2 || !['medium', 'high'].includes(record.confidence)) {
      throw new Error('Feedback promotion requires medium/high confidence and evidence_count >= 2');
    }
    assertSafeDirectory(projectDir);
    assertSafeDestination(path.join(projectDir, 'project-learning-candidates.jsonl'));
  }
  appendFileSafe(out, `${JSON.stringify(record)}\n`);
  let promoted = null;
  if (opts.promote) {
    promoted = recordProjectLearning({
      projectDir,
      category: promotionCategory(record.signal),
      learning: promotionLearning(record),
      source: 'agent-feedback',
      evidence: `${record.agent} ${record.signal} feedback from ${record.work_item}`,
      confidence: record.confidence,
      evidenceCount: record.evidence_count,
      applicationGuidance: 'Use as advisory project guidance only; verify against current code, tests, and review artifacts.',
    });
  }
  return {
    file: out,
    record,
    rollup: rollupFeedback(readFeedback(out)),
    promoted,
  };
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
    if (!opts.agent || !opts.signal || !opts.summary) {
      usage();
      process.exit(2);
    }
    const result = recordAgentFeedback(opts);
    if (opts.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      console.log(`Agent feedback written to ${result.file}`);
      if (result.promoted) {
        console.log(`Project learning promoted to ${result.promoted.file}`);
      }
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  containsProhibitedFeedbackContent,
  normalizeFeedback,
  parseArgs,
  promotionCategory,
  recordAgentFeedback,
  rollupFeedback,
};
