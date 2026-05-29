#!/usr/bin/env node
const { buildCommandArgumentCheck, parseArgs, parseCommandArguments, tokenize } = require('./command-args');

const parsed = parseCommandArguments('--json --findings "tmp/findings file.json"', '--json,--findings:path');
const report = buildCommandArgumentCheck({ allow: '--json,--out:path', args: '--json --out "tmp/report.md"' });
const opts = parseArgs(['--allow', '--json,--findings:path', '--args', '--json', '--json']);
let unsafeBlocked = false;
try {
  parseCommandArguments('--json; rm -rf tmp', '--json');
} catch (_err) {
  unsafeBlocked = true;
}
let unsupportedBlocked = false;
try {
  parseCommandArguments('--force', '--json');
} catch (_err) {
  unsupportedBlocked = true;
}
let missingBlocked = false;
try {
  parseCommandArguments('--findings', '--findings:path');
} catch (_err) {
  missingBlocked = true;
}

const checks = [
  ['tokenizes quotes', tokenize('--findings "tmp/findings file.json"').length === 2],
  ['parses boolean and path', parsed.values['--json'] === true && parsed.values['--findings'] === 'tmp/findings file.json'],
  ['builds report', report.status === 'pass' && report.boundary.includes('does not execute')],
  ['blocks unsafe shell metacharacters', unsafeBlocked],
  ['blocks unsupported flags', unsupportedBlocked],
  ['blocks missing values', missingBlocked],
  ['parses cli args', opts.allow === '--json,--findings:path' && opts.args === '--json' && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('command args: ok');
