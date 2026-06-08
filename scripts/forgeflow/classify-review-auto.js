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
  const files = Array.isArray(finding.files)
    ? finding.files.map((item) => String(item || '').replace(/\\/g, '/')).filter(Boolean)
    : [];
  const targetFiles = files.length > 0 ? files : (file ? [file] : []);
  return {
    id: String(finding.id || `finding-${index + 1}`),
    source: String(finding.source || finding.reviewer || ''),
    tier: String(finding.tier || finding.severity || '').toUpperCase(),
    title: String(finding.title || finding.summary || finding.message || ''),
    class: normalizeClass(finding.class || finding.category || finding.kind || finding.safety_class || ''),
    file: targetFiles[0] || '',
    files: targetFiles,
    line: Number(finding.line || 0),
    evidence_count: Number.isFinite(Number(finding.evidence_count)) ? Number(finding.evidence_count) : 0,
  };
}

const POLICY_VERSION = 'phase-4-read-only';

const ALLOWLIST_CLASSES = new Set([
  'docs-drift',
  'documentation',
  'formatting',
  'typo',
  'unused-import',
  'command-wrapper-argument-parity',
  'manifest-runtime-helper-parity',
  'fixture-expectation-drift',
]);

const DENYLIST_CLASSES = new Set([
  'auth',
  'permission',
  'permissions',
  'security',
  'secret',
  'secrets',
  'migration',
  'migrations',
  'dependency',
  'dependencies',
  'release-publishing',
  'settings',
  'broad-behavior-change',
  'product-judgment',
]);

function normalizeClass(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function inferClass(finding) {
  if (finding.class) return finding.class;
  const text = `${finding.tier} ${finding.title}`.toLowerCase();
  if (/\bunused import\b/.test(text)) return 'unused-import';
  if (/\btypo\b|spelling/.test(text)) return 'typo';
  if (/formatting|prettier|lint format/.test(text)) return 'formatting';
  if (/small docs|missing tiny docs note|docs?|readme|wiki/.test(text)) return 'docs-drift';
  return 'unknown';
}

function riskyFile(file) {
  const lower = String(file || '').toLowerCase();
  return /(^|\/)(migrations?|db\/migrations?)\//.test(lower)
    || /(^|\/)\.env/.test(lower)
    || /secret|credential|private-key|certificate/.test(lower)
    || /(^|\/)(auth|session|permissions?|tenants?)\//.test(lower)
    || /settings\.json$/.test(lower);
}

function packageFile(file) {
  const lower = String(file || '').toLowerCase();
  return lower.endsWith('package.json')
    || lower.endsWith('package-lock.json')
    || lower.endsWith('pnpm-lock.yaml')
    || lower.endsWith('yarn.lock');
}

function isSafeClass(finding) {
  return ALLOWLIST_CLASSES.has(inferClass(finding));
}

function securityClass(finding) {
  const text = `${finding.source} ${finding.title} ${finding.file}`.toLowerCase();
  return /warden|security|auth|permission|token|secret|crypto|session|tenant|migration|schema|dependency/.test(text);
}

function policyDecision(item) {
  const findingClass = inferClass(item);
  const reasons = [];
  const matchedRules = [];
  const denylistedClass = DENYLIST_CLASSES.has(findingClass);
  const allowlistedClass = ALLOWLIST_CLASSES.has(findingClass);
  const files = item.files || [];
  const hasRiskyFile = files.some(riskyFile);
  const hasPackageFile = files.some(packageFile);
  const multiFile = files.length !== 1;
  const highRiskSource = securityClass({ ...item, class: findingClass });
  if (!item.file) {
    matchedRules.push('missing-single-target-file');
    reasons.push('No single target file was supplied.');
    return { bucket: 'blocker', proposal_allowed: false, reasons, matched_rules: matchedRules, class: findingClass };
  }
  if (multiFile) {
    matchedRules.push('multi-file-finding');
    reasons.push('Finding spans multiple files and needs human planning before auto-fix.');
    return { bucket: 'risky', proposal_allowed: false, reasons, matched_rules: matchedRules, class: findingClass };
  }
  if (denylistedClass || hasRiskyFile || hasPackageFile) {
    if (denylistedClass) matchedRules.push(`denylist-class:${findingClass}`);
    if (hasRiskyFile) matchedRules.push('denylist-file-risk');
    if (hasPackageFile) matchedRules.push('denylist-dependency-file');
    reasons.push('Denylisted class or file surface requires human approval before any fix proposal.');
    return { bucket: 'blocker', proposal_allowed: false, reasons, matched_rules: matchedRules, class: findingClass };
  }
  if (highRiskSource) {
    matchedRules.push('high-risk-source-or-text');
    reasons.push('Security, auth, permission, schema, or dependency-adjacent finding needs human judgment.');
    return { bucket: 'risky', proposal_allowed: false, reasons, matched_rules: matchedRules, class: findingClass };
  }
  if (!allowlistedClass) {
    matchedRules.push(`unknown-or-unapproved-class:${findingClass}`);
    reasons.push('Finding class is not in the deterministic review-auto allowlist.');
    return { bucket: 'risky', proposal_allowed: false, reasons, matched_rules: matchedRules, class: findingClass };
  }
  matchedRules.push(`allowlist-class:${findingClass}`);
  reasons.push('Allowlisted single-file low-risk class can be planned as a sandbox proposal.');
  return { bucket: 'safe', proposal_allowed: true, reasons, matched_rules: matchedRules, class: findingClass };
}

function classifyFinding(finding, index = 0) {
  const item = normalizeFinding(finding, index);
  const policy = policyDecision(item);
  return {
    ...item,
    class: policy.class,
    bucket: policy.bucket,
    auto_apply: policy.bucket === 'safe',
    proposal_allowed: policy.proposal_allowed,
    reason: policy.reasons.join(' '),
    policy: {
      version: POLICY_VERSION,
      class: policy.class,
      proposal_allowed: policy.proposal_allowed,
      sandbox_required: policy.proposal_allowed,
      matched_rules: policy.matched_rules,
      reasons: policy.reasons,
    },
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
    policy: {
      version: POLICY_VERSION,
      allowlist_classes: [...ALLOWLIST_CLASSES].sort(),
      denylist_classes: [...DENYLIST_CLASSES].sort(),
      boundary: 'Safe means eligible for a future sandbox proposal only. This classifier never applies fixes.',
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
    lines.push(`  - Class: ${item.class}`);
    lines.push(`  - Proposal allowed: ${item.proposal_allowed ? 'yes' : 'no'}`);
    lines.push(`  - Reason: ${item.reason}`);
    lines.push(`  - Rules: ${item.policy.matched_rules.join(', ')}`);
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

module.exports = { classifyFinding, classifyReviewAuto, normalizeFinding, parseArgs, renderMarkdown };
