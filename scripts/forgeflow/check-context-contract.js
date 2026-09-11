#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { safeReadTextFile } = require('./file-safety');

const MAX_SECTION_CHARS = 12000;
const REQUIRED_PACKET_SECTIONS = ['## Agent Context Contract', '## Packet Artifact Trust', '## Output Contract'];

function usage() {
  console.error('Usage: check-context-contract.js [--context-dir <dir>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { contextDir: path.join(process.cwd(), '.forgeflow', path.basename(process.cwd()), 'context', 'latest'), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--context-dir') {
      opts.contextDir = path.resolve(requireValue(argv, arg, i));
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

function readJson(file, root) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(safeReadTextFile(file, root).content);
}

function packetSectionLengths(markdown) {
  const sections = {};
  const chunks = String(markdown || '').split(/\n(?=## )/);
  for (const chunk of chunks) {
    const first = chunk.split(/\r?\n/, 1)[0].trim();
    if (first.startsWith('## ')) sections[first] = chunk.length;
  }
  return sections;
}

function checkContextContract(opts = {}) {
  const contextDir = path.resolve(opts.contextDir || path.join(process.cwd(), '.forgeflow', path.basename(process.cwd()), 'context', 'latest'));
  const contractPath = path.join(contextDir, 'agent-context-contract.json');
  const contract = readJson(contractPath, contextDir);
  const packetDir = path.join(contextDir, 'agent-packets');
  const issues = [];
  if (!contract || !contract.agents) {
    issues.push({ severity: 'fail', code: 'contract-missing', message: 'agent-context-contract.json is missing or invalid.' });
  }
  const synthesisPath = path.join(contextDir, 'synthesis-input.json');
  const synthesis = readJson(synthesisPath, contextDir);
  const discoveredFiles = fs.existsSync(packetDir)
    ? fs.readdirSync(packetDir).filter((name) => name.endsWith('.md')).sort()
    : [];
  let packetFiles = discoveredFiles;
  if (fs.existsSync(synthesisPath)) {
    // A rebuild may leave historical packets beside current output. Only the
    // current manifest selects active files; aliases do not authorize old content.
    const packets = synthesis && synthesis.agent_packets;
    packetFiles = [];
    if (!packets || typeof packets !== 'object' || Array.isArray(packets)) {
      issues.push({ severity: 'fail', code: 'packet-manifest-invalid', message: 'synthesis-input.json must contain an agent_packets object.' });
    } else {
      for (const [agent, file] of Object.entries(packets)) {
        const expected = `${agent}.md`;
        if (typeof file !== 'string' || path.basename(file) !== expected || path.basename(expected) !== expected || expected.includes('\\')) {
          issues.push({ severity: 'fail', code: 'packet-manifest-invalid', agent, message: `Invalid packet filename for ${agent}.` });
          continue;
        }
        packetFiles.push(expected);
      }
    }
  }
  // Missing manifest entries and missing files must not turn a partial pack into
  // a passing check, even when obsolete packets still exist on disk.
  for (const agent of Object.keys((contract && contract.agents) || {})) {
    if (!packetFiles.includes(`${agent}.md`)) {
      issues.push({ severity: 'fail', code: 'agent-packet-missing', agent, message: `Missing current packet for ${agent}.` });
    }
  }
  if (packetFiles.length === 0) issues.push({ severity: 'attention', code: 'packets-missing', message: 'No agent packet files were found.' });
  for (const fileName of packetFiles) {
    const agent = fileName.replace(/\.md$/, '');
    const file = path.join(packetDir, fileName);
    if (!fs.existsSync(file)) {
      issues.push({ severity: 'fail', code: 'agent-packet-missing', agent, message: `Missing current packet file for ${agent}.` });
      continue;
    }
    const markdown = safeReadTextFile(file, contextDir).content;
    if (contract && contract.agents && !contract.agents[agent]) {
      issues.push({ severity: 'fail', code: 'agent-contract-missing', agent, message: `Missing contract entry for ${agent}.` });
    }
    for (const section of REQUIRED_PACKET_SECTIONS) {
      if (!markdown.includes(section)) issues.push({ severity: 'fail', code: 'packet-section-missing', agent, message: `${agent} packet missing ${section}.` });
    }
    const lengths = packetSectionLengths(markdown);
    for (const [section, length] of Object.entries(lengths)) {
      if (length > MAX_SECTION_CHARS) {
        issues.push({ severity: 'attention', code: 'packet-section-oversized', agent, message: `${agent} ${section} is ${length} chars.` });
      }
    }
    if (/## Latest Insights[\s\S]*?(?:\bapproval\b|\bapproved\b|\boverride\b)/i.test(markdown)) {
      issues.push({ severity: 'attention', code: 'raw-guidance-risk', agent, message: `${agent} packet includes latest-insights language that must remain advisory.` });
    }
  }
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    context_dir: contextDir,
    status: issues.some((issue) => issue.severity === 'fail') ? 'fail' : (issues.length > 0 ? 'attention' : 'pass'),
    packet_count: packetFiles.length,
    issue_count: issues.length,
    issues,
    boundary: 'Context contract check is read-only. It validates generated packet structure and advisory boundaries only.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Context Contract Check',
    '',
    `Status: ${result.status}`,
    `Packets: ${result.packet_count}`,
    `Issues: ${result.issue_count}`,
    '',
    result.boundary,
    '',
    '## Issues',
    '',
  ];
  if (result.issues.length === 0) lines.push('- None.');
  else for (const issue of result.issues) lines.push(`- ${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`);
  lines.push('');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = checkContextContract(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  if (result.status === 'fail') process.exit(1);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(1);
  }
}

module.exports = { checkContextContract, parseArgs, renderMarkdown };
