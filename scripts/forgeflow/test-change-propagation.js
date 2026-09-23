#!/usr/bin/env node
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkPropagation, main } = require('./check-change-propagation');
const corpus = require('../../fixtures/change-propagation/corpus.json');
const key = require('../../fixtures/change-propagation/answer-key.json');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-propagation-'));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
assert.equal(hash(fs.readFileSync(path.resolve(__dirname, '../../fixtures/change-propagation/corpus.json'))), key.provenance.source_revision);
const manifest = {
  schema_version: '1',
  sources: Object.entries(corpus.sources).map(([file, content]) => ({ path: file, sha256: hash(content) })),
  consumers: corpus.consumers.map(item => ({ path: item.path, sources: [item.source], command: item.command, checks: [{ contains: item.contains }, { absent: item.absent }] })),
};
const writeCase = variant => {
  for (const [file, content] of Object.entries(corpus.sources)) fs.writeFileSync(path.join(root, file), content);
  for (const item of corpus.consumers) fs.writeFileSync(path.join(root, item.path), item[variant]);
};
const load = file => { const resolved = path.join(root, file); delete require.cache[resolved]; return require(resolved); };
try {
  writeCase('stale');
  const stale = checkPropagation(manifest, root);
  assert.deepEqual(stale.consumers.filter(item => item.status === 'stale').map(item => item.path), key.stale_consumers);
  assert.deepEqual(load('import.cjs')(load('export.cjs')(key.round_trip)), key.round_trip); // Legacy pair agrees with itself.
  assert.notEqual(JSON.parse(load('export.cjs')(key.round_trip)).version, 2);
  assert.notDeepEqual(load('backup.cjs').restore(load('backup.cjs').save(key.round_trip)), key.round_trip);
  writeCase('current');
  const current = checkPropagation(manifest, root);
  assert.equal(current.status, 'current');
  assert.deepEqual(current.consumers.map(item => item.path), key.current_consumers);
  assert.deepEqual(load('import.cjs')(load('export.cjs')(key.round_trip)), key.round_trip);
  assert.equal(JSON.parse(load('export.cjs')(key.round_trip)).version, 2);
  assert.deepEqual(load('backup.cjs').restore(load('backup.cjs').save(key.round_trip)), key.round_trip);
  assert.deepEqual(load('import.cjs')(key.legacy_import.input), key.legacy_import.expected);
  // A current writer with an old reader loses the value despite each file existing.
  fs.writeFileSync(path.join(root, 'import.cjs'), corpus.consumers.find(item => item.path === 'import.cjs').stale);
  assert.notDeepEqual(load('import.cjs')(load('export.cjs')(key.round_trip)), key.round_trip);
  writeCase('current');
  const before = Object.fromEntries(fs.readdirSync(root).map(file => [file, hash(fs.readFileSync(path.join(root, file)))]));
  const scope = structuredClone(manifest);
  scope.consumers[0].command = 'touch should-not-exist';
  scope.consumers.push({ path: 'related-card.html', repository: 'related-site', sources: ['branding.json'], command: null, checks: [] });
  const related = checkPropagation(scope, root);
  assert.equal(related.consumers.at(-1).status, 'unverified');
  assert.match(related.consumers.at(-1).reason, /Related repository/);
  assert.deepEqual(Object.fromEntries(fs.readdirSync(root).map(file => [file, hash(fs.readFileSync(path.join(root, file)))])), before);
  fs.appendFileSync(path.join(root, 'branding.json'), ' ');
  const changed = checkPropagation(manifest, root);
  assert.ok(changed.consumers.slice(0, 3).every(item => item.status === 'unverified'));
  assert.ok(changed.consumers.slice(3).every(item => item.status === 'current'));
  writeCase('current');
  const unchecked = structuredClone(manifest);
  unchecked.consumers[0].checks = [];
  assert.equal(checkPropagation(unchecked, root).consumers[0].status, 'unverified');
  fs.unlinkSync(path.join(root, 'guide.html'));
  assert.equal(checkPropagation(manifest, root).consumers[1].status, 'unverified');
  fs.symlinkSync(path.join(root, 'favicon.html'), path.join(root, 'guide.html'));
  assert.equal(checkPropagation(manifest, root).consumers[1].status, 'unverified');
  fs.unlinkSync(path.join(root, 'guide.html'));
  writeCase('current');
  for (const invalid of ['../outside', '/outside', 'a/../../outside', 'a\\outside']) {
    const bad = structuredClone(manifest); bad.consumers[0].path = invalid;
    assert.throws(() => checkPropagation(bad, root), /relative/);
  }
  const badSource = structuredClone(manifest); badSource.consumers[0].sources = ['unknown'];
  assert.throws(() => checkPropagation(badSource, root), /known sources/);
  const duplicate = structuredClone(manifest); duplicate.consumers.push(duplicate.consumers[0]);
  assert.throws(() => checkPropagation(duplicate, root), /Duplicate consumer/);
  const file = path.join(root, 'impact.json'); fs.writeFileSync(file, JSON.stringify(manifest));
  assert.equal(main(['--root', root, '--input', file]).status, 'current');
  assert.throws(() => main(['--input', file]), /Usage/);
  console.log('change propagation: stale/clean references, schema round trips, source invalidation, external boundaries and read-only checks passed');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
