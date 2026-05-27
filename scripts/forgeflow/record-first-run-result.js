#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { writeFileSafe } = require('./file-safety');
const { containsSensitiveContent, publicSafeBlocker } = require('./privacy-boundary');

const DECISIONS = new Set(['continue', 'fix-first', 'stop-and-fix', 'defer']);
const RESULTS = new Set(['pass', 'warn', 'fail']);
const RUNTIMES = new Set(['claude-code', 'codex']);
const PUBLIC_NAME_ALLOWLIST = new Set([
  'Claude',
  'Codex',
  'Forgeflow',
  'GitHub',
  'JSON',
  'Markdown',
  'README',
  'Run',
  'Try',
  'Needed',
]);

function usage() {
  console.error('Usage: record-first-run-result.js --project-dir <dir> --runtime claude-code|codex --health pass|warn|fail --smoke pass|warn|fail [--profile pass|warn|fail] --decision continue|fix-first|stop-and-fix|defer [--friction <category>] [--next-action <text>] [--notes <text>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { json: false, friction: 'none', notes: '', nextAction: '', profile: 'warn' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--runtime') {
      opts.runtime = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--health') {
      opts.health = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--smoke') {
      opts.smoke = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--profile') {
      opts.profile = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--decision') {
      opts.decision = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--friction') {
      opts.friction = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--notes') {
      opts.notes = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--next-action') {
      opts.nextAction = requireValue(argv, arg, i);
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

function cleanPublicText(value, name) {
  const text = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  if (containsSensitiveContent(text)) throw new Error(`${name} contains private or sensitive content`);
  if (/[\\/]/.test(text)) throw new Error(`${name} contains path or source snippet content`);
  if (/```|`[^`]+`/.test(text)) throw new Error(`${name} contains source snippet content`);
  if (/(^|[\s"'(=:])(?:src|app|apps|packages|lib|server|client|components|routes|pages|scripts|commands)\/[A-Za-z0-9_./-]+(?:\.[A-Za-z0-9]+)?\b/.test(text)) {
    throw new Error(`${name} contains source snippet content`);
  }
  if (/(^|[\s"'(=:])\.{1,2}\/(?:src|app|apps|packages|lib|server|client|components|routes|pages|scripts|commands)\/[A-Za-z0-9_./-]+(?:\.[A-Za-z0-9]+)?\b/.test(text)) {
    throw new Error(`${name} contains source snippet content`);
  }
  if (/(^|[\s"'(=:])(?:src|app|apps|packages|lib|server|client|components|routes|pages|scripts|commands)\\[A-Za-z0-9_.\\-]+(?:\.[A-Za-z0-9]+)?\b/.test(text)) {
    throw new Error(`${name} contains source snippet content`);
  }
  if (/\b(?:import|export|function|class|const|let|var|interface|type)\s+[A-Za-z_$][\w$]*(?:\s*[=({:]|\s+from\b)/.test(text)) {
    throw new Error(`${name} contains source snippet content`);
  }
  if (/\b(?:settings\.json|statusLine|hook(?:s)?\s*[:=]|"hooks"|\"statusLine\")\b/i.test(text)) {
    throw new Error(`${name} contains raw settings content`);
  }
  if (/\b(?:customer|client|tenant|account)\s+["']?[A-Z][A-Za-z0-9_-]{2,}\b/i.test(text)) {
    throw new Error(`${name} contains customer or private account name content`);
  }
  const properName = text.match(/\b[A-Z][a-z][A-Za-z0-9_-]{2,}\b/);
  if (properName && !PUBLIC_NAME_ALLOWLIST.has(properName[0])) {
    throw new Error(`${name} contains customer or private account name content`);
  }
  const upperName = text.match(/\b[A-Z][A-Z0-9_-]{2,}\b/);
  if (upperName && !PUBLIC_NAME_ALLOWLIST.has(upperName[0])) {
    throw new Error(`${name} contains customer or private account name content`);
  }
  return text;
}

function normalizeResult(opts = {}) {
  if (!opts.projectDir) throw new Error('Missing --project-dir');
  if (!RUNTIMES.has(opts.runtime)) throw new Error('Invalid --runtime');
  if (!RESULTS.has(opts.health)) throw new Error('Invalid --health');
  if (!RESULTS.has(opts.smoke)) throw new Error('Invalid --smoke');
  if (!RESULTS.has(opts.profile)) throw new Error('Invalid --profile');
  if (!DECISIONS.has(opts.decision)) throw new Error('Invalid --decision');
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    runtime: opts.runtime,
    health: opts.health,
    smoke: opts.smoke,
    profile: opts.profile,
    decision: opts.decision,
    friction: !opts.friction || opts.friction === 'none' ? 'none' : publicSafeBlocker(opts.friction),
    next_action: cleanPublicText(opts.nextAction || '', '--next-action'),
    notes: cleanPublicText(opts.notes || '', '--notes'),
  };
}

function recordFirstRunResult(opts = {}) {
  const record = normalizeResult(opts);
  const dir = path.join(opts.projectDir, 'first-run-results');
  const stamp = record.generated_at.replace(/[:]/g, '').replace(/Z$/, 'Z');
  fs.mkdirSync(dir, { recursive: true });
  const uniqueStamp = `${stamp}-${randomUUID().slice(0, 8)}`;
  const jsonPath = path.join(dir, `${uniqueStamp}.json`);
  const mdPath = path.join(dir, `${uniqueStamp}.md`);
  writeFileSafe(jsonPath, `${JSON.stringify(record, null, 2)}\n`);
  writeFileSafe(mdPath, renderMarkdown(record));
  return { record, json: jsonPath, markdown: mdPath };
}

function renderMarkdown(record) {
  return [
    '# Forgeflow First-Run Result',
    '',
    `Runtime: ${record.runtime}`,
    `Health: ${record.health}`,
    `Smoke: ${record.smoke}`,
    `Profile: ${record.profile}`,
    `Decision: ${record.decision}`,
    `Friction: ${record.friction}`,
    `Next action: ${record.next_action || '(none)'}`,
    `Notes: ${record.notes || '(none)'}`,
    '',
  ].join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = recordFirstRunResult(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : `First-run result recorded: ${result.markdown}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { normalizeResult, parseArgs, recordFirstRunResult, renderMarkdown };
