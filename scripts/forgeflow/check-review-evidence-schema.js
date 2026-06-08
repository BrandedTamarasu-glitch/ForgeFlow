#!/usr/bin/env node
const path = require('path');
const { safeReadTextFile } = require('./file-safety');

function usage() {
  console.error('Usage: check-review-evidence-schema.js --findings <json> [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { findings: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--findings') {
      opts.findings = path.resolve(requireValue(argv, arg, i));
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
  if (!opts.findings) throw new Error('Missing --findings');
  return opts;
}

function readFindings(file) {
  const parsed = JSON.parse(safeReadTextFile(file, path.dirname(file)).content);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.findings)) return parsed.findings;
  throw new Error('Findings JSON must be an array or contain findings[]');
}

function normalizeFinding(finding = {}, index = 0) {
  const file = String(finding.file || finding.path || finding.target_file || '').replace(/\\/g, '/');
  const files = Array.isArray(finding.files)
    ? finding.files.map((item) => String(item || '').replace(/\\/g, '/')).filter(Boolean)
    : [];
  const targetFiles = files.length > 0 ? files : (file ? [file] : []);
  return {
    id: String(finding.id || `finding-${index + 1}`),
    source: String(finding.source || finding.reviewer || ''),
    tier: String(finding.tier || finding.severity || ''),
    title: String(finding.title || finding.summary || finding.message || ''),
    class: String(finding.class || finding.category || finding.kind || finding.safety_class || ''),
    file: targetFiles[0] || '',
    files: targetFiles,
    line: Number(finding.line || 0),
  };
}

function checkReviewEvidenceSchema(findings = []) {
  const items = findings.map((finding, index) => {
    const normalized = normalizeFinding(finding, index);
    const issues = [];
    if (!normalized.title) issues.push('missing-title');
    if (!normalized.file) issues.push('missing-file');
    if (!normalized.source) issues.push('missing-source');
    if (!normalized.tier) issues.push('missing-tier');
    for (const file of normalized.files) {
      if (path.isAbsolute(file)) issues.push('absolute-file-path');
      if (file.includes('..')) issues.push('parent-path-segment');
    }
    if (normalized.files.length > 1) issues.push('multi-file-finding');
    if (/(secret|token|password|private[_-]?key)["']?\s*[:=]/i.test(JSON.stringify(finding))) issues.push('possible-secret-material');
    return { ...normalized, status: issues.length ? 'attention' : 'pass', issues };
  });
  const issueCount = items.reduce((sum, item) => sum + item.issues.length, 0);
  return {
    schema_version: '1',
    status: issueCount > 0 ? 'attention' : 'pass',
    findings: items.length,
    issue_count: issueCount,
    items,
    boundary: 'Review evidence schema check is read-only. It validates shape and obvious safety hazards, but it does not prove reviewer findings are correct.',
  };
}

function buildReviewEvidenceSchemaCheck(opts = {}) {
  return {
    ...checkReviewEvidenceSchema(readFindings(path.resolve(opts.findings))),
    findings_file: path.resolve(opts.findings),
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Review Evidence Schema',
    '',
    `Status: ${result.status}`,
    `Findings: ${result.findings}`,
    `Issues: ${result.issue_count}`,
    '',
    result.boundary,
    '',
  ];
  for (const item of result.items) {
    lines.push(`- ${item.status}: ${item.id} ${item.file || '(no file)'}`);
    if (item.issues.length) lines.push(`  - Issues: ${item.issues.join(', ')}`);
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildReviewEvidenceSchemaCheck(opts);
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
  buildReviewEvidenceSchemaCheck,
  checkReviewEvidenceSchema,
  normalizeFinding,
  parseArgs,
  readFindings,
  renderMarkdown,
};
