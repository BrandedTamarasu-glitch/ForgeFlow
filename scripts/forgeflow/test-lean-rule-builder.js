#!/usr/bin/env node
const {
  buildLeanRule,
  buildPortableRule,
  instructionLines,
} = require('./lean-rule-builder');
const { buildLeanSession } = require('./render-lean-session');

const rule = buildLeanRule('lite');
const session = buildLeanSession({ root: process.cwd(), projectDir: '/tmp/missing-forgeflow', profile: 'lite' });
const portable = buildPortableRule({ profile: 'ultra', heading: '# Test Rule', source: 'test' });

const checks = [
  ['lite rule contains one-line alternative', rule.includes('name the smaller alternative')],
  ['session uses canonical rule text', session.instructions === rule],
  ['off rule is short', instructionLines('off').length === 1 && buildLeanRule('off').includes('off')],
  ['portable rule wraps canonical text', portable.includes('# Test Rule') && portable.includes('Profile: ultra') && portable.includes(buildLeanRule('ultra'))],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('lean rule builder: ok');
