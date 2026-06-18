#!/usr/bin/env node
const path = require('path');
const { writeFileSafe } = require('./file-safety');
const { buildLeanBenchmarkRunner } = require('./render-lean-benchmark-runner');
const { buildLeanHostAdapters } = require('./render-lean-host-adapters');
const { buildLeanHostCommandParity } = require('./render-lean-host-command-parity');
const { buildLeanPrime } = require('./render-lean-prime');
const { buildLeanSkills } = require('./render-lean-skills');

function usage() {
  console.error('Usage: render-lean-demo-report.js [--root <repo>] [--write] [--json]');
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

function reportFiles(root) {
  const project = path.basename(root);
  const base = path.join(root, '.forgeflow', project, 'context');
  return {
    json: path.join(base, 'lean-demo-report.json'),
    markdown: path.join(base, 'lean-demo-report.md'),
  };
}

function buildLeanDemoReport(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const prime = buildLeanPrime({ root });
  const adapters = buildLeanHostAdapters({ root });
  const parity = buildLeanHostCommandParity({ root });
  const skills = buildLeanSkills({ root });
  const benchmark = buildLeanBenchmarkRunner({ root });
  const sections = [
    { id: 'prime', label: 'Lean Prime', status: prime.status, next: prime.next },
    { id: 'adapters', label: 'Host Adapters', status: adapters.status, next: adapters.next },
    { id: 'command-parity', label: 'Host Command Parity', status: parity.status, next: parity.next },
    { id: 'skills', label: 'Skills', status: skills.status, next: skills.next },
    { id: 'benchmark', label: 'Benchmark Runner', status: benchmark.status, next: benchmark.next },
  ];
  const blockers = sections.filter((section) => ['fail', 'blocked', 'missing', 'drift'].includes(section.status));
  const result = {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    status: blockers.length ? 'attention' : 'ready',
    sections,
    summary: {
      sections: sections.length,
      attention: blockers.length,
      benchmark_tasks: (benchmark.tasks || []).length,
      benchmark_arms: (benchmark.arms || []).length,
      host_adapters: adapters.summary.adapters,
      skills: skills.summary.skills,
    },
    next: blockers[0]?.next || '/forgeflow-lean-benchmark-runner --write',
    boundary: 'Lean demo reporting is read-only unless --write is supplied. It summarizes local Forgeflow artifacts and does not run model benchmarks, launch host CLIs, install adapters, commit, push, or call the network.',
  };
  if (opts.write) {
    const files = reportFiles(root);
    writeFileSafe(files.json, `${JSON.stringify(result, null, 2)}\n`);
    writeFileSafe(files.markdown, renderMarkdown(result));
    result.artifacts = files;
  }
  return result;
}

function renderMarkdown(result) {
  const lines = ['# Forgeflow Lean Demo Report', '', `Status: ${result.status}`, '', result.boundary, '', '## Sections', ''];
  for (const section of result.sections) lines.push(`- ${section.status}: ${section.label} -> ${section.next}`);
  lines.push('', '## Summary', '');
  for (const [key, value] of Object.entries(result.summary)) lines.push(`- ${key}: ${value}`);
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildLeanDemoReport(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  } catch (err) {
    console.error(`lean demo report failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  buildLeanDemoReport,
  parseArgs,
  renderMarkdown,
  reportFiles,
};
