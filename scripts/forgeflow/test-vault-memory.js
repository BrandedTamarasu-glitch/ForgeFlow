#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { connect, noteFileName, publishNote, publishLearning, readVaultMemory, readConnection, renderNote } = require('./vault-memory');
const { selectMemoryRecords, renderMemorySelection } = require('./memory-retrieval');
const { buildMemoryIndex } = require('./index-memory');
const { buildMemoryHits } = require('./build-context-pack');
const { normalizeEntry, recordProjectLearning } = require('./record-project-learning');
const { RUNTIME_HELPERS } = require('./install-manifest');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-vault-test-'));
let count = 0;
function test(name, fn) { fn(); count++; console.log(`PASS ${name}`); }
function fixture(name) {
  const root = path.join(temp, name);
  fs.mkdirSync(root, { recursive: true });
  const result = spawnSync('git', ['init', '-q', root], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  fs.writeFileSync(path.join(root, 'source.js'), 'const greeting = "hello";\n');
  return root;
}
const desktop = fixture('desktop-checkout');
const laptop = fixture('different-folder-on-laptop');
const vault = path.join(temp, 'Obsidian Vault');
fs.mkdirSync(path.join(vault, '.obsidian'), { recursive: true });
fs.writeFileSync(path.join(vault, 'Personal.md'), 'leave this alone');
const projectDir = root => path.join(root, '.forgeflow', path.basename(root));
const options = root => ({ root, projectDir: projectDir(root) });
const input = { title: 'Portable source guidance', body: 'Check the greeting source before changing the interface.', dependencies: ['source.js'] };
let original;

test('runtime installer includes the new helper', () => assert.ok(RUNTIME_HELPERS.includes('scripts/forgeflow/vault-memory.js')));
test('project identity is explicit and directory-independent', () => {
  assert.throws(() => connect({ root: desktop, vault, projectId: '../escape' }));
  connect({ root: desktop, vault, projectId: 'shared-project', publishLearnings: true });
  connect({ root: laptop, vault, projectId: 'shared-project' });
  assert.equal(readConnection(laptop).project_id, readConnection(desktop).project_id);
  assert.throws(() => connect({ root: laptop, vault, projectId: 'different-project' }));
});
test('preview creates no vault note', () => {
  const preview = publishNote({ root: desktop, note: input, dryRun: true });
  assert.equal(preview.status, 'preview');
  assert.ok(preview.markdown.startsWith('---\n'));
  assert.equal(readVaultMemory(desktop).notes.length, 0);
});
test('desktop note transfers into laptop retrieval and context pack', () => {
  original = publishNote({ root: desktop, note: input });
  const state = readVaultMemory(laptop);
  assert.equal(state.records.length, 1);
  assert.equal(state.records[0].vault_freshness, 'sources-match');
  const index = buildMemoryIndex({ ...options(laptop) });
  assert.equal(index.index.records.filter(record => record.kind === 'vault-memory').length, 1);
  const selection = selectMemoryRecords(index.index.records, 'greeting', options(laptop));
  assert.equal(selection.selected.length, 1);
  assert.equal(selection.selected[0].label, 'verify');
  assert.match(renderMemorySelection(selection), /not instructions or current validation evidence/);
  const hits = buildMemoryHits(laptop, ['source.js'], { reasons: [] }, 'greeting', 8000, index.out);
  assert.match(hits, /Portable source guidance/);
  assert.equal(fs.readFileSync(path.join(vault, 'Personal.md'), 'utf8'), 'leave this alone');
});
test('saved indexes recheck current source and vault content', () => {
  const records = readVaultMemory(laptop).records;
  fs.writeFileSync(path.join(laptop, 'source.js'), 'changed locally');
  assert.equal(selectMemoryRecords(records, 'greeting', options(laptop)).selected.length, 0);
  fs.copyFileSync(path.join(desktop, 'source.js'), path.join(laptop, 'source.js'));
  assert.equal(selectMemoryRecords(records, 'greeting', options(laptop)).selected.length, 1);
});
test('unrelated projects cannot read the notes', () => {
  const other = fixture('another-project');
  connect({ root: other, vault, projectId: 'unrelated' });
  assert.equal(selectMemoryRecords(readVaultMemory(laptop).records, 'greeting', options(other)).selected.length, 0);
});
test('unavailable vault excludes cached notes and preserves local memory', () => {
  const records = [...readVaultMemory(laptop).records, { id: 'local', text: 'greeting local rule', source: 'patterns.md' }];
  fs.renameSync(vault, `${vault}-offline`);
  const selection = selectMemoryRecords(records, 'greeting', options(laptop));
  assert.equal(selection.selected.length, 1);
  assert.equal(selection.selected[0].id, 'local');
  assert.match(renderMemorySelection(selection), /Shared vault unavailable/);
  fs.renameSync(`${vault}-offline`, vault);
});
test('superseded guidance is withheld even from saved indexes', () => {
  const saved = readVaultMemory(laptop).records;
  publishNote({ root: desktop, note: { ...input, body: 'Use the revised greeting interface.', supersedes: [original.id] } });
  const current = selectMemoryRecords(saved, 'greeting', options(laptop));
  assert.equal(current.selected.length, 1);
  assert.match(current.selected[0].text, /revised greeting/);
  assert.doesNotMatch(current.selected[0].text, /before changing/);
});
test('concurrent revisions are withheld until an explicit merge', () => {
  const parent = readVaultMemory(laptop).notes.find(note => note.id !== original.id);
  const branch1 = { ...parent, id: 'vm_' + 'a'.repeat(32), parents: [parent.id], body: 'Greeting option one' };
  const branch2 = { ...parent, id: 'vm_' + 'b'.repeat(32), parents: [parent.id], body: 'Greeting option two' };
  const dir = path.dirname(original.file);
  fs.writeFileSync(path.join(dir, noteFileName(branch1)), renderNote(branch1));
  fs.writeFileSync(path.join(dir, noteFileName(branch2)), renderNote(branch2));
  assert.equal(selectMemoryRecords([], 'greeting', options(laptop)).selected.length, 0);
  assert.equal(publishNote({ root: laptop, note: { ...input, supersedes: [branch1.id] } }).status, 'blocked');
  publishNote({ root: laptop, note: { ...input, body: 'Greeting decision resolved.', supersedes: [branch1.id, branch2.id] } });
  assert.equal(selectMemoryRecords([], 'greeting', options(laptop)).selected.length, 1);
});
test('separate contradictory decisions are withheld by conflict key', () => {
  publishNote({ root: desktop, note: { title: 'Cache policy', body: 'Caching uses a shared store.', conflict_key: 'cache_policy', conflict_value: 'shared' } });
  publishNote({ root: laptop, note: { title: 'Cache policy', body: 'Caching uses process memory.', conflict_key: 'cache_policy', conflict_value: 'process' } });
  assert.equal(selectMemoryRecords([], 'caching', options(laptop)).selected.length, 0);
});
test('secrets and traversal never reach the vault', () => {
  const before = readVaultMemory(desktop).notes.length;
  assert.throws(() => publishNote({ root: desktop, note: { ...input, body: 'password=bad-value' } }), /sensitive/);
  assert.throws(() => publishNote({ root: desktop, note: { ...input, body: 'See /home/someone/private/file' } }), /machine-specific/);
  assert.throws(() => publishNote({ root: desktop, note: { ...input, dependencies: ['../Personal.md'] } }), /relative/);
  assert.throws(() => publishNote({ root: desktop, note: { ...input, dependencies: ['.env'] } }), /relative/);
  assert.throws(() => publishNote({ root: desktop, note: { ...input, body: '\u754c'.repeat(12000) } }), /size limit/);
  assert.equal(readVaultMemory(desktop).notes.length, before);
});
test('malformed and sync-conflict notes fail closed without leaking content', () => {
  const dir = path.dirname(original.file);
  const conflict = path.join(dir, 'note (Conflicted copy).md');
  fs.copyFileSync(original.file, conflict);
  assert.equal(readVaultMemory(laptop).status, 'connected');
  assert.ok(readVaultMemory(laptop).records.filter(record => record.id === `vault:${original.id}`).every(record => record.lifecycle === 'invalid' || record.conflict_withheld));
  assert.equal(selectMemoryRecords([], 'greeting', options(laptop)).selected.length, 0);
  fs.unlinkSync(conflict);
  fs.writeFileSync(conflict, 'not a valid Forgeflow note');
  assert.equal(readVaultMemory(laptop).status, 'unavailable');
  fs.unlinkSync(conflict);
});
test('symlinks, hardlinks and oversized notes are refused', () => {
  const dir = path.dirname(original.file);
  const bad = path.join(dir, 'bad.md');
  fs.symlinkSync(path.join(vault, 'Personal.md'), bad);
  assert.equal(readVaultMemory(laptop).status, 'unavailable'); fs.unlinkSync(bad);
  fs.linkSync(path.join(vault, 'Personal.md'), bad);
  assert.equal(readVaultMemory(laptop).status, 'unavailable'); fs.unlinkSync(bad);
  fs.writeFileSync(bad, 'x'.repeat(33000));
  assert.equal(readVaultMemory(laptop).status, 'unavailable'); fs.unlinkSync(bad);
  const alias = path.join(temp, 'vault-alias'); fs.symlinkSync(vault, alias);
  assert.throws(() => connect({ root: laptop, vault: alias, projectId: 'shared-project' }), /symlink/);
});
test('opted-in learning recorder mirrors new notes and lifecycle retirement', () => {
  const learning = { category: 'stable-decision', learning: 'Durable memory uses reviewed Markdown notes.', source: 'Atlas' };
  const first = recordProjectLearning({ ...options(desktop), inputEntries: [learning] });
  assert.equal(first.vault[0].status, 'published');
  assert.equal(selectMemoryRecords([], 'Durable', options(laptop)).selected.length, 1);
  const retry = recordProjectLearning({ ...options(desktop), inputEntries: [learning] });
  assert.equal(retry.vault[0].status, 'unchanged');
  recordProjectLearning({ ...options(desktop), inputEntries: [{ ...learning, status: 'superseded' }] });
  assert.equal(selectMemoryRecords([], 'Durable', options(laptop)).selected.length, 0);
});
test('disconnected and opt-out checkouts keep learning writes local', () => {
  const learning = { category: 'stable-decision', learning: 'Do not copy unrelated project notes.', source: 'Atlas' };
  const result = recordProjectLearning({ ...options(laptop), inputEntries: [learning] });
  assert.equal(result.vault, undefined);
  const root = fixture('disconnected');
  assert.equal(readVaultMemory(root).status, 'disconnected');
  assert.equal(recordProjectLearning({ ...options(root), inputEntries: [learning] }).vault, undefined);
});
test('default local memory records and retrieves without a vault or publication queue', () => {
  const root = fixture('local-default');
  const learning = { category: 'stable-decision', learning: 'Localfirstpolicy keeps memory available without optional integrations.', source: 'Atlas' };
  const result = recordProjectLearning({ ...options(root), inputEntries: [learning] });
  assert.equal(result.entries, 1);
  assert.equal(result.vault, undefined);
  assert.ok(fs.readFileSync(result.file, 'utf8').includes(learning.learning));
  const index = buildMemoryIndex(options(root));
  const selection = selectMemoryRecords(index.index.records, 'Localfirstpolicy', options(root));
  assert.equal(selection.selected.length, 1);
  assert.match(selection.selected[0].text, /Localfirstpolicy/);
  assert.equal(readConnection(root), null);
  assert.equal(fs.existsSync(path.join(root, '.forgeflow', 'vault-outbox')), false);
});
test('missing vault and malformed connection do not break local recording or retrieval', () => {
  for (const mode of ['missing-vault', 'invalid-connection']) {
    const root = fixture(mode);
    connect({ root, vault, projectId: mode, publishLearnings: true });
    const configFile = path.join(root, '.forgeflow', 'vault.json');
    if (mode === 'missing-vault') {
      const config = readConnection(root);
      fs.writeFileSync(configFile, JSON.stringify({ ...config, vault: path.join(temp, 'absent-vault') }));
    } else fs.writeFileSync(configFile, '{invalid json');
    const learning = { category: 'stable-decision', learning: 'Fallbackpolicy retains local guidance when sharing cannot run.', source: 'Atlas' };
    const result = recordProjectLearning({ ...options(root), inputEntries: [learning] });
    assert.equal(result.entries, 1);
    assert.ok(fs.readFileSync(result.file, 'utf8').includes(learning.learning));
    assert.equal(result.vault[0].status, mode === 'missing-vault' ? 'queued' : 'unavailable');
    const index = buildMemoryIndex(options(root));
    const selection = selectMemoryRecords(index.index.records, 'Fallbackpolicy', options(root));
    assert.equal(selection.selected.length, 1);
    assert.match(selection.selected[0].text, /Fallbackpolicy/);
    assert.match(renderMemorySelection(selection), /Shared vault unavailable/);
  }
});
test('stale provenance cannot publish new active guidance but cannot block retirement', () => {
  const entry = normalizeEntry({ category: 'risk-area', learning: 'Retirement must survive changed evidence.', source: 'Atlas' });
  assert.equal(publishLearning(desktop, entry).status, 'published');
  entry.provenance = { schema_version: 'unsupported', evidence: [] };
  assert.equal(publishLearning(desktop, entry).status, 'withheld');
  assert.equal(publishLearning(desktop, { ...entry, status: 'stale' }).status, 'published');
  assert.equal(selectMemoryRecords([], 'Retirement', options(laptop)).selected.length, 0);
});
test('retirement on another computer suppresses the old local mirror too', () => {
  const entry = { category: 'stable-decision', learning: 'Handshakepolicy uses explicit version negotiation.', source: 'Atlas' };
  const written = recordProjectLearning({ ...options(desktop), inputEntries: [entry] });
  const index = buildMemoryIndex(options(desktop)).index.records;
  assert.equal(selectMemoryRecords(index, 'Handshakepolicy', options(desktop)).selected.length, 1, 'mirror should not duplicate the local candidate');
  publishNote({ root: laptop, note: { title: 'Handshakepolicy retired', body: 'Handshakepolicy no longer applies.', status: 'superseded', supersedes: [written.vault[0].id] } });
  assert.equal(selectMemoryRecords(index, 'Handshakepolicy', options(desktop)).selected.length, 0);
});
test('unpublished local edits cannot silently select an older shared version', () => {
  const entry = { category: 'stable-decision', learning: 'Dispatchpolicy controls task ordering.', source: 'Atlas', application_guidance: 'Use the first ordering rule.' };
  recordProjectLearning({ ...options(desktop), inputEntries: [entry] });
  connect({ root: desktop, vault, projectId: 'shared-project' });
  recordProjectLearning({ ...options(desktop), inputEntries: [{ ...entry, application_guidance: 'Use the reviewed ordering rule.' }] });
  connect({ root: desktop, vault, projectId: 'shared-project', publishLearnings: true });
  assert.equal(selectMemoryRecords(buildMemoryIndex(options(desktop)).index.records, 'Dispatchpolicy', options(desktop)).selected.length, 0);
});
test('auto-publish failures preserve local notes and report delivery failure', () => {
  fs.renameSync(vault, `${vault}-offline`);
  const result = recordProjectLearning({ ...options(desktop), inputEntries: [{ category: 'risk-area', learning: 'Offline guidance remains available locally.', source: 'Atlas' }] });
  assert.equal(result.entries, 1);
  assert.equal(result.vault[0].status, 'queued');
  fs.renameSync(`${vault}-offline`, vault);
});
test('missing revision ancestors are withheld rather than treated as new guidance', () => {
  const root = fixture('missing-ancestor');
  connect({ root, vault, projectId: 'ancestor-test' });
  const initial = publishNote({ root, note: input });
  publishNote({ root, note: { ...input, supersedes: [initial.id] } });
  fs.unlinkSync(initial.file);
  assert.equal(readVaultMemory(root).incomplete, 1);
  assert.equal(selectMemoryRecords([], 'greeting', options(root)).selected.length, 0);
});
test('retired guidance never reactivates through a malformed cyclic history', () => {
  const root = fixture('cyclic-history');
  connect({ root, vault, projectId: 'cycle-test' });
  const initial = publishNote({ root, note: input });
  const note = readVaultMemory(root).notes[0];
  const child = { ...note, id: 'vm_' + 'c'.repeat(32), parents: [note.id] };
  note.parents = [child.id];
  fs.writeFileSync(initial.file, renderNote(note));
  fs.writeFileSync(path.join(path.dirname(initial.file), noteFileName(child)), renderNote(child));
  assert.equal(readVaultMemory(root).incomplete, 1);
  assert.equal(selectMemoryRecords([], 'greeting', options(root)).selected.length, 0);
});
test('CLI disconnect preserves shared notes and excludes old indexed records', () => {
  const saved = readVaultMemory(laptop).records;
  const result = spawnSync(process.execPath, [path.join(__dirname, 'vault-memory.js'), 'disconnect', '--root', laptop], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).notes_preserved, true);
  assert.equal(selectMemoryRecords(saved, 'greeting', options(laptop)).selected.length, 0);
  assert.ok(fs.existsSync(original.file));
});
console.log(`${count} vault memory checks passed`);
fs.rmSync(temp, { recursive: true, force: true });
