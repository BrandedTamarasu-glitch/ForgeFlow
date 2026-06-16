#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildPortableRule } = require('./lean-rule-builder');

const COPIES = [
  { host: 'Cursor', file: '.cursor/rules/forgeflow-lean.mdc', heading: '# Forgeflow Lean Cursor Rule', strip: 'frontmatter' },
  { host: 'Windsurf', file: '.windsurf/rules/forgeflow-lean.md', heading: '# Forgeflow Lean Windsurf Rule' },
  { host: 'Cline', file: '.clinerules/forgeflow-lean.md', heading: '# Forgeflow Lean Cline Rule' },
  { host: 'GitHub Copilot', file: '.github/copilot-instructions.md', heading: '# Forgeflow Lean Copilot Instructions' },
  { host: 'Kiro', file: '.kiro/steering/forgeflow-lean.md', heading: '# Forgeflow Lean Kiro Steering' },
  { host: 'OpenClaw', file: '.openclaw/skills/forgeflow-lean/SKILL.md', heading: '# Forgeflow Lean OpenClaw Skill', strip: 'frontmatter' },
];

const INVARIANTS = [
  'security',
  'accessibility',
  'trust-boundary validation',
  'data-loss prevention',
  'explicit requirements',
  'calibration/tuning knobs',
  'one focused check',
];

function usage() {
  console.error('Usage: render-lean-adapter-drift.js [--root <repo>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
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

function stripFrontmatter(text) {
  return String(text || '').replace(/^---\n[\s\S]*?\n---\n*/, '');
}

function normalize(text, mode) {
  const source = mode === 'frontmatter' ? stripFrontmatter(text) : String(text || '');
  return source.replace(/\r\n/g, '\n').trim();
}

function expected(copy) {
  return buildPortableRule({ profile: 'balanced', heading: copy.heading, source: 'committed-adapter' }).trim();
}

function checkCopy(root, copy) {
  const file = path.join(root, copy.file);
  if (!fs.existsSync(file)) {
    return {
      host: copy.host,
      file: copy.file,
      status: 'fail',
      reason: 'Committed adapter copy is missing.',
      missing_invariants: INVARIANTS,
    };
  }
  const actual = normalize(fs.readFileSync(file, 'utf8'), copy.strip);
  const wanted = expected(copy);
  const missing = INVARIANTS.filter((phrase) => !actual.toLowerCase().includes(phrase.toLowerCase()));
  return {
    host: copy.host,
    file: copy.file,
    status: actual === wanted && missing.length === 0 ? 'pass' : 'fail',
    reason: actual === wanted ? 'Copy matches canonical generated lean rule.' : 'Copy drifted from canonical generated lean rule.',
    bytes: Buffer.byteLength(actual),
    expected_bytes: Buffer.byteLength(wanted),
    missing_invariants: missing,
  };
}

function buildLeanAdapterDrift(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const copies = COPIES.map((copy) => checkCopy(root, copy));
  const failures = copies.filter((item) => item.status === 'fail').length;
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    status: failures ? 'fail' : 'pass',
    copies,
    summary: { copies: copies.length, failures },
    next: failures ? 'Regenerate or update committed lean adapter copies from lean-rule-builder.js.' : '/forgeflow-lean-host-adapters',
    boundary: 'Lean adapter drift is read-only. It compares committed adapter instruction copies with canonical generated lean rules but does not rewrite files, install adapters, commit, push, or call the network.',
  };
}

function renderMarkdown(result) {
  const lines = ['# Forgeflow Lean Adapter Drift', '', `Status: ${result.status}`, '', result.boundary, '', '## Copies', ''];
  for (const item of result.copies) lines.push(`- ${item.status}: ${item.host} (${item.file}) - ${item.reason}`);
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildLeanAdapterDrift(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
    if (result.status === 'fail') process.exit(1);
  } catch (err) {
    console.error(`lean adapter drift failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  COPIES,
  INVARIANTS,
  buildLeanAdapterDrift,
  parseArgs,
  renderMarkdown,
};
