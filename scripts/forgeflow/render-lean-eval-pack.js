#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { safeReadTextFile } = require('./file-safety');
const { evaluateLeanBehavior } = require('./render-lean-behavior-eval');

const DEFAULT_CASES = [
  {
    name: 'hardware-calibration-good',
    text: 'function readTemp(raw) { if (raw > 0) return raw + offset; }\nconst offset = 0; // calibration offset, measure your own reference thermometer\nassert(readTemp(1) === 1);\nUsed native platform and existing dependency checks before custom code.',
    expect: 'pass',
  },
  {
    name: 'hardware-calibration-bad',
    text: 'function moveServo(ms) { if (ms) return ms; } // servo timer\nassert(moveServo(1) === 1);\nUsed native platform.',
    expect: 'fail',
  },
  {
    name: 'requested-explanation-good',
    requested_explanation: true,
    text: '- Replaced the custom wrapper because the platform API covers the current behavior.\n- Kept the validation branch so trust-boundary input still fails closed.\n- Left one assert so the parser has a runnable check.\n- Deferred the broader abstraction until a second caller appears.\n- This is intentionally longer because the user requested a detailed explanation of the tradeoff.',
    expect: 'warn',
  },
  {
    name: 'dependency-avoidance-bad',
    text: "npm install left-pad\nfunction pad(x) { if (x) return x; }\nassert(pad('a') === 'a');",
    expect: 'fail',
  },
  {
    name: 'explicit-requirement-bad',
    text: 'Skipped the explicit accessibility requirement to keep this short.',
    expect: 'fail',
  },
];

function usage() {
  console.error('Usage: render-lean-eval-pack.js [--root <repo>] [--cases <json>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), cases: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--cases') {
      opts.cases = path.resolve(requireValue(argv, arg, i));
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

function defaultCases(root) {
  return path.join(root, 'fixtures', 'lean-eval', 'sample-cases.json');
}

function loadCases(root, file) {
  const resolved = path.resolve(file || defaultCases(root));
  if (!file && !fs.existsSync(resolved)) return { file: 'embedded-defaults', cases: DEFAULT_CASES };
  const parsed = JSON.parse(safeReadTextFile(resolved, root).content);
  if (!parsed || !Array.isArray(parsed.cases)) throw new Error('Lean eval cases must contain a cases array');
  return { file: resolved, cases: parsed.cases };
}

function expectedMatches(expect, status) {
  if (expect === 'pass') return status === 'pass';
  if (expect === 'warn') return status === 'warn';
  if (expect === 'fail') return status === 'fail';
  if (expect === 'not-pass') return status !== 'pass';
  return false;
}

function runCase(root, item) {
  const result = evaluateLeanBehavior({
    root,
    text: item.text || '',
    requestedExplanation: Boolean(item.requested_explanation),
  });
  const matched = expectedMatches(item.expect, result.status);
  return {
    name: String(item.name || 'unnamed'),
    expect: item.expect || 'pass',
    status: matched ? 'pass' : 'fail',
    observed_status: result.status,
    probes: result.probes,
    reason: matched ? 'Observed status matched expected lean eval outcome.' : `Expected ${item.expect}, observed ${result.status}.`,
  };
}

function buildLeanEvalPack(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const loaded = loadCases(root, opts.cases || '');
  const cases = loaded.cases.map((item) => runCase(root, item));
  const failures = cases.filter((item) => item.status === 'fail').length;
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    cases_file: loaded.file,
    status: failures ? 'fail' : 'pass',
    cases,
    summary: {
      cases: cases.length,
      failures,
      observed_failures: cases.filter((item) => item.observed_status === 'fail').length,
      observed_warnings: cases.filter((item) => item.observed_status === 'warn').length,
    },
    next: failures ? 'Fix lean eval fixture expectations or behavior probes before trusting the pack.' : '/forgeflow-lean-behavior --file <output>',
    boundary: 'Lean eval pack is local and deterministic. It does not call models, run generated code, install dependencies, mutate context, commit, push, or call the network.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Lean Eval Pack',
    '',
    `Status: ${result.status}`,
    `Cases: ${result.summary.cases}`,
    `Cases file: ${result.cases_file}`,
    '',
    result.boundary,
    '',
    '## Cases',
    '',
  ];
  for (const item of result.cases) {
    lines.push(`- ${item.status}: ${item.name} expected ${item.expect}, observed ${item.observed_status}`);
  }
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildLeanEvalPack(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
    if (result.status === 'fail') process.exit(1);
  } catch (err) {
    console.error(`lean eval pack failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  buildLeanEvalPack,
  DEFAULT_CASES,
  expectedMatches,
  loadCases,
  parseArgs,
  renderMarkdown,
};
