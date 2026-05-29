#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { safeReadTextFile } = require('./file-safety');

function usage() {
  console.error('Usage: classify-review-auto.js --findings <json> [--json]');
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
  const content = safeReadTextFile(file, path.dirname(file)).content;
  const parsed = JSON.parse(content);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.findings)) return parsed.findings;
  throw new Error('Findings JSON must be an array or contain findings[]');
}

function normalizeFinding(finding = {}, index = 0) {
  const file = String(finding.file || finding.path || finding.target_file || '').replace(/\\/g, '/');
  return {
    id: String(finding.id || `finding-${index + 1}`),
    source: String(finding.source || finding.reviewer || ''),
    tier: String(finding.tier || finding.severity || '').toUpperCase(),
    title: String(finding.title || finding.summary || finding.message || ''),
    file,
    line: Number(finding.line || 0),
  };
}

function riskyFile(file) {
  const lower = String(file || '').toLowerCase();
  return /(^|\/)(migrations?|db\/migrations?)\//.test(lower)
    || /(^|\/)\.env/.test(lower)
    || /secret|credential|private-key|certificate/.test(lower);
}

function packageFile(file) {
  const lower = String(file || '').toLowerCase();
  return lower.endsWith('package.json')
    || lower.endsWith('package-lock.json')
    || lower.endsWith('pnpm-lock.yaml')
    || lower.endsWith('yarn.lock');
}

function isSafeClass(finding) {
  const text = `${finding.tier} ${finding.title}`.toLowerCase();
  return /\bnit\b|typo|formatting|unused import|small docs|missing tiny docs note/.test(text);
}

function securityClass(finding) {
  const text = `${finding.source} ${finding.title} ${finding.file}`.toLowerCase();
  return /warden|security|auth|permission|token|secret|crypto|session|tenant|migration|schema|dependency/.test(text);
}

function classifyFinding(finding, index = 0) {
  const item = normalizeFinding(finding, index);
  let bucket = 'risky';
  let reason = 'Finding needs human judgment before auto-fix.';
  if (!item.file) {
    bucket = 'blocker';
    reason = 'No single target file was supplied.';
  } else if (riskyFile(item.file) || securityClass(item)) {
    bucket = riskyFile(item.file) ? 'blocker' : 'risky';
    reason = 'Security, dependency, migration, secret, or other risky surface.';
  } else if (packageFile(item.file)) {
    bucket = 'risky';
    reason = 'Package or dependency file requires human judgment before auto-fix.';
  } else if (isSafeClass(item)) {
    bucket = 'safe';
    reason = 'Single-file low-risk finding class.';
  }
  return {
    ...item,
    bucket,
    auto_apply: bucket === 'safe',
    reason,
  };
}

function classifyReviewAuto(findings) {
  const items = findings.map(classifyFinding);
  return {
    schema_version: '1',
    status: items.some((item) => item.bucket === 'blocker') ? 'blocked' : 'classified',
    counts: {
      safe: items.filter((item) => item.bucket === 'safe').length,
      risky: items.filter((item) => item.bucket === 'risky').length,
      blocker: items.filter((item) => item.bucket === 'blocker').length,
    },
    items,
    boundary: 'Read-only classifier. It does not edit, commit, push, or dispatch workers.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Review-Auto Classifier',
    '',
    `Status: ${result.status}`,
    `Safe: ${result.counts.safe}`,
    `Risky: ${result.counts.risky}`,
    `Blocker: ${result.counts.blocker}`,
    '',
    result.boundary,
    '',
  ];
  for (const item of result.items) {
    lines.push(`- ${item.bucket}: ${item.id} ${item.file || '(no file)'}`);
    lines.push(`  - Reason: ${item.reason}`);
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = classifyReviewAuto(readFindings(opts.findings));
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

module.exports = { classifyFinding, classifyReviewAuto, parseArgs, renderMarkdown };
