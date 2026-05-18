#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REQUIRED_SECTIONS = [
  ['decisions', 'Decisions'],
  ['spec_gaps', 'Spec Gaps'],
  ['tradeoffs', 'Tradeoffs'],
  ['deviations', 'Deviations'],
  ['follow_ups', 'Follow-ups'],
  ['validation_notes', 'Validation Notes'],
];

const SENSITIVE_PATTERNS = [
  ['private-key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/i],
  ['assignment-secret', /\b(api[_-]?key|password|passwd|secret|token)\s*[:=]/i],
  ['long-token-like-value', /\b[A-Z0-9]{20,}\b/],
  ['private-url', /\b(?:https?|ssh|git):\/\/(?:[^/\s:@]+:[^/\s@]+@|[^/\s]*(?:localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|\.internal\b|\.local\b|internal\.|intranet\.|corp\.))/i],
  ['scp-private-repo-url', /\bgit@[^:\s]*(?:\.internal\b|\.local\b|internal\.|intranet\.|corp\.)[^:\s]*:[^\s]+/i],
];

function usage() {
  console.error([
    'Usage: check-implementation-notes.js [--project-dir <dir>] [--file <path>]',
    '       [--ship-summary <path>] [--strict] [--json]',
  ].join('\n'));
}

function parseArgs(argv) {
  const opts = {
    projectDir: '',
    file: '',
    shipSummary: '',
    strict: false,
    json: false,
  };
  function requireValue(name, index) {
    const value = argv[index + 1] || '';
    if (!value || value.startsWith('--')) {
      console.error(`Missing value for ${name}`);
      usage();
      process.exit(2);
    }
    return path.resolve(value);
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') {
      opts.projectDir = requireValue(arg, i);
      i += 1;
    } else if (arg === '--file') {
      opts.file = requireValue(arg, i);
      i += 1;
    } else if (arg === '--ship-summary') {
      opts.shipSummary = requireValue(arg, i);
      i += 1;
    } else if (arg === '--strict') {
      opts.strict = true;
    } else if (arg === '--json') {
      opts.json = true;
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

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) return '';
  return result.stdout.trimEnd();
}

function repoRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], cwd) || cwd;
}

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function issue(severity, code, message, detail = {}) {
  return { severity, code, message, ...detail };
}

function sectionKey(heading) {
  const normalized = String(heading || '').trim().toLowerCase();
  const found = REQUIRED_SECTIONS.find(([, label]) => label.toLowerCase() === normalized);
  return found ? found[0] : '';
}

function parseNotes(content) {
  const sections = Object.fromEntries(REQUIRED_SECTIONS.map(([key]) => [key, []]));
  const headings = new Set();
  let current = '';
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      const key = sectionKey(heading[1]);
      if (key) {
        current = key;
        headings.add(key);
      } else {
        current = '';
      }
      continue;
    }
    if (current && line.startsWith('- ')) {
      sections[current].push({ line: i + 1, text: line.slice(2).trim() });
    }
  }
  return { headings, sections, lines };
}

function sensitiveIssues(lines, source) {
  const findings = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const [label, pattern] of SENSITIVE_PATTERNS) {
      if (pattern.test(line)) {
        findings.push(issue('fail', 'sensitive-content', `Potential sensitive content detected in ${source}`, {
          source,
          line: i + 1,
          pattern: label,
        }));
      }
    }
  }
  return findings;
}

function looksLikeRawLog(value) {
  return /^\d{4}-\d{2}-\d{2}T[^|]+\|\s*[^|]+\|\s*(decision|spec-gap|tradeoff|deviation|follow-up|validation)\s*\|/i.test(String(value || '').trim());
}

function checkShipSummary(file) {
  if (!file || !fs.existsSync(file)) return [];
  const issues = [];
  let parsed = null;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_err) {
    return [issue('warn', 'ship-summary-invalid', 'Ship summary JSON could not be parsed', { source: file })];
  }
  if (parsed.implementationNotes && !parsed.implementation_notes) {
    issues.push(issue('warn', 'ship-summary-legacy-key', 'Ship summary uses legacy implementationNotes key instead of implementation_notes', { source: file }));
  }
  if (!parsed.implementation_notes && !parsed.implementationNotes) {
    issues.push(issue('warn', 'ship-summary-notes-missing', 'Ship summary is missing implementation_notes', { source: file }));
  }
  const notes = parsed.implementation_notes || parsed.implementationNotes || {};
  for (const [key] of REQUIRED_SECTIONS) {
    const items = notes[key] || [];
    if (!Array.isArray(items)) {
      issues.push(issue('warn', 'ship-summary-section-shape', `Ship summary implementation_notes.${key} is not an array`, { source: file }));
      continue;
    }
    for (let i = 0; i < items.length; i += 1) {
      const item = String(items[i] || '');
      if (looksLikeRawLog(item)) {
        issues.push(issue('warn', 'ship-summary-raw-log', `Ship summary implementation_notes.${key} appears to contain raw log metadata`, {
          source: file,
          index: i,
        }));
      }
      issues.push(...sensitiveIssues([item], `${file}:implementation_notes.${key}[${i}]`));
    }
  }
  return issues;
}

function checkImplementationNotes(opts = {}) {
  const root = repoRoot();
  const projectDir = opts.projectDir || defaultProjectDir(root);
  const notesFile = opts.file || path.join(projectDir, 'implementation-notes.md');
  const shipSummary = opts.shipSummary || path.join(projectDir, 'ship', 'ship-summary.json');
  const issues = [];

  if (!fs.existsSync(notesFile)) {
    issues.push(issue(opts.strict ? 'fail' : 'warn', 'notes-missing', 'Implementation notes file is missing', {
      source: notesFile,
      fix: 'Run /implement or scripts/forgeflow/ensure-forgeflow-state.sh to create it.',
    }));
  } else {
    const content = fs.readFileSync(notesFile, 'utf8');
    const parsed = parseNotes(content);
    for (const [key, label] of REQUIRED_SECTIONS) {
      if (!parsed.headings.has(key)) {
        issues.push(issue('warn', 'section-missing', `Missing implementation notes section: ${label}`, { source: notesFile }));
      }
    }
    const noteCount = Object.values(parsed.sections).reduce((sum, items) => sum + items.length, 0);
    if (noteCount === 0) {
      issues.push(issue(opts.strict ? 'fail' : 'warn', 'notes-empty', 'Implementation notes contain no entries', {
        source: notesFile,
        fix: 'Add entries or explicitly record that no note-worthy decisions, gaps, tradeoffs, deviations, follow-ups, or validation notes were needed.',
      }));
    }
    issues.push(...sensitiveIssues(parsed.lines, notesFile));
  }

  issues.push(...checkShipSummary(shipSummary));
  const failures = issues.filter((item) => item.severity === 'fail');
  const warnings = issues.filter((item) => item.severity === 'warn');
  return {
    schema_version: '1',
    status: failures.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
    project_dir: projectDir,
    notes_file: notesFile,
    ship_summary: fs.existsSync(shipSummary) ? shipSummary : '',
    issues,
  };
}

function renderMarkdown(result) {
  const lines = [
    `# Implementation Notes Check: ${result.status.toUpperCase()}`,
    '',
    `Notes file: ${result.notes_file}`,
  ];
  if (result.ship_summary) lines.push(`Ship summary: ${result.ship_summary}`);
  lines.push('');
  if (result.issues.length === 0) {
    lines.push('No implementation-notes issues found.');
  } else {
    for (const item of result.issues) {
      const where = item.line ? ` (${item.source}:${item.line})` : item.source ? ` (${item.source})` : '';
      lines.push(`- ${item.severity.toUpperCase()} ${item.code}: ${item.message}${where}`);
      if (item.fix) lines.push(`  Fix: ${item.fix}`);
    }
  }
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = checkImplementationNotes(opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log(renderMarkdown(result));
  }
  if (result.status === 'fail') process.exit(1);
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
  checkImplementationNotes,
  looksLikeRawLog,
  parseNotes,
};
