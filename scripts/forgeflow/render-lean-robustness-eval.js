#!/usr/bin/env node

const CASES = [
  {
    name: 'leap-year-century',
    good: 'return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);',
    bad: 'return y % 4 === 0;',
    check(text) {
      return /%\s*400/.test(text) && /%\s*100/.test(text) && /%\s*4/.test(text);
    },
  },
  {
    name: 'binary-search-last-item',
    good: 'while (lo <= hi) { const mid = Math.floor((lo + hi) / 2); }',
    bad: 'while (lo < hi) { const mid = Math.floor((lo + hi) / 2); }',
    check(text) {
      return /while\s*\([^)]*<=/.test(text);
    },
  },
  {
    name: 'nested-flatten-recursive',
    good: 'function flatten(xs) { return xs.flatMap(x => Array.isArray(x) ? flatten(x) : x); }',
    bad: 'function flatten(xs) { return xs.flat(); }',
    check(text) {
      return /flatten\s*\(/.test(text) && /Array\.isArray/.test(text) && /flatMap|reduce/.test(text);
    },
  },
  {
    name: 'chunk-keeps-tail',
    good: 'for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));',
    bad: 'for (let i = 0; i < xs.length - size + 1; i += size) out.push(xs.slice(i, i + size));',
    check(text) {
      return /i\s*<\s*\w+\.length/.test(text) && !/length\s*-\s*size/.test(text);
    },
  },
  {
    name: 'url-requires-http-and-host',
    good: 'const u = new URL(s); return ["http:", "https:"].includes(u.protocol) && Boolean(u.hostname);',
    bad: 'return Boolean(new URL(s));',
    check(text) {
      return /https?:/.test(text) && /hostname|host|netloc/.test(text);
    },
  },
  {
    name: 'ipv4-range-check',
    good: 'return parts.length === 4 && parts.every(p => Number(p) >= 0 && Number(p) <= 255);',
    bad: 'return /^\\d{1,3}(\\.\\d{1,3}){3}$/.test(s);',
    check(text) {
      return /255/.test(text) && /length\s*={2,3}\s*4|IPv4Address|ipaddress/.test(text);
    },
  },
  {
    name: 'email-not-parse-only',
    good: 'return /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email);',
    bad: 'return parseaddr(email)[1] === email && email.includes("@");',
    check(text) {
      return /\.[^\\s]*\+|\.[^@]|\\\./.test(text) && /@/.test(text) && !/parseaddr/.test(text);
    },
  },
  {
    name: 'credit-card-luhn',
    good: 'for (let i = digits.length - 1; i >= 0; i--) { if (double) n *= 2; if (n > 9) n -= 9; sum += n; } return sum % 10 === 0;',
    bad: 'return /^\\d{16}$/.test(card);',
    check(text) {
      return /sum\s*%\s*10/.test(text) && />\s*9/.test(text);
    },
  },
];

function usage() {
  console.error('Usage: render-lean-robustness-eval.js [--json]');
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

function evaluateCase(testCase) {
  const goodPass = testCase.check(testCase.good);
  const badPass = testCase.check(testCase.bad);
  return {
    name: testCase.name,
    status: goodPass && !badPass ? 'pass' : 'fail',
    good_pass: goodPass,
    bad_rejected: !badPass,
    reason: goodPass && !badPass ? 'Known-good accepted and known-lazy-wrong rejected.' : 'Robustness grader did not distinguish good from lazy-wrong.',
  };
}

function buildLeanRobustnessEval() {
  const cases = CASES.map(evaluateCase);
  const failures = cases.filter((item) => item.status === 'fail').length;
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    status: failures ? 'fail' : 'pass',
    cases,
    summary: { cases: cases.length, failures },
    next: failures ? 'Fix robustness graders before using them as lean correctness canaries.' : '/forgeflow-lean-eval',
    boundary: 'Lean robustness eval is a deterministic selftest for known-good and known-lazy-wrong snippets. It does not call models, run generated code, install dependencies, mutate context, commit, push, or call the network.',
  };
}

function renderMarkdown(result) {
  const lines = ['# Forgeflow Lean Robustness Eval', '', `Status: ${result.status}`, '', result.boundary, '', '## Cases', ''];
  for (const item of result.cases) lines.push(`- ${item.status}: ${item.name} - ${item.reason}`);
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildLeanRobustnessEval();
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
    if (result.status === 'fail') process.exit(1);
  } catch (err) {
    console.error(`lean robustness eval failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  CASES,
  buildLeanRobustnessEval,
  parseArgs,
  renderMarkdown,
};
