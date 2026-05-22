#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const CANONICAL_TARGETS = {
  'smith-craft': ['smith-consult', 'smith-implement', 'smith-audit', 'smith-review'],
  'warden-security-intelligence': ['warden-consult', 'warden-implement', 'warden-audit', 'warden-review'],
  'arbiter-intelligence': ['arbiter-consult', 'arbiter-implement', 'arbiter-review'],
  'lumen-design-principles': ['lumen-consult', 'lumen-implement', 'lumen-review'],
};
const EXPECTED_SECTIONS = {
  'arbiter-intelligence': {
    'arbiter-consult': [
      'Conflict Resolution Hierarchy',
      'Blocked Findings Protocol',
      'Scope Gate',
      'Rejected Alternatives Log',
      'Lead Architect Intelligence',
    ],
    'arbiter-implement': [
      'Blocked Findings Protocol',
      'Deviation Protocol',
      'Lead Architect Intelligence',
    ],
    'arbiter-review': [
      'Conflict Resolution Hierarchy',
      'Blocked Findings Protocol',
      'Verdict Scale',
      'Lead Architect Intelligence',
    ],
  },
};

function usage() {
  console.error('Usage: check-agent-drift.js [--root <dir>] [--agent <name>] [--canonical <name>] [--threshold N] [--json]');
}

function argumentError(message, exitOnError) {
  if (exitOnError) {
    console.error(message);
    usage();
    process.exit(2);
  }
  const err = new Error(message);
  err.exitCode = 2;
  throw err;
}

function requireValue(argv, name, index, exitOnError = true) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) {
    argumentError(`Missing value for ${name}`, exitOnError);
  }
  return value;
}

function parseArgs(argv, options = {}) {
  const exitOnError = options.exitOnError !== false;
  const opts = {
    root: '',
    agent: '',
    canonical: '',
    threshold: 70,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i, exitOnError));
      i += 1;
    } else if (arg === '--agent') {
      opts.agent = requireValue(argv, arg, i, exitOnError).replace(/\.md$/, '');
      i += 1;
    } else if (arg === '--canonical') {
      opts.canonical = requireValue(argv, arg, i, exitOnError).replace(/\.md$/, '');
      i += 1;
    } else if (arg === '--threshold') {
      opts.threshold = Number.parseInt(requireValue(argv, arg, i, exitOnError), 10);
      i += 1;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      if (exitOnError) process.exit(0);
      return opts;
    } else {
      argumentError(`Unknown argument: ${arg}`, exitOnError);
    }
  }
  if (!Number.isFinite(opts.threshold) || opts.threshold < 0 || opts.threshold > 100) {
    argumentError('Invalid --threshold. Expected 0-100.', exitOnError);
  }
  return opts;
}

function defaultRoot(cwd = process.cwd()) {
  if (fs.existsSync(path.join(cwd, 'agents', '_shared')) && fs.existsSync(path.join(cwd, 'agents'))) return cwd;
  return path.join(process.env.HOME || '', '.claude');
}

function stripFrontmatter(content) {
  const lines = String(content || '').split(/\r?\n/);
  if (lines[0] !== '---') return lines.join('\n');
  const end = lines.slice(1).findIndex((line) => line === '---');
  if (end === -1) return lines.join('\n');
  return lines.slice(end + 2).join('\n');
}

function normalizeLines(body) {
  return String(body || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/<!--.*?-->/g, '').trim().toLowerCase())
    .filter(Boolean);
}

function parseSections(content) {
  const body = stripFrontmatter(content);
  const sections = [];
  const matches = [...body.matchAll(/^##\s+(.+)$/gm)];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const next = matches[i + 1];
    const heading = match[1].trim();
    const start = match.index + match[0].length;
    const end = next ? next.index : body.length;
    const beforeHeading = body.slice(Math.max(0, match.index - 180), match.index);
    sections.push({
      heading,
      adapted: /<!--\s*adapted from _shared\//i.test(beforeHeading),
      lines: normalizeLines(body.slice(start, end)),
    });
  }
  return sections;
}

function readSections(file) {
  return parseSections(fs.readFileSync(file, 'utf8'));
}

function jaccardPercent(a, b) {
  const left = new Set(a || []);
  const right = new Set(b || []);
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 100;
  let shared = 0;
  for (const line of left) {
    if (right.has(line)) shared += 1;
  }
  return Math.floor((shared / union.size) * 100);
}

function compareSection(canonicalSection, agentSections, threshold) {
  const agentSection = agentSections.get(canonicalSection.heading);
  if (!agentSection) {
    return {
      section: canonicalSection.heading,
      status: 'MISSING',
      similarity: 0,
    };
  }
  const similarity = jaccardPercent(canonicalSection.lines, agentSection.lines);
  const same = canonicalSection.lines.length === agentSection.lines.length
    && canonicalSection.lines.every((line, index) => line === agentSection.lines[index]);
  const adapted = Boolean(agentSection.adapted);
  return {
    section: canonicalSection.heading,
    status: same ? 'SYNCED' : (similarity >= threshold || adapted ? 'MODIFIED' : 'DRIFTED'),
    similarity,
    adapted,
  };
}

function expectedSectionSet(canonical, agent) {
  const names = EXPECTED_SECTIONS[canonical] && EXPECTED_SECTIONS[canonical][agent];
  return names ? new Set(names) : null;
}

function mappingFor(opts = {}) {
  const entries = [];
  for (const [canonical, agents] of Object.entries(CANONICAL_TARGETS)) {
    if (opts.canonical && opts.canonical !== canonical) continue;
    for (const agent of agents) {
      if (opts.agent && opts.agent !== agent) continue;
      entries.push({ canonical, agent });
    }
  }
  return entries;
}

function summarizeAgent(agent, canonical, sections) {
  const summary = {
    agent,
    canonical,
    drift_score: 0,
    synced: 0,
    modified: 0,
    drifted: 0,
    missing: 0,
    sections,
  };
  for (const section of sections) {
    if (section.status === 'SYNCED') summary.synced += 1;
    if (section.status === 'MODIFIED') summary.modified += 1;
    if (section.status === 'DRIFTED') summary.drifted += 1;
    if (section.status === 'MISSING') summary.missing += 1;
  }
  const total = summary.synced + summary.modified + summary.drifted + summary.missing;
  summary.drift_score = total > 0 ? Number(((summary.drifted * 2 + summary.missing * 3) / total).toFixed(2)) : 0;
  return summary;
}

function checkAgentDrift(opts = {}) {
  const root = opts.root || defaultRoot();
  const canonicalDir = path.join(root, 'agents', '_shared');
  const agentDir = path.join(root, 'agents');
  const threshold = Number.isFinite(opts.threshold) ? opts.threshold : 70;
  const missing_inputs = [];
  const canonicalCache = new Map();
  const agentCache = new Map();
  const perAgent = [];
  let comparisons = 0;

  for (const { canonical, agent } of mappingFor(opts)) {
    const canonicalPath = path.join(canonicalDir, `${canonical}.md`);
    const agentPath = path.join(agentDir, `${agent}.md`);
    if (!fs.existsSync(canonicalPath)) {
      missing_inputs.push({ kind: 'canonical', name: canonical, path: canonicalPath });
      continue;
    }
    if (!fs.existsSync(agentPath)) {
      missing_inputs.push({ kind: 'agent', name: agent, path: agentPath });
      continue;
    }
    if (!canonicalCache.has(canonical)) canonicalCache.set(canonical, readSections(canonicalPath));
    if (!agentCache.has(agent)) {
      agentCache.set(agent, new Map(readSections(agentPath).map((section) => [section.heading, section])));
    }
    const expectedSections = expectedSectionSet(canonical, agent);
    const sections = canonicalCache.get(canonical)
      .filter((section) => !expectedSections || expectedSections.has(section.heading))
      .map((section) => compareSection(section, agentCache.get(agent), threshold));
    comparisons += sections.length;
    perAgent.push(summarizeAgent(agent, canonical, sections));
  }

  perAgent.sort((a, b) => b.drift_score - a.drift_score || a.agent.localeCompare(b.agent));
  const actionable = perAgent.reduce((sum, item) => sum + item.drifted + item.missing, 0);
  return {
    schema_version: '1',
    status: actionable > 0 ? 'fail' : 'pass',
    threshold,
    checked: {
      canonicals: new Set(perAgent.map((item) => item.canonical)).size,
      agents: perAgent.length,
      section_comparisons: comparisons,
    },
    missing_inputs,
    actionable,
    drifted_agents: perAgent.filter((item) => item.drifted > 0 || item.missing > 0).length,
    per_agent: perAgent,
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Drift Report',
    '',
    '## Scan',
    '',
    `- Canonicals: ${result.checked.canonicals}`,
    `- Agents: ${result.checked.agents}`,
    `- Section comparisons: ${result.checked.section_comparisons}`,
    `- Threshold: ${result.threshold}% similarity`,
    `- Status: ${result.status}`,
    '',
    '## Summary',
    '',
    '| Agent | Canonical | Synced | Modified | Drifted | Missing | Drift Score |',
    '|---|---|---:|---:|---:|---:|---:|',
  ];
  for (const item of result.per_agent) {
    lines.push(`| ${item.agent} | ${item.canonical} | ${item.synced} | ${item.modified} | ${item.drifted} | ${item.missing} | ${item.drift_score} |`);
  }

  const actionable = result.per_agent.filter((item) => item.drifted > 0 || item.missing > 0);
  lines.push('', '## Actionable Drift', '');
  if (actionable.length === 0) {
    lines.push('No MISSING or DRIFTED sections.');
  } else {
    for (const item of actionable) {
      lines.push(`### ${item.agent} (drift_score: ${item.drift_score})`);
      for (const section of item.sections.filter((entry) => entry.status === 'MISSING' || entry.status === 'DRIFTED')) {
        const detail = section.status === 'MISSING'
          ? 'section present in canonical, absent in agent'
          : `${section.similarity}% similarity`;
        lines.push(`- **${section.status}**: \`${section.section}\` - ${detail}`);
      }
      lines.push(`  Fix: copy the relevant section(s) from \`agents/_shared/${item.canonical}.md\` into \`agents/${item.agent}.md\`.`);
      lines.push('');
    }
  }

  if (result.missing_inputs.length > 0) {
    lines.push('## Missing Inputs', '');
    for (const item of result.missing_inputs) lines.push(`- ${item.kind}: ${item.name} (${item.path})`);
  }
  return lines.join('\n').trimEnd();
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = checkAgentDrift(opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderMarkdown(result)}\n`);
  }
  if (result.status === 'fail') process.exitCode = 1;
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
  CANONICAL_TARGETS,
  checkAgentDrift,
  compareSection,
  jaccardPercent,
  parseSections,
  parseArgs,
  renderMarkdown,
};
