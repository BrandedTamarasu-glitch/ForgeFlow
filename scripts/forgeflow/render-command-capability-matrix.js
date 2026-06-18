#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { safeReadTextFile } = require('./file-safety');
const { commandNames } = require('./runtime-inventory');
const { HOST_PARITY_POLICY } = require('./render-lean-host-command-parity');

function usage() {
  console.error('Usage: render-command-capability-matrix.js [--root <repo>] [--json]');
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

function exists(root, file) {
  return fs.existsSync(path.join(root, file));
}

function registeredPiCommands(root) {
  const file = path.join(root, 'pi-extension', 'index.js');
  if (!fs.existsSync(file)) return new Set();
  const source = fs.readFileSync(file, 'utf8');
  return new Set([...source.matchAll(/'((?:forgeflow)[\w-]*)'/g)].map((match) => match[1]));
}

function skillNameForCommand(name) {
  const direct = `forgeflow-${name.replace(/^forgeflow-/, '')}`;
  const core = {
    plan: 'forgeflow-plan',
    implement: 'forgeflow-implement',
    review: 'forgeflow-review',
    audit: 'forgeflow-audit',
    ship: 'forgeflow-ship',
  };
  return core[name] || direct;
}

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function pilotCount(root) {
  const file = path.join(defaultProjectDir(root), 'pilot-evidence-rollup.md');
  if (!fs.existsSync(file)) return 0;
  let content = '';
  try {
    content = safeReadTextFile(file, defaultProjectDir(root)).content;
  } catch (_err) {
    return 0;
  }
  return Number.parseInt((content.match(/^Pilot count:\s*(\d+)/m) || [])[1] || '0', 10) || 0;
}

function adoptionRecommendations(root, rows) {
  const count = pilotCount(root);
  const optionalCandidates = rows
    .filter((row) => row.policy === 'optional-lean' && (!row.pi_alias || !row.opencode_command))
    .map((row) => row.command)
    .sort();
  if (optionalCandidates.length === 0) {
    return [{
      status: 'complete',
      reason: 'No optional lean host parity candidates are missing pi or OpenCode coverage.',
      commands: [],
      evidence: `pilot_count=${count}`,
    }];
  }
  return [{
    status: count >= 3 ? 'recommend-review' : 'watch',
    reason: count >= 3
      ? 'Local pilot evidence is high enough to review optional lean commands for host parity promotion.'
      : 'Keep optional lean commands as Forgeflow-only until adoption evidence is stronger.',
    commands: optionalCandidates.slice(0, 10),
    evidence: `pilot_count=${count}`,
  }];
}

function buildCommandCapabilityMatrix(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const names = commandNames(root);
  const piCommands = registeredPiCommands(root);
  const requiredHostCommands = new Set(HOST_PARITY_POLICY.required_host_parity || []);
  const optionalPrefixes = HOST_PARITY_POLICY.optional_prefixes || [];
  const rows = names.map((name) => {
    const commandFile = `commands/${name.replace(/\//g, '/')}.md`;
    const opencodeFile = `.opencode/command/${name}.md`;
    const skillFile = `skills/${skillNameForCommand(name)}/SKILL.md`;
    const policy = requiredHostCommands.has(name) ? 'required-host-parity' : (optionalPrefixes.some((prefix) => name.startsWith(prefix)) ? 'optional-lean' : 'forgeflow-only');
    const gaps = [];
    if (policy === 'required-host-parity' && !piCommands.has(name)) gaps.push('pi_alias');
    if (policy === 'required-host-parity' && !exists(root, opencodeFile)) gaps.push('opencode_command');
    return {
      command: name,
      policy,
      forgeflow_command: exists(root, commandFile),
      pi_alias: piCommands.has(name),
      opencode_command: exists(root, opencodeFile),
      skill: exists(root, skillFile),
      gaps,
    };
  });
  const requiredGaps = rows.filter((row) => row.gaps.length > 0);
  const counts = {
    commands: rows.length,
    pi_aliases: rows.filter((row) => row.pi_alias).length,
    opencode_commands: rows.filter((row) => row.opencode_command).length,
    skills: rows.filter((row) => row.skill).length,
    required_host_gaps: requiredGaps.length,
    optional_host_candidates: rows.filter((row) => row.policy === 'optional-lean' && (!row.pi_alias || !row.opencode_command)).length,
  };
  const recommendations = adoptionRecommendations(root, rows);
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    status: rows.every((row) => row.forgeflow_command) && requiredGaps.length === 0 ? 'pass' : 'fail',
    policy: HOST_PARITY_POLICY,
    rows,
    recommendations,
    summary: counts,
    next: requiredGaps.length ? '/forgeflow-lean-host-command-parity' : '/forgeflow-lean-host-command-parity',
    boundary: 'Command capability matrix generation is read-only. It scans committed command, host adapter, and skill files but does not install adapters, edit settings, commit, push, or call the network.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Command Capability Matrix',
    '',
    `Status: ${result.status}`,
    '',
    result.boundary,
    '',
    '| Command | Policy | Forgeflow | Pi | OpenCode | Skill | Gaps |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const row of result.rows) {
    lines.push(`| ${row.command} | ${row.policy} | ${row.forgeflow_command ? 'yes' : 'no'} | ${row.pi_alias ? 'yes' : 'no'} | ${row.opencode_command ? 'yes' : 'no'} | ${row.skill ? 'yes' : 'no'} | ${row.gaps.join(', ') || ''} |`);
  }
  lines.push('', '## Adoption Recommendations', '');
  for (const item of result.recommendations || []) {
    lines.push(`- ${item.status}: ${item.reason} (${item.evidence})`);
    for (const command of item.commands || []) lines.push(`  - ${command}`);
  }
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildCommandCapabilityMatrix(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
    if (result.status === 'fail') process.exit(1);
  } catch (err) {
    console.error(`command capability matrix failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  buildCommandCapabilityMatrix,
  adoptionRecommendations,
  parseArgs,
  renderMarkdown,
  skillNameForCommand,
};
