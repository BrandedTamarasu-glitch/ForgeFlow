#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildLeanRule, buildPortableRule } = require('./lean-rule-builder');
const { buildLeanSession } = require('./render-lean-session');
const { TARGETS } = require('./render-lean-portability-pack');

const INVARIANTS = [
  { name: 'trust-boundary validation', phrases: ['trust-boundary validation'] },
  { name: 'data-loss prevention', phrases: ['data-loss prevention'] },
  { name: 'security', phrases: ['security'] },
  { name: 'accessibility', phrases: ['accessibility'] },
  { name: 'explicit requirements', phrases: ['explicit requirements'] },
  { name: 'calibration tuning', phrases: ['calibration/tuning knobs', 'calibration'] },
  { name: 'one runnable check', phrases: ['one focused check', 'one runnable check'] },
  { name: 'stdlib native reuse ladder', phrases: ['stdlib', 'native platform', 'installed dependencies'] },
];

function usage() {
  console.error('Usage: render-lean-rule-canary.js [--root <repo>] [--json]');
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

function includesAny(text, phrases) {
  const lower = String(text || '').toLowerCase();
  return phrases.some((phrase) => lower.includes(String(phrase).toLowerCase()));
}

function sourceTexts(root) {
  const session = buildLeanSession({ root, projectDir: path.join(root, '.forgeflow', path.basename(root)), profile: 'balanced' });
  return [
    { name: 'canonical-rule', text: buildLeanRule('balanced') },
    { name: 'session-rule', text: session.instructions },
    { name: 'readme', text: fs.readFileSync(path.join(root, 'README.md'), 'utf8') },
    { name: 'workflow-docs', text: fs.readFileSync(path.join(root, 'docs', 'wiki', 'Workflow-Commands.md'), 'utf8') },
    {
      name: 'portability-targets',
      text: TARGETS.map((target) => buildPortableRule({
        profile: 'balanced',
        heading: target.heading,
        source: 'canary',
      })).join('\n'),
    },
  ];
}

function buildLeanRuleCanary(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const sources = sourceTexts(root);
  const checks = [];
  for (const invariant of INVARIANTS) {
    for (const source of sources) {
      checks.push({
        name: `${source.name}: ${invariant.name}`,
        status: includesAny(source.text, invariant.phrases) ? 'pass' : 'fail',
        phrases: invariant.phrases,
      });
    }
  }
  const failures = checks.filter((item) => item.status === 'fail').length;
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    status: failures ? 'fail' : 'pass',
    checks,
    summary: { checks: checks.length, failures },
    next: failures ? 'Restore missing lean rule invariants or intentionally update the canary.' : '/forgeflow-lean-session',
    boundary: 'Lean rule canary is read-only. It checks local canonical rules and docs for load-bearing invariant phrases but does not rewrite adapters or docs.',
  };
}

function renderMarkdown(result) {
  const lines = ['# Forgeflow Lean Rule Canary', '', `Status: ${result.status}`, '', result.boundary, '', '## Checks', ''];
  for (const item of result.checks) lines.push(`- ${item.status}: ${item.name}`);
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildLeanRuleCanary(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
    if (result.status === 'fail') process.exit(1);
  } catch (err) {
    console.error(`lean rule canary failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  INVARIANTS,
  buildLeanRuleCanary,
  parseArgs,
  renderMarkdown,
};
