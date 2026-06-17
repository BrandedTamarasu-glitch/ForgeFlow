#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { writeFileSafe } = require('./file-safety');
const { buildPortableRule } = require('./lean-rule-builder');

const SKILL_PATH = path.join('.openclaw', 'skills', 'forgeflow-lean', 'SKILL.md');

function usage() {
  console.error('Usage: render-lean-openclaw-skill.js [--root <repo>] [--write] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), write: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--write') {
      opts.write = true;
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

function skillText() {
  return [
    '---',
    'name: forgeflow-lean',
    'description: Apply Forgeflow lean advisory guidance to coding tasks without changing workflow policy.',
    '---',
    '',
    buildPortableRule({ profile: 'balanced', heading: '# Forgeflow Lean OpenClaw Skill', source: 'committed-adapter' }).trim(),
    '',
  ].join('\n');
}

function buildLeanOpenClawSkill(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const file = path.join(root, SKILL_PATH);
  const expected = skillText();
  const exists = fs.existsSync(file);
  const actual = exists ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '';
  const current = actual.trim() === expected.trim();
  if (opts.write && !current) writeFileSafe(file, expected);
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    file,
    status: opts.write || current ? 'pass' : 'drift',
    current: opts.write ? true : current,
    bytes: Buffer.byteLength(expected),
    next: opts.write || current ? '/forgeflow-lean-adapter-drift' : '/forgeflow-lean-openclaw-skill --write',
    boundary: 'Lean OpenClaw skill generation is read-only unless --write is supplied. It writes only the committed OpenClaw lean skill and does not install adapters, commit, push, or call the network.',
  };
}

function renderMarkdown(result) {
  return [
    '# Forgeflow Lean OpenClaw Skill',
    '',
    `Status: ${result.status}`,
    `File: ${result.file}`,
    '',
    result.boundary,
    '',
    `Next: ${result.next}`,
    '',
  ].join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildLeanOpenClawSkill(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
    if (result.status === 'drift') process.exit(1);
  } catch (err) {
    console.error(`lean openclaw skill failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  SKILL_PATH,
  buildLeanOpenClawSkill,
  parseArgs,
  renderMarkdown,
  skillText,
};
