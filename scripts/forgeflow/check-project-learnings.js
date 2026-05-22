#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REQUIRED_SECTIONS = [
  'Recurring Pitfalls',
  'Stable Decisions',
  'Risk Areas',
  'Validation Patterns',
  'Hot Files And Modules',
  'Repeated Follow-ups',
  'Recommended Approach For Next Work',
];
const VALID_CATEGORIES = new Set([
  'recurring-pitfall',
  'stable-decision',
  'risk-area',
  'validation-pattern',
  'hot-file',
  'repeated-follow-up',
  'recommended-approach',
]);
const VALID_CONFIDENCE = new Set(['low', 'medium', 'high']);
const VALID_STATUS = new Set(['active', 'stale', 'superseded']);
const SENSITIVE_PATTERNS = [
  ['private-key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/i],
  ['assignment-secret', /\b(api[_-]?key|password|passwd|secret|token)\s*[:=]/i],
  ['long-token-like-value', /\b[A-Z0-9]{20,}\b/],
  ['private-url', /\b(?:https?|ssh|git):\/\/(?:[^/\s:@]+:[^/\s@]+@|[^/\s]*(?:localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|\.internal\b|\.local\b|internal\.|intranet\.|corp\.))/i],
  ['private-url', /\bgit@[^:\s]+:[^\s)]+/i],
];
const STALE_AFTER_DAYS = 30;

function usage() {
  console.error('Usage: check-project-learnings.js [--project-dir <dir>] [--strict] [--json]');
}

function parseArgs(argv) {
  const opts = { projectDir: '', strict: false, json: false };
  function requireValue(name, index) {
    const value = argv[index + 1] || '';
    if (!value || value.startsWith('--')) {
      console.error(`Missing value for ${name}`);
      usage();
      process.exit(2);
    }
    return path.resolve(value);
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') {
      opts.projectDir = requireValue(arg, i);
      i += 1;
    } else if (arg === '--strict') {
      opts.strict = true;
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

function git(args, cwd) {
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

function issue(severity, code, message, detail = {}) {
  return { severity, code, message, ...detail };
}

function sensitiveIssues(lines, source) {
  const issues = [];
  for (let i = 0; i < lines.length; i += 1) {
    for (const [pattern, regex] of SENSITIVE_PATTERNS) {
      if (regex.test(lines[i])) {
        issues.push(issue('fail', 'sensitive-content', `Potential sensitive content detected in ${source}`, {
          source,
          line: i + 1,
          pattern,
        }));
      }
    }
  }
  return issues;
}

function sectionItems(content, heading) {
  const lines = String(content || '').split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return null;
  const items = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    if (line.trim().startsWith('- ')) items.push(line.trim().replace(/^-\s+/, ''));
  }
  return items;
}

function isPlaceholder(item) {
  return String(item || '').trim() === 'No repeated pattern recorded yet.';
}

function duplicateItems(sections) {
  const seen = new Set();
  const duplicates = [];
  for (const items of Object.values(sections)) {
    for (const item of items || []) {
      if (isPlaceholder(item)) continue;
      const key = item.toLowerCase();
      if (seen.has(key) && !duplicates.includes(item)) duplicates.push(item);
      seen.add(key);
    }
  }
  return duplicates;
}

function generatedAt(content) {
  const match = String(content || '').match(/^- Generated at:\s*(.+)$/mu);
  if (!match) return '';
  return match[1].trim();
}

function staleGeneratedAtIssue(content, source, now = new Date()) {
  const value = generatedAt(content);
  if (!value || value === 'unknown') {
    return issue('warn', 'freshness-missing', 'Project learnings generated_at metadata is missing; refresh before relying on agent guidance', { source });
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return issue('warn', 'freshness-invalid', 'Project learnings generated_at metadata is invalid', { source });
  }
  const ageDays = Math.floor((now.getTime() - timestamp) / 86400000);
  if (ageDays > STALE_AFTER_DAYS) {
    return issue('warn', 'freshness-stale', 'Project learnings are stale; refresh before relying on agent guidance', { source, age_days: ageDays, stale_after_days: STALE_AFTER_DAYS });
  }
  return null;
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return { records: [], issues: [] };
  const records = [];
  const issues = [];
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      records.push({ line: i + 1, value: JSON.parse(line) });
    } catch (_err) {
      issues.push(issue('fail', 'candidate-json-invalid', 'Project learning candidate line is not valid JSON', { source: file, line: i + 1 }));
    }
  }
  return { records, issues };
}

function checkCandidates(file) {
  const { records, issues } = readJsonl(file);
  if (!fs.existsSync(file)) return { records: 0, issues };
  const rawLines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  issues.push(...sensitiveIssues(rawLines, file));
  for (const record of records) {
    const value = record.value || {};
    if (!VALID_CATEGORIES.has(value.category)) {
      issues.push(issue('fail', 'candidate-category-invalid', 'Project learning candidate has invalid category', { source: file, line: record.line }));
    }
    if (!String(value.learning || '').trim()) {
      issues.push(issue('fail', 'candidate-learning-missing', 'Project learning candidate is missing learning text', { source: file, line: record.line }));
    }
    if (value.confidence !== undefined && !VALID_CONFIDENCE.has(String(value.confidence).trim().toLowerCase())) {
      issues.push(issue('fail', 'candidate-confidence-invalid', 'Project learning candidate has invalid confidence', { source: file, line: record.line }));
    }
    if (value.evidence_count !== undefined) {
      const rawCount = String(value.evidence_count).trim();
      const count = Number.parseInt(rawCount, 10);
      if (!/^\d+$/.test(rawCount) || !Number.isInteger(count) || count < 1) {
        issues.push(issue('fail', 'candidate-evidence-count-invalid', 'Project learning candidate has invalid evidence_count', { source: file, line: record.line }));
      }
    }
    if (value.application_guidance !== undefined && String(value.application_guidance || '').trim().length > 240) {
      issues.push(issue('fail', 'candidate-application-guidance-oversized', 'Project learning candidate application_guidance is too long', { source: file, line: record.line }));
    }
    if (value.status !== undefined && !VALID_STATUS.has(String(value.status).trim().toLowerCase())) {
      issues.push(issue('fail', 'candidate-status-invalid', 'Project learning candidate has invalid status', { source: file, line: record.line }));
    }
    if (value.superseded_by !== undefined && String(value.superseded_by || '').trim().length > 240) {
      issues.push(issue('fail', 'candidate-superseded-by-oversized', 'Project learning candidate superseded_by is too long', { source: file, line: record.line }));
    }
    if (String(value.status || '').trim().toLowerCase() === 'superseded' && !String(value.superseded_by || '').trim()) {
      issues.push(issue('warn', 'candidate-superseded-by-missing', 'Superseded project learning candidate should explain the replacement guidance', { source: file, line: record.line }));
    }
  }
  return { records: records.length, issues };
}

function checkProjectLearnings(opts = {}) {
  const root = repoRoot();
  const projectDir = opts.projectDir || defaultProjectDir(root);
  const markdownFile = path.join(projectDir, 'project-learnings.md');
  const candidatesFile = path.join(projectDir, 'project-learning-candidates.jsonl');
  const issues = [];
  let sectionCounts = {};
  let placeholderSections = 0;
  let bytes = 0;
  let generatedAtValue = '';

  if (!fs.existsSync(markdownFile)) {
    issues.push(issue(opts.strict ? 'fail' : 'warn', 'learnings-missing', 'Project learnings file is missing', { source: markdownFile }));
  } else {
    const content = fs.readFileSync(markdownFile, 'utf8');
    generatedAtValue = generatedAt(content);
    bytes = Buffer.byteLength(content, 'utf8');
    const lines = content.split(/\r?\n/);
    issues.push(...sensitiveIssues(lines, markdownFile));
    if (!content.includes('guidance only') || !content.includes('Verify current')) {
      issues.push(issue('fail', 'proof-boundary-missing', 'Project learnings must include the guidance-only proof boundary', { source: markdownFile }));
    }
    if (bytes > 12000) {
      issues.push(issue('warn', 'learnings-oversized', 'Project learnings file is large enough to bloat latest-insights packets', { source: markdownFile, bytes }));
    }
    const freshnessIssue = staleGeneratedAtIssue(content, markdownFile, opts.now || new Date());
    if (freshnessIssue) issues.push(freshnessIssue);
    for (const heading of REQUIRED_SECTIONS) {
      const items = sectionItems(content, heading);
      if (!items) {
        issues.push(issue('warn', 'section-missing', `Missing project learnings section: ${heading}`, { source: markdownFile }));
        continue;
      }
      sectionCounts[heading] = items.length;
      if (items.length === 0 || items.every(isPlaceholder)) placeholderSections += 1;
    }
    if (placeholderSections === REQUIRED_SECTIONS.length) {
      issues.push(issue(opts.strict ? 'fail' : 'warn', 'placeholder-only', 'Project learnings contain only placeholder insights', { source: markdownFile }));
    }
    const duplicates = duplicateItems(Object.fromEntries(REQUIRED_SECTIONS.map((heading) => [heading, sectionItems(content, heading) || []])));
    if (duplicates.length > 0) {
      issues.push(issue('warn', 'duplicate-insights', 'Project learnings contain repeated bullets', { source: markdownFile, count: duplicates.length }));
    }
  }

  const candidateCheck = checkCandidates(candidatesFile);
  issues.push(...candidateCheck.issues);
  const failures = issues.filter((item) => item.severity === 'fail');
  const warnings = issues.filter((item) => item.severity === 'warn');
  return {
    schema_version: '1',
    status: failures.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
    project_dir: projectDir,
    learnings_file: markdownFile,
    candidates_file: fs.existsSync(candidatesFile) ? candidatesFile : '',
    candidates: candidateCheck.records,
    bytes,
    generated_at: generatedAtValue,
    section_counts: sectionCounts,
    issues,
  };
}

function renderMarkdown(result) {
  const lines = [
    `# Project Learnings Check: ${result.status.toUpperCase()}`,
    '',
    `Learnings file: ${result.learnings_file}`,
  ];
  if (result.candidates_file) lines.push(`Candidates file: ${result.candidates_file}`);
  lines.push(`Candidates: ${result.candidates}`, '');
  if (result.issues.length === 0) {
    lines.push('No project-learnings issues found.');
  } else {
    for (const item of result.issues) {
      const where = item.line ? ` (${item.source}:${item.line})` : item.source ? ` (${item.source})` : '';
      lines.push(`- ${item.severity.toUpperCase()} ${item.code}: ${item.message}${where}`);
    }
  }
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = checkProjectLearnings(opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log(renderMarkdown(result));
  }
  if (result.status === 'fail') process.exit(1);
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
  checkProjectLearnings,
  sectionItems,
};
