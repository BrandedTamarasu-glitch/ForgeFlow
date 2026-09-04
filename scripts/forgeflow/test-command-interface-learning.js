#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildLearning, parseArgs } = require('./command-interface-learning');
const { buildMemoryIndex } = require('./index-memory');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-command-learning-'));
const projectDir = path.join(root, '.forgeflow', 'Demo');
const input = path.join(root, 'evidence.json');
const observations = ['one', 'two', 'three'].map((id, index) => ({ id, work_item_id: index === 0 ? 'work-one' : 'work-two', command_chain: ['forgeflow-health', 'forgeflow-smoke'], outcome: 'success', command_calls: 2, decision_output_bytes: 40 }));
fs.writeFileSync(input, JSON.stringify({ schema_version: '1', observations }));
const preview = buildLearning({ root, projectDir, input });
const candidate = preview.candidates[0];
const noWrite = !fs.existsSync(path.join(projectDir, 'project-learning-candidates.jsonl'));
const written = buildLearning({ root, projectDir, input, write: true, candidateId: candidate.id });
const stored = fs.readFileSync(path.join(projectDir, 'project-learning-candidates.jsonl'), 'utf8');
const duplicate = buildLearning({ root, projectDir, input });
const policy = buildLearning({ root, projectDir, setSuggestions: 'off', writePolicy: true });
const suppressed = buildLearning({ root, projectDir, input });
const weakInput = path.join(root, 'weak.json');
fs.writeFileSync(weakInput, JSON.stringify({ schema_version: '1', observations: [observations[0]] }));
const index = buildMemoryIndex({ projectDir });
const reenabled = buildLearning({ root, projectDir, setSuggestions: 'on', writePolicy: true });
const weak = buildLearning({ root, projectDir, input: weakInput });
const duplicateShapeInput = path.join(root, 'duplicate-shape.json');
fs.writeFileSync(duplicateShapeInput, JSON.stringify({ schema_version: '1', observations: ['four', 'five', 'six'].map((id, index) => ({ id, work_item_id: `work-${index + 3}`, command_chain: ['forgeflow-health', 'forgeflow-smoke'], outcome: 'success', command_calls: 2, decision_output_bytes: 40 })) }));
const duplicateShape = buildLearning({ root, projectDir: path.join(root, '.forgeflow', 'Duplicate'), input: duplicateShapeInput });
const checks = [
  ['preview is default and does not write', preview.status === 'preview' && candidate.status === 'ready-to-write' && noWrite],
  ['candidate is aggregate advisory low confidence', candidate.chain_kind === 'full-workflow' && candidate.entry.confidence === 'low' && candidate.entry.category === 'validation-pattern' && !JSON.stringify(candidate.entry).includes('work-one') && candidate.entry.application_guidance.includes('does not approve a wrapper')],
  ['exact-id write appends once', written.candidates[0].status === 'written' && stored.includes(candidate.id)],
  ['repeat preview dedupes active entry', duplicate.candidates[0].status === 'already-recorded'],
  ['project opt-out suppresses suggestions only', policy.suggestions_enabled === false && suppressed.status === 'suppressed' && stored === fs.readFileSync(path.join(projectDir, 'project-learning-candidates.jsonl'), 'utf8')],
  ['weak evidence is not eligible after re-enable', reenabled.suggestions_enabled && weak.status === 'not-eligible'],
  ['memory index includes durable candidate', index.index.records.some((record) => record.text.includes('repeated advisory validation pattern'))],
  ['write requires exact candidate id', (() => { try { parseArgs(['--input', input, '--write']); return false; } catch (_err) { return true; } })()],
  ['deduplicates equivalent full-workflow and pair previews', duplicateShape.candidates.length === 1],
];
let failed = 0;
for (const [name, ok] of checks) { if (!ok) { failed += 1; console.error(`FAIL ${name}`); } }
if (failed) process.exit(1);
console.log('command interface learning: ok');
