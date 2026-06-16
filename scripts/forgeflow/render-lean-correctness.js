#!/usr/bin/env node
const vm = require('vm');

const CASES = [
  {
    name: 'leap-year',
    fn: 'isLeapYear',
    good: 'function isLeapYear(y) { return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0); }',
    bad: 'function isLeapYear(y) { return y % 4 === 0; }',
    assertions: [
      [[2000], true],
      [[1900], false],
      [[2020], true],
      [[2021], false],
      [[2100], false],
    ],
  },
  {
    name: 'binary-search',
    fn: 'binarySearch',
    good: 'function binarySearch(xs, target) { let lo = 0, hi = xs.length - 1; while (lo <= hi) { const mid = Math.floor((lo + hi) / 2); if (xs[mid] === target) return mid; if (xs[mid] < target) lo = mid + 1; else hi = mid - 1; } return -1; }',
    bad: 'function binarySearch(xs, target) { let lo = 0, hi = xs.length - 1; while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (xs[mid] === target) return mid; if (xs[mid] < target) lo = mid + 1; else hi = mid - 1; } return -1; }',
    assertions: [
      [[[1, 2, 3, 4, 5], 1], 0],
      [[[1, 2, 3, 4, 5], 5], 4],
      [[[1], 1], 0],
      [[[], 1], -1],
    ],
  },
  {
    name: 'chunk-keeps-tail',
    fn: 'chunk',
    good: 'function chunk(xs, size) { const out = []; for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size)); return out; }',
    bad: 'function chunk(xs, size) { const out = []; for (let i = 0; i < xs.length - size + 1; i += size) out.push(xs.slice(i, i + size)); return out; }',
    assertions: [
      [[[1, 2, 3, 4, 5], 2], [[1, 2], [3, 4], [5]]],
      [[[1], 5], [[1]]],
      [[[], 3], []],
    ],
  },
  {
    name: 'ipv4-range',
    fn: 'isIPv4',
    good: 'function isIPv4(s) { const parts = String(s).split("."); return parts.length === 4 && parts.every((p) => /^\\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255); }',
    bad: 'function isIPv4(s) { return /^\\d{1,3}(\\.\\d{1,3}){3}$/.test(s); }',
    assertions: [
      [['192.168.1.1'], true],
      [['255.255.255.255'], true],
      [['256.1.1.1'], false],
      [['999.999.999.999'], false],
      [['1.2.3'], false],
    ],
  },
  {
    name: 'credit-card-luhn',
    fn: 'isValidCard',
    good: 'function isValidCard(value) { const digits = String(value).replace(/\\D/g, "").split("").map(Number); if (digits.length < 13) return false; let sum = 0; let double = false; for (let i = digits.length - 1; i >= 0; i -= 1) { let n = digits[i]; if (double) { n *= 2; if (n > 9) n -= 9; } sum += n; double = !double; } return sum % 10 === 0; }',
    bad: 'function isValidCard(value) { return /^\\d{16}$/.test(String(value)); }',
    assertions: [
      [['4242424242424242'], true],
      [['4012888888881881'], true],
      [['4242424242424241'], false],
      [['12345'], false],
      [['abcd'], false],
    ],
  },
];

function usage() {
  console.error('Usage: render-lean-correctness.js [--json]');
}

function parseArgs(argv) {
  const opts = { json: false };
  for (const arg of argv) {
    if (arg === '--json') opts.json = true;
    else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function deepEqual(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function runSnippet(testCase, source) {
  const context = {};
  vm.createContext(context);
  try {
    vm.runInContext(`${source}\n;this.__candidate = ${testCase.fn};`, context, { timeout: 1000 });
    if (typeof context.__candidate !== 'function') return { ok: false, reason: `Function ${testCase.fn} was not defined.` };
    for (const [args, expected] of testCase.assertions) {
      const actual = context.__candidate(...args);
      if (!deepEqual(actual, expected)) {
        return { ok: false, reason: `For ${JSON.stringify(args)}, got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}.` };
      }
    }
    return { ok: true, reason: 'All executable assertions passed.' };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

function evaluateCase(testCase) {
  const good = runSnippet(testCase, testCase.good);
  const bad = runSnippet(testCase, testCase.bad);
  return {
    name: testCase.name,
    status: good.ok && !bad.ok ? 'pass' : 'fail',
    good_pass: good.ok,
    bad_rejected: !bad.ok,
    good_reason: good.reason,
    bad_reason: bad.reason,
  };
}

function buildLeanCorrectness() {
  const cases = CASES.map(evaluateCase);
  const failures = cases.filter((item) => item.status === 'fail').length;
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    status: failures ? 'fail' : 'pass',
    cases,
    summary: { cases: cases.length, failures },
    next: failures ? 'Fix executable correctness harnesses before using them as lean regression gates.' : '/forgeflow-lean-robustness',
    boundary: 'Lean correctness is a deterministic local executable selftest. It runs built-in JavaScript snippets in a VM timeout, does not install dependencies, call models, mutate context, commit, push, or call the network. The VM is a test harness, not a security sandbox for untrusted code.',
  };
}

function renderMarkdown(result) {
  const lines = ['# Forgeflow Lean Correctness', '', `Status: ${result.status}`, '', result.boundary, '', '## Cases', ''];
  for (const item of result.cases) lines.push(`- ${item.status}: ${item.name} good=${item.good_pass} bad_rejected=${item.bad_rejected}`);
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildLeanCorrectness();
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
    if (result.status === 'fail') process.exit(1);
  } catch (err) {
    console.error(`lean correctness failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  CASES,
  buildLeanCorrectness,
  parseArgs,
  renderMarkdown,
  runSnippet,
};
