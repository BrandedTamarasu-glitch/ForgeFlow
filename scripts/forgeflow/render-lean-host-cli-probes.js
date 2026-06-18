#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { safeReadTextFile } = require('./file-safety');

const HOST_PROBES = [
  { host: 'Claude Code', binary: 'claude', command: '/forgeflow-lean-prime --json' },
  { host: 'Codex', binary: 'codex', command: '/forgeflow-lean-prime --json' },
  { host: 'GitHub CLI', binary: 'gh', command: 'gh copilot --help' },
  { host: 'OpenCode', binary: 'opencode', command: 'opencode --help' },
];

function usage() {
  console.error('Usage: render-lean-host-cli-probes.js [--root <repo>] [--path <PATH>] [--evidence <json>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), path: process.env.PATH || '', evidence: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--path') {
      opts.path = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--evidence') {
      opts.evidence = path.resolve(requireValue(argv, arg, i));
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

function readEvidence(root, evidenceFile) {
  if (!evidenceFile) return {};
  const parsed = JSON.parse(safeReadTextFile(evidenceFile, root).content);
  const list = Array.isArray(parsed.probes) ? parsed.probes : [];
  return Object.fromEntries(list
    .filter((item) => item && item.binary)
    .map((item) => [item.binary, {
      status: item.status || '',
      checked_at: item.checked_at || '',
      note: item.note || '',
    }]));
}

function isExecutable(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findOnPath(binary, pathValue) {
  const dirs = String(pathValue || '').split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const candidate = path.join(dir, binary);
    if (isExecutable(candidate)) return candidate;
  }
  return '';
}

function buildLeanHostCliProbes(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const pathValue = opts.path === undefined ? process.env.PATH || '' : opts.path;
  const evidence = readEvidence(root, opts.evidence || '');
  const probes = HOST_PROBES.map((probe) => {
    const executable = findOnPath(probe.binary, pathValue);
    const manual = evidence[probe.binary] || {};
    const verified = ['pass', 'verified'].includes(String(manual.status || '').toLowerCase());
    return {
      host: probe.host,
      binary: probe.binary,
      status: verified ? 'verified' : (executable ? 'present' : 'missing'),
      executable: executable ? path.basename(executable) : '',
      manual_probe: probe.command,
      evidence: manual,
    };
  });
  const missing = probes.filter((probe) => probe.status === 'missing').length;
  const verified = probes.filter((probe) => probe.status === 'verified').length;
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    status: missing ? 'partial' : (verified === probes.length ? 'verified' : 'ready'),
    probes,
    summary: { probes: probes.length, present: probes.length - missing, missing, verified },
    next: missing ? 'Install or expose missing host CLIs on PATH before manual adapter smoke checks.' : (verified === probes.length ? '/forgeflow-lean-host-command-parity' : 'Optionally record manual probe evidence with --evidence <json>.'),
    boundary: 'Lean host CLI probes are read-only. They inspect PATH for executable names and print manual probe commands, but do not launch host CLIs, install adapters, edit settings, commit, push, or call the network.',
  };
}

function renderMarkdown(result) {
  const lines = ['# Forgeflow Lean Host CLI Probes', '', `Status: ${result.status}`, '', result.boundary, '', '## Probes', ''];
  for (const probe of result.probes) {
    lines.push(`- ${probe.status}: ${probe.host} (${probe.binary})`);
    lines.push(`  - Manual probe: \`${probe.manual_probe}\``);
    if (probe.evidence?.note) lines.push(`  - Evidence: ${probe.evidence.note}`);
  }
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildLeanHostCliProbes(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  } catch (err) {
    console.error(`lean host CLI probes failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  HOST_PROBES,
  buildLeanHostCliProbes,
  findOnPath,
  parseArgs,
  readEvidence,
  renderMarkdown,
};
