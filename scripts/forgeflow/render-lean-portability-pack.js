#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { writeFileSafe } = require('./file-safety');
const { buildLeanSession } = require('./render-lean-session');

const TARGETS = [
  { name: 'agents', file: 'AGENTS-lean.md', heading: '# Forgeflow Lean Agent Rules' },
  { name: 'cursor', file: 'cursor-lean.mdc', heading: '# Forgeflow Lean Cursor Rule' },
  { name: 'windsurf', file: 'windsurf-lean.md', heading: '# Forgeflow Lean Windsurf Rule' },
  { name: 'copilot', file: 'copilot-instructions-lean.md', heading: '# Forgeflow Lean Copilot Instructions' },
  { name: 'generic-skill', file: 'forgeflow-lean-skill.md', heading: '# Forgeflow Lean Skill' },
];

function usage() {
  console.error('Usage: render-lean-portability-pack.js [--root <repo>] [--project-dir <dir>] [--profile lite|off|balanced|strict|ultra] [--write] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', profile: '', write: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--profile') {
      opts.profile = requireValue(argv, arg, i);
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

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function outDir(projectDir) {
  return path.join(projectDir, 'lean-portability');
}

function targetText(target, session) {
  return [
    target.heading,
    '',
    `Profile: ${session.profile}`,
    `Source: ${session.source}`,
    '',
    session.boundary,
    '',
    session.instructions,
    '',
  ].join('\n');
}

function existingStatus(file, expected) {
  if (!fs.existsSync(file)) return 'missing';
  const actual = fs.readFileSync(file, 'utf8');
  return actual === expected ? 'current' : 'drift';
}

function buildLeanPortabilityPack(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const session = buildLeanSession({ root, projectDir, profile: opts.profile || '' });
  const dir = outDir(projectDir);
  const targets = TARGETS.map((target) => {
    const file = path.join(dir, target.file);
    const content = targetText(target, session);
    if (opts.write) writeFileSafe(file, content);
    return {
      name: target.name,
      path: file,
      status: opts.write ? 'written' : existingStatus(file, content),
      bytes: Buffer.byteLength(content),
    };
  });
  const drift = targets.filter((target) => target.status === 'drift').length;
  const missing = targets.filter((target) => target.status === 'missing').length;
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    status: opts.write || (!drift && !missing) ? 'pass' : (drift ? 'drift' : 'missing'),
    root,
    project_dir: projectDir,
    profile: session.profile,
    out_dir: dir,
    targets,
    summary: { targets: targets.length, drift, missing },
    next: opts.write ? '/forgeflow-lean-portability' : '/forgeflow-lean-portability --write',
    boundary: 'Lean portability pack is read-only unless --write is supplied. Writes stay inside .forgeflow/<project>/lean-portability and do not edit global agent settings.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Lean Portability Pack',
    '',
    `Status: ${result.status}`,
    `Profile: ${result.profile}`,
    `Output: ${result.out_dir}`,
    '',
    result.boundary,
    '',
    '## Targets',
    '',
  ];
  for (const target of result.targets) lines.push(`- ${target.status}: ${target.name} (${target.path})`);
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildLeanPortabilityPack(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  } catch (err) {
    console.error(`lean portability pack failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  TARGETS,
  buildLeanPortabilityPack,
  parseArgs,
  renderMarkdown,
};
