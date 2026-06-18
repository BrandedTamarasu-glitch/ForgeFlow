#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { writeFileSafe } = require('./file-safety');

const SKILLS = [
  { name: 'forgeflow-plan', command: '/plan', description: 'Build a phased implementation plan with validation and scope boundaries.' },
  { name: 'forgeflow-implement', command: '/implement', description: 'Implement from the current Forgeflow brief and carry validation through integration.' },
  { name: 'forgeflow-review', command: '/review', description: 'Run Forgeflow review with evidence-first findings and validation follow-up.' },
  { name: 'forgeflow-audit', command: '/audit', description: 'Run a deep Forgeflow audit for architecture, security, and maintainability risks.' },
  { name: 'forgeflow-ship', command: '/ship', description: 'Prepare release handoff, verification, and shipping evidence.' },
];

function usage() {
  console.error('Usage: render-forgeflow-skills.js [--root <repo>] [--write] [--json]');
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

function skillText(skill) {
  return [
    '---',
    `name: ${skill.name}`,
    `description: ${skill.description}`,
    '---',
    '',
    `# ${skill.name}`,
    '',
    'Use this skill when the host supports skill discovery but not Forgeflow slash-command browsing.',
    '',
    `Run \`${skill.command}\` in Forgeflow-enabled hosts. If slash commands are unavailable, follow the same objective manually and preserve current user instructions, local evidence, validation, security, accessibility, and repository boundaries.`,
    '',
    'Do not commit, push, install dependencies, edit host settings, call the network, or launch long-running services unless the user explicitly asks or the command workflow requires it.',
    '',
  ].join('\n');
}

function skillFile(root, skill) {
  return path.join(root, 'skills', skill.name, 'SKILL.md');
}

function buildForgeflowSkills(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const skills = SKILLS.map((skill) => {
    const file = skillFile(root, skill);
    const expected = skillText(skill);
    const actual = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '';
    const current = actual.trim() === expected.trim();
    if (opts.write && !current) writeFileSafe(file, expected);
    return {
      name: skill.name,
      file,
      command: skill.command,
      status: opts.write || current ? 'pass' : (actual ? 'drift' : 'missing'),
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
    next: failures ? '/forgeflow-skills --write' : '/forgeflow-health',
    boundary: 'Forgeflow skill generation is read-only unless --write is supplied. It writes only committed skills/forgeflow-*/SKILL.md files and does not install skills, edit host settings, commit, push, or call the network.',
  };
}

function renderMarkdown(result) {
  const lines = ['# Forgeflow Skills', '', `Status: ${result.status}`, '', result.boundary, '', '## Skills', ''];
  for (const skill of result.skills) lines.push(`- ${skill.status}: ${skill.name} (${skill.command})`);
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildForgeflowSkills(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
    if (result.status !== 'pass') process.exit(1);
  } catch (err) {
    console.error(`forgeflow skills failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  SKILLS,
  buildForgeflowSkills,
  parseArgs,
  renderMarkdown,
  skillText,
};
