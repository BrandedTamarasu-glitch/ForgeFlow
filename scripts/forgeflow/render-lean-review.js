#!/usr/bin/env node
const path = require('path');
const { spawnSync } = require('child_process');
const { safeReadTextFile } = require('./file-safety');
const { checkReviewEvidenceSchema } = require('./check-review-evidence-schema');

const TAGS = ['delete', 'stdlib', 'native', 'reuse', 'yagni', 'shrink', 'prose-bloat'];
const HARD_BOUNDARY_RE = /\b(auth|authorization|permission|security|secret|token|password|crypto|migration|schema|database|payment|money|invoice|ledger|a11y|accessibility|keyboard|screen reader|validation|sanitize|csrf|xss|data loss)\b/i;

function usage() {
  console.error('Usage: render-lean-review.js [--root <repo>] [--diff <path>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), diff: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--diff') {
      opts.diff = path.resolve(requireValue(argv, arg, i));
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

function gitDiff(root) {
  const result = spawnSync('git', ['diff', 'HEAD'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) return '';
  return result.stdout || '';
}

function readDiff(opts) {
  if (opts.diff) return safeReadTextFile(opts.diff, opts.root).content;
  return gitDiff(opts.root);
}

function parseDiff(diff) {
  const files = [];
  let current = null;
  let oldLine = 0;
  let newLine = 0;
  for (const raw of String(diff || '').split(/\r?\n/)) {
    if (raw.startsWith('diff --git ')) {
      current = { file: '', added: [], removed: [], text: [] };
      files.push(current);
      continue;
    }
    if (!current) continue;
    current.text.push(raw);
    if (raw.startsWith('+++ b/')) current.file = raw.slice(6);
    const hunk = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      continue;
    }
    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      current.added.push({ line: newLine, text: raw.slice(1) });
      newLine += 1;
      continue;
    }
    if (raw.startsWith('-') && !raw.startsWith('---')) {
      current.removed.push({ line: oldLine, text: raw.slice(1) });
      oldLine += 1;
      continue;
    }
    if (!raw.startsWith('\\')) {
      oldLine += 1;
      newLine += 1;
    }
  }
  return files.filter((file) => file.file);
}

function addedText(file) {
  return file.added.map((line) => line.text).join('\n');
}

function boundaryReasons(file) {
  const text = addedText(file);
  const reasons = [];
  if (HARD_BOUNDARY_RE.test(`${file.file}\n${text}`)) reasons.push('hard-boundary-scope');
  if (/\.(test|spec)\.(js|jsx|ts|tsx)$/.test(file.file) || /(^|\/)(__tests__|tests|e2e)\//.test(file.file)) reasons.push('validation-scope');
  return reasons;
}

function firstLine(file, pattern) {
  const found = file.added.find((line) => pattern.test(line.text));
  return found ? found.line : (file.added[0] ? file.added[0].line : 1);
}

function makeFinding(file, tag, title, evidence, line, removableLines = 1) {
  return {
    id: `lean-${tag}-${file.file.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}`,
    source: 'forgeflow-lean-review',
    tier: 'NIT',
    title,
    class: tag,
    file: file.file,
    line,
    evidence,
    removable_lines: removableLines,
  };
}

function proseBloat(file) {
  if (!/\.(md|mdx|txt|rst)$/.test(file.file.toLowerCase())) return null;
  const proseLines = file.added.filter((line) => line.text.trim() && !/^(```|#|\||-|\d+\. )/.test(line.text.trim()));
  if (proseLines.length < 8) return null;
  return makeFinding(file, 'prose-bloat', 'Added explanatory prose may be larger than the decision needs.', 'Long prose-only addition; keep result, skipped work, and upgrade trigger concise.', proseLines[0].line, Math.max(3, proseLines.length - 5));
}

function findingsForFile(file) {
  const boundaries = boundaryReasons(file);
  if (boundaries.length) return { findings: [], skipped: [{ file: file.file, reasons: boundaries }] };
  const text = addedText(file);
  const findings = [];
  const add = (tag, title, evidence, pattern, removableLines = 1) => {
    if (findings.some((item) => item.class === tag)) return;
    findings.push(makeFinding(file, tag, title, evidence, firstLine(file, pattern), removableLines));
  };

  if (/\b(if\s*\(\s*false\s*\)|dead code|TODO:\s*remove|temporary unused)\b/i.test(text)) {
    add('delete', 'New dead or explicitly temporary code can be deleted.', 'The diff adds dead-code markers or disabled branches.', /\b(if\s*\(\s*false\s*\)|dead code|TODO:\s*remove|temporary unused)\b/i, 2);
  }
  if (/\b(manualSort|customSort|bubbleSort|for\s*\([^)]*;\s*[^;]*length[^;]*;[^)]*\)[\s\S]*for\s*\([^)]*;\s*[^;]*length[^;]*;[^)]*\))/i.test(text)) {
    add('stdlib', 'Custom sorting should use the runtime sort helper first.', 'Sorting is a standard-library operation unless the brief requires custom ordering semantics.', /\b(manualSort|customSort|bubbleSort|for\s*\()/i, 6);
  }
  if (/\b(customDatePicker|calendar widget|datepicker component|date picker)\b/i.test(text)) {
    add('native', 'Simple date selection should check native browser date input first.', 'Native date input may cover the requirement without a custom widget.', /\b(customDatePicker|calendar widget|datepicker component|date picker)\b/i, 8);
  }
  if (/\b(new helper|new abstraction|new wrapper|new utility)\b/i.test(text) && /\b(existing|already|similar|same pattern|reuse)\b/i.test(text)) {
    add('reuse', 'New helper appears to duplicate an existing project pattern.', 'The diff itself references an existing or similar path; inspect reuse before adding another helper.', /\b(new helper|new abstraction|new wrapper|new utility)\b/i, 4);
  }
  if (/\b(future[- ]?proof|futureProof\w*|eventually|nice to have|extensible|plugin registry|strategy factory|abstract factory)\b/i.test(text)) {
    add('yagni', 'Future-facing structure should wait for current evidence.', 'Speculative extensibility is not justified by this diff alone.', /\b(future[- ]?proof|futureProof\w*|eventually|nice to have|extensible|plugin registry|strategy factory|abstract factory)\b/i, 5);
  }
  if (/\bclass\s+\w*(Manager|Coordinator|Orchestrator)|function\s+\w*(Manager|Coordinator|Orchestrator)|create[A-Z]\w*Factory\b/.test(text)) {
    add('shrink', 'A new manager/factory layer may be larger than the current slice needs.', 'Prefer direct project-consistent code until a second caller or measured need appears.', /\b(class\s+\w*(Manager|Coordinator|Orchestrator)|function\s+\w*(Manager|Coordinator|Orchestrator)|create[A-Z]\w*Factory)\b/, 5);
  }
  const prose = proseBloat(file);
  if (prose) findings.push(prose);
  return { findings, skipped: [] };
}

function buildLeanReview(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const diff = opts.diffText ?? readDiff({ root, diff: opts.diff || '' });
  const files = parseDiff(diff);
  const findings = [];
  const skipped = [];
  for (const file of files) {
    const result = findingsForFile(file);
    findings.push(...result.findings);
    skipped.push(...result.skipped);
  }
  const deduped = [];
  const seen = new Set();
  for (const finding of findings) {
    const key = `${finding.class}:${finding.file}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(finding);
    }
  }
  const estimated = deduped.reduce((sum, item) => sum + item.removable_lines, 0);
  const schema = checkReviewEvidenceSchema(deduped);
  return {
    schema_version: '1',
    status: deduped.length ? 'findings' : 'clean',
    root,
    tags: TAGS,
    findings: deduped,
    findings_count: deduped.length,
    estimated_net_removable_lines: estimated,
    skipped,
    schema_check: schema.status,
    boundary: 'Lean review is read-only and checks only over-engineering complexity. It is not a correctness, security, performance, accessibility, or validation review and never applies fixes.',
    final_line: deduped.length ? `Estimated net removable lines: ${estimated}` : 'Lean already. Ship.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Lean Review',
    '',
    `Status: ${result.status}`,
    `Findings: ${result.findings_count}`,
    '',
    result.boundary,
    '',
  ];
  if (!result.findings.length) {
    lines.push(result.final_line, '');
    return lines.join('\n');
  }
  lines.push('## Findings', '');
  for (const finding of result.findings) {
    lines.push(`- ${finding.class}: ${finding.file}:${finding.line} - ${finding.title}`);
    lines.push(`  - Evidence: ${finding.evidence}`);
    lines.push(`  - Removable lines: ${finding.removable_lines}`);
  }
  if (result.skipped.length) {
    lines.push('', '## Skipped Boundaries', '');
    for (const item of result.skipped) lines.push(`- ${item.file}: ${item.reasons.join(', ')}`);
  }
  lines.push('', result.final_line, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildLeanReview(opts);
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

module.exports = {
  TAGS,
  buildLeanReview,
  findingsForFile,
  parseArgs,
  parseDiff,
  renderMarkdown,
};
