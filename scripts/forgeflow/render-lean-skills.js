#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { writeFileSafe } = require('./file-safety');
const { buildPortableRule } = require('./lean-rule-builder');

const SKILLS = [
  {
    name: 'forgeflow-lean',
    description: 'Apply compact Forgeflow lean guidance before coding while preserving safety and explicit requirements.',
    command: '/forgeflow-lean-prime',
  },
  {
    name: 'forgeflow-lean-review',
    description: 'Review the current diff for over-building, needless abstractions, and missed reuse opportunities.',
    command: '/forgeflow-lean-review',
  },
  {
    name: 'forgeflow-lean-audit',
    description: 'Audit the repository for over-engineering, needless dependencies, and deferred lean debt.',
    command: '/forgeflow-lean-audit',
  },
  {
    name: 'forgeflow-lean-debt',
    description: 'Collect lean markers, known ceilings, and upgrade triggers into a local debt ledger.',
    command: '/forgeflow-lean-debt',
  },
  {
    name: 'forgeflow-lean-prime',
    description: 'Show the first-run path that makes lean mode evidence ready for context-pack injection.',
    command: '/forgeflow-lean-prime',
  },
];

function usage() {
  console.error('Usage: render-lean-skills.js [--root <repo>] [--write] [--json]');
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

function skillPath(root, name) {
  return path.join(root, 'skills', name, 'SKILL.md');
}

function skillText(skill) {
  return [
    '---',
    `name: ${skill.name}`,
    `description: ${skill.description}`,
    '---',
    '',
    buildPortableRule({ profile: 'balanced', heading: `# ${skill.name}`, source: 'generated-skill' }).trim(),
    '',
    '## Command',
    '',
    `Run \`${skill.command}\` when this host supports Forgeflow slash commands. If slash commands are unavailable, apply the guidance above directly and keep the same read-only boundaries.`,
    '',
  ].join('\n');
}

function buildLeanSkills(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const skills = SKILLS.map((skill) => {
    const file = skillPath(root, skill.name);
    const expected = skillText(skill);
    const actual = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '';
    const current = actual.trim() === expected.trim();
    if (opts.write && !current) writeFileSafe(file, expected);
    return {
      name: skill.name,
      file,
      command: skill.command,
      status: opts.write || current ? 'pass' : (actual ? 'drift' : 'missing'),
      bytes: Buffer.byteLength(expected),
    };
  });
  const failures = skills.filter((item) => item.status !== 'pass').length;
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    status: failures ? 'drift' : 'pass',
    skills,
    summary: { skills: skills.length, failures },
    next: failures ? '/forgeflow-lean-skills --write' : '/forgeflow-lean-prime',
    boundary: 'Lean skill generation is read-only unless --write is supplied. It writes only committed skills/forgeflow-lean*/SKILL.md files and does not install skills, edit settings, commit, push, or call the network.',
  };
}

function renderMarkdown(result) {
  const lines = ['# Forgeflow Lean Skills', '', `Status: ${result.status}`, '', result.boundary, '', '## Skills', ''];
  for (const skill of result.skills) lines.push(`- ${skill.status}: ${skill.name} (${skill.command})`);
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildLeanSkills(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
    if (result.status !== 'pass') process.exit(1);
  } catch (err) {
    console.error(`lean skills failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  SKILLS,
  buildLeanSkills,
  parseArgs,
  renderMarkdown,
  skillText,
};
