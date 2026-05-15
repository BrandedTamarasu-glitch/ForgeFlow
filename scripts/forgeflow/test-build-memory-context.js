#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildMemoryContext } = require('./build-memory-context');

const repoRoot = path.resolve(__dirname, '..', '..');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-memory-context-'));
const out = path.join(tmpDir, 'memory-context.md');
const result = buildMemoryContext({
  projectDir: path.join(repoRoot, 'fixtures/memory-index'),
  query: 'plan auth session token review',
  out,
  indexOut: path.join(tmpDir, 'memory-index.json'),
  maxHits: 8,
  maxChars: 4000,
});

const content = fs.readFileSync(out, 'utf8');
const checks = [
  ['result path', result.out === out],
  ['context written', fs.existsSync(out)],
  ['sources counted', result.sources === 3],
  ['hits selected', result.selected_count > 0],
  ['index path included', content.includes('Index:')],
  ['session hit included', content.includes('Session token reviews')],
  ['plan heading included', content.includes('Review Context Plan')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log('memory context: ok');
