#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildMemoryIndex } = require('./index-memory');
const { buildMemoryHits } = require('./build-context-pack');

const repoRoot = path.resolve(__dirname, '..', '..');
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-memory-index-')), 'memory-index.json');
const result = buildMemoryIndex({
  projectDir: path.join(repoRoot, 'fixtures/memory-index'),
  out,
});

const index = JSON.parse(fs.readFileSync(out, 'utf8'));
const allText = index.records.map((record) => `${record.kind} ${record.text} ${(record.keywords || []).join(' ')}`).join('\n');
const memoryHits = buildMemoryHits(repoRoot, ['src/auth/session.ts'], {
  reasons: ['auth-sensitive file changed'],
}, 'review auth session token behavior', 12000, out);
const checks = [
  ['result path', result.out === out],
  ['index written', fs.existsSync(out)],
  ['five sources', index.sources.length === 5],
  ['implementation notes source', index.sources.some((source) => source.path.endsWith('implementation-notes.md'))],
  ['project learnings source', index.sources.some((source) => source.path.endsWith('project-learnings.md'))],
  ['records created', index.records.length >= 16],
  ['heading indexed', index.records.some((record) => record.kind === 'heading' && record.text === 'Review Context Plan')],
  ['bullet indexed', index.records.some((record) => record.kind === 'bullet' && record.text.includes('session changes'))],
  ['implementation note indexed', index.records.some((record) => record.kind === 'bullet' && record.text.includes('retry validation'))],
  ['project learning indexed', index.records.some((record) => record.kind === 'bullet' && record.text.includes('session-token-refresh'))],
  ['jsonl indexed', index.records.some((record) => record.kind === 'jsonl' && record.text.includes('Session token reviews'))],
  ['auth keyword', allText.includes('auth')],
  ['session keyword', allText.includes('session')],
  ['context pack uses index', memoryHits.includes(`Index: ${path.relative(repoRoot, out)}`)],
  ['indexed hit rendered', memoryHits.includes('[jsonl] Session token reviews')],
  ['implementation note hit rendered', memoryHits.includes('implementation-notes.md')],
  ['project learning hit rendered', memoryHits.includes('project-learnings.md')],
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

console.log('memory index: ok');
