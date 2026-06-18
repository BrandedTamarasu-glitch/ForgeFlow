#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { safeReadTextFile, writeJsonSafe } = require('./file-safety');

const HOST_PROBES = [
  { host: 'Claude Code', binary: 'claude', command: '/forgeflow-lean-prime --json' },
  { host: 'Codex', binary: 'codex', command: '/forgeflow-lean-prime --json' },
  { host: 'GitHub CLI', binary: 'gh', command: 'gh copilot --help' },
  { host: 'OpenCode', binary: 'opencode', command: 'opencode --help' },
];

function usage() {
  console.error('Usage: render-lean-host-cli-probes.js [--root <repo>] [--path <PATH>] [--evidence <json>] [--write-template] [--out <json>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), path: process.env.PATH || '', evidence: '', writeTemplate: false, out: '', json: false };
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
    } else if (arg === '--write-template') {
      opts.writeTemplate = true;
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
      command: item.command || item.manual_probe || '',
      output_digest: item.output_digest || '',
    }]));
}

function evidenceState(manual) {
  const status = String(manual.status || '').toLowerCase();
  const verified = ['pass', 'verified'].includes(status);
  const hasTimestamp = /^\d{4}-\d{2}-\d{2}T/.test(String(manual.checked_at || ''));
  const hasNote = String(manual.note || '').trim().length > 0;
  const hasDigest = String(manual.output_digest || '').trim().length > 0;
  if (verified && hasTimestamp && hasNote) return hasDigest ? 'strong' : 'verified';
  if (verified) return 'thin';
  if (status) return status;
  return 'missing';
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
    const proof = evidenceState(manual);
    return {
      host: probe.host,
      binary: probe.binary,
      status: verified ? 'verified' : (executable ? 'present' : 'missing'),
      executable: executable ? path.basename(executable) : '',
      manual_probe: probe.command,
      evidence: manual,
      evidence_state: proof,
    };
  });
  const missing = probes.filter((probe) => probe.status === 'missing').length;
  const verified = probes.filter((probe) => probe.status === 'verified').length;
  const result = {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    status: missing ? 'partial' : (verified === probes.length ? 'verified' : 'ready'),
    probes,
    summary: {
      probes: probes.length,
      present: probes.length - missing,
      missing,
      verified,
      strong_evidence: probes.filter((probe) => probe.evidence_state === 'strong').length,
      thin_evidence: probes.filter((probe) => probe.evidence_state === 'thin').length,
      pending_manual: probes.filter((probe) => probe.status === 'present').length,
    },
    next: missing ? 'Install or expose missing host CLIs on PATH before manual adapter smoke checks.' : (verified === probes.length ? '/forgeflow-lean-host-command-parity' : 'Optionally record manual probe evidence with --evidence <json>.'),
    boundary: 'Lean host CLI probes are read-only. They inspect PATH for executable names and print manual probe commands, but do not launch host CLIs, install adapters, edit settings, commit, push, or call the network.',
    artifacts: {},
    evidence_requirements: [
      'manual probe command run by a developer',
      'verified or pass status',
      'checked_at ISO timestamp',
      'short note explaining observed behavior',
      'optional output_digest instead of raw host output',
    ],
  };
  if (opts.writeTemplate) {
    const out = path.resolve(opts.out || path.join(defaultProjectDir(root), 'context', 'lean-host-cli-probe-evidence.template.json'));
    const template = {
      schema_version: '1',
      generated_at: result.generated_at,
      note: 'Run each manual_probe yourself, then change status to verified or pass when behavior is confirmed.',
      probes: probes.map((probe) => ({
        host: probe.host,
        binary: probe.binary,
        manual_probe: probe.manual_probe,
        command: probe.manual_probe,
        status: probe.status === 'missing' ? 'missing' : 'pending',
        checked_at: '',
        output_digest: '',
        note: '',
      })),
    };
    writeJsonSafe(out, template);
    result.artifacts.evidence_template = out;
    result.next = `/forgeflow-lean-host-cli-probes --evidence ${out}`;
    result.boundary = 'Lean host CLI probe template writing stores only the requested local evidence template. It does not launch host CLIs, install adapters, edit settings, commit, push, or call the network.';
  }
  return result;
}

function renderMarkdown(result) {
  const lines = ['# Forgeflow Lean Host CLI Probes', '', `Status: ${result.status}`, '', result.boundary, '', '## Probes', ''];
  for (const probe of result.probes) {
    lines.push(`- ${probe.status}: ${probe.host} (${probe.binary})`);
    lines.push(`  - Manual probe: \`${probe.manual_probe}\``);
    if (probe.evidence?.note) lines.push(`  - Evidence: ${probe.evidence.note}`);
    if (probe.evidence_state && probe.evidence_state !== 'missing') lines.push(`  - Evidence state: ${probe.evidence_state}`);
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
  evidenceState,
  parseArgs,
  readEvidence,
  renderMarkdown,
};
