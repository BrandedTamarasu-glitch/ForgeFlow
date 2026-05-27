#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const MISSING_SUMMARY_GUIDANCE = [
  'Canonical summary unavailable for this generated Codex stub.',
  'Review the canonical_source and canonical_sha256 before using it, then add manual_summary or sections in .codex/agent-canonical-map.json to make the stub specific.',
].join(' ');

function usage() {
  console.error('Usage: generate-codex-agent-stubs.js --agent <.codex/agents/name.toml> [--map <path>] [--out <path>] [--stdout]');
}

function parseArgs(argv) {
  const opts = {
    agent: '',
    mapPath: path.join(repoRoot, '.codex/agent-canonical-map.json'),
    out: '',
    stdout: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--agent') {
      opts.agent = argv[++i] || '';
    } else if (arg === '--map') {
      opts.mapPath = path.resolve(argv[++i] || '');
    } else if (arg === '--out') {
      opts.out = argv[++i] || '';
    } else if (arg === '--stdout') {
      opts.stdout = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      usage();
      process.exit(2);
    }
  }

  return opts;
}

function readMap(mapPath) {
  return JSON.parse(fs.readFileSync(mapPath, 'utf8'));
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  const fields = {};
  if (!match) return fields;
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (field) fields[field[1]] = field[2].replace(/^["']|["']$/g, '').trim();
  }
  return fields;
}

function stripFrontmatter(markdown) {
  return markdown.replace(/^---\n[\s\S]*?\n---\n?/, '');
}

function extractXmlBlock(markdown, name) {
  const match = markdown.match(new RegExp(`<${name}>\\n?([\\s\\S]*?)\\n?</${name}>`, 'i'));
  return match ? match[1].trim() : '';
}

function extractSection(markdown, title) {
  const lines = markdown.split(/\r?\n/);
  const target = normalizeTitle(title);
  let start = -1;
  let level = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^(#{1,6})\s+(.+?)\s*$/);
    if (match && normalizeTitle(match[2]) === target) {
      start = i;
      level = match[1].length;
      break;
    }
  }

  if (start === -1) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const match = lines[i].match(/^(#{1,6})\s+/);
    if (match && match[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n').trim();
}

function normalizeTitle(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function readExistingFields(agentPath) {
  if (!fs.existsSync(agentPath)) return {};
  const text = fs.readFileSync(agentPath, 'utf8');
  const fields = {};
  for (const key of ['name', 'description', 'model', 'model_reasoning_effort', 'sandbox_mode']) {
    const match = text.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, 'm'));
    if (match) fields[key] = match[1];
  }
  return fields;
}

function tomlString(value) {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function multilineToml(value) {
  return `"""${String(value || '').replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"')}"""`;
}

function selectedMarkdown(markdown, sections = []) {
  const parts = [];
  for (const section of sections) {
    const name = String(section || '').trim();
    if (!name) continue;
    const content = name.toLowerCase() === 'role'
      ? extractXmlBlock(markdown, 'role')
      : extractSection(markdown, name);
    if (content) {
      parts.push(name.toLowerCase() === 'role' ? `<role>\n${content}\n</role>` : content);
    }
  }
  return parts.join('\n\n').trim();
}

function buildInstructions(markdown, entry) {
  const parts = [];
  if (entry.manual_summary) {
    parts.push(entry.manual_summary.trim());
  }
  const selected = selectedMarkdown(stripFrontmatter(markdown), entry.sections || []);
  if (selected) {
    parts.push(`Canonical excerpts for manual review:\n\n${selected}`);
  }
  if (parts.length === 0) {
    parts.push(MISSING_SUMMARY_GUIDANCE);
  }
  return parts.join('\n\n');
}

function buildStub(agent, entry, opts = {}) {
  if (entry.codex_native) {
    throw new Error(`${agent} is codex_native and has no canonical markdown source`);
  }
  if (!entry.canonical) {
    throw new Error(`${agent} map entry missing canonical`);
  }

  const canonicalPath = path.resolve(repoRoot, entry.canonical);
  const markdown = fs.readFileSync(canonicalPath, 'utf8');
  const frontmatter = parseFrontmatter(markdown);
  const existing = readExistingFields(path.resolve(repoRoot, agent));
  const name = existing.name || path.basename(agent, '.toml').replace(/-/g, '_');
  const description = existing.description || frontmatter.description || `Codex port of ${frontmatter.name || entry.canonical}.`;
  const model = existing.model || opts.model || 'gpt-5.4-mini';
  const reasoning = existing.model_reasoning_effort || opts.reasoning || 'medium';
  const sandbox = existing.sandbox_mode || opts.sandbox || 'read-only';
  const instructions = buildInstructions(markdown, entry);

  return [
    `name = ${tomlString(name)}`,
    `description = ${tomlString(description)}`,
    `model = ${tomlString(model)}`,
    `model_reasoning_effort = ${tomlString(reasoning)}`,
    `sandbox_mode = ${tomlString(sandbox)}`,
    `canonical_source = ${tomlString(entry.canonical)}`,
    `canonical_sha256 = ${tomlString(sha256(markdown))}`,
    `developer_instructions = ${multilineToml(instructions)}`,
    '',
  ].join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.agent) {
    usage();
    process.exit(2);
  }
  const map = readMap(opts.mapPath);
  const entry = (map.agents || {})[opts.agent];
  if (!entry) {
    throw new Error(`map does not contain ${opts.agent}`);
  }
  const output = buildStub(opts.agent, entry);
  if (opts.out) {
    const outPath = path.resolve(opts.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, output);
  }
  if (opts.stdout || !opts.out) {
    process.stdout.write(output);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = {
  buildStub,
  extractSection,
  MISSING_SUMMARY_GUIDANCE,
  parseFrontmatter,
  selectedMarkdown,
};
