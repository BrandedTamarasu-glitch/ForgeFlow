#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { classifyReviewAuto } = require('./classify-review-auto');
const { checkReviewEvidenceSchema } = require('./check-review-evidence-schema');
const { safeReadTextFile, writeFileSafe } = require('./file-safety');

function usage() {
  console.error('Usage: render-review-auto-evidence.js --findings <json> [--project-dir <dir>] [--out <path>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { projectDir: '', findings: '', out: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--findings') {
      opts.findings = path.resolve(requireValue(argv, arg, i));
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

function defaultProjectDir(root = process.cwd()) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function defaultOut(projectDir) {
  return path.join(projectDir, 'review-auto-evidence.md');
}

function assertInsideProjectDir(file, projectDir, label) {
  const root = path.resolve(projectDir);
  const resolved = path.resolve(file);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`${label} must stay inside --project-dir`);
  }
  return resolved;
}

function buildReviewAutoEvidence(opts = {}) {
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir());
  const findingsFile = path.resolve(opts.findings);
  const findings = readFindings(findingsFile);
  const schema = checkReviewEvidenceSchema(findings);
  const classification = classifyReviewAuto(findings);
  const result = {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    project_dir: projectDir,
    findings_file: findingsFile,
    status: classification.status,
    evidence_schema: {
      status: schema.status,
      issue_count: schema.issue_count,
    },
    policy: classification.policy,
    counts: classification.counts,
    safe_items: classification.items.filter((item) => item.bucket === 'safe'),
    risky_items: classification.items.filter((item) => item.bucket === 'risky'),
    blocker_items: classification.items.filter((item) => item.bucket === 'blocker'),
    next: classification.counts.safe > 0 ? '/review-auto --dry-run' : '/review',
    next_reason: classification.counts.safe > 0
      ? 'Dry-run review-auto before applying any safe fixes.'
      : 'Run or rerun review because no auto-fixable evidence was found.',
    boundary: 'Review-auto evidence is local and read-only. It records classification rationale only; it does not edit files, dispatch agents, commit, or push.',
  };
  const out = assertInsideProjectDir(opts.out || defaultOut(projectDir), projectDir, '--out');
  if (opts.write !== false) writeFileSafe(out, renderMarkdown(result));
  return { ...result, out };
}

function renderBucket(title, items) {
  const lines = [`## ${title}`, ''];
  if (items.length === 0) lines.push('- None.');
  else for (const item of items) {
    lines.push(`- ${item.id}: ${item.file || '(no file)'}`);
    lines.push(`  - Class: ${item.class}`);
    lines.push(`  - Proposal allowed: ${item.proposal_allowed ? 'yes' : 'no'}`);
    lines.push(`  - Sandbox required: ${item.policy.sandbox_required ? 'yes' : 'no'}`);
    lines.push(`  - Reason: ${item.reason}`);
    lines.push(`  - Rules: ${item.policy.matched_rules.join(', ')}`);
  }
  return lines;
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Review-Auto Evidence',
    '',
    `Status: ${result.status}`,
    `Evidence schema: ${result.evidence_schema.status} (${result.evidence_schema.issue_count} issue(s))`,
    `Policy: ${result.policy.version}`,
    `Safe: ${result.counts.safe}`,
    `Risky: ${result.counts.risky}`,
    `Blocker: ${result.counts.blocker}`,
    '',
    result.boundary,
    '',
    ...renderBucket('Safe', result.safe_items),
    '',
    ...renderBucket('Risky', result.risky_items),
    '',
    ...renderBucket('Blockers', result.blocker_items),
    '',
    `Next: ${result.next}`,
    `Why: ${result.next_reason}`,
    '',
  ];
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildReviewAutoEvidence(opts);
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

module.exports = { buildReviewAutoEvidence, parseArgs, renderMarkdown };
