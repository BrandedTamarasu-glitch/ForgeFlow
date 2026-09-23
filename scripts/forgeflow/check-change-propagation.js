#!/usr/bin/env node
const crypto = require('node:crypto');
const path = require('node:path');
const { safeReadTextFile } = require('./file-safety');

const hash = content => crypto.createHash('sha256').update(content).digest('hex');
function relative(value) {
  if (typeof value !== 'string' || !value || /[\\\x00-\x1f:]/.test(value) || path.isAbsolute(value) || value.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Expected a repository-relative path');
  return value;
}

function checkPropagation(manifest, root) {
  root = path.resolve(root);
  if (manifest.schema_version !== '1' || !Array.isArray(manifest.sources) || !manifest.sources.length || manifest.sources.length > 50 || !Array.isArray(manifest.consumers) || !manifest.consumers.length || manifest.consumers.length > 200) throw new Error('Expected schema 1 with 1-50 sources and 1-200 consumers');
  const sources = new Map();
  for (const source of manifest.sources) {
    relative(source.path);
    if (sources.has(source.path) || !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error('Sources require unique paths and SHA256 identities');
    sources.set(source.path, source);
  }
  const seen = new Set();
  for (const consumer of manifest.consumers) {
    relative(consumer.path);
    if (consumer.repository !== undefined && (typeof consumer.repository !== 'string' || !consumer.repository.trim())) throw new Error('repository must be a nonempty related-repository identifier');
    const identity = JSON.stringify([consumer.repository || '', consumer.path]);
    if (seen.has(identity)) throw new Error('Duplicate consumer; combine its source relationships');
    seen.add(identity);
    if (!Array.isArray(consumer.sources) || !consumer.sources.length || consumer.sources.some(source => !sources.has(source))) throw new Error('Consumer requires known sources');
    if (consumer.command !== null && (typeof consumer.command !== 'string' || !consumer.command.trim())) throw new Error('command must be text or null');
    if (!Array.isArray(consumer.checks) || consumer.checks.length > 20) throw new Error('Expected at most 20 checks per consumer');
    for (const check of consumer.checks) {
      const keys = Object.keys(check);
      if (keys.length !== 1 || !['contains', 'absent'].includes(keys[0]) || typeof check[keys[0]] !== 'string' || !check[keys[0]] || check[keys[0]].length > 4000) throw new Error('Each check requires one nonempty contains or absent literal');
    }
  }
  // Read only text inputs. Missing or unsafe files stay explicit gaps.
  const read = file => {
    try { const content = safeReadTextFile(path.join(root, file), root).content; return { content, sha256: hash(content) }; }
    catch { return { error: 'File unavailable or unsafe to read' }; }
  };
  const observed = new Map([...sources].map(([file, expected]) => {
    const result = read(file);
    return [file, { path: file, expected_sha256: expected.sha256, sha256: result.sha256 || null, status: result.error || result.sha256 !== expected.sha256 ? 'unverified' : 'current' }];
  }));
  const consumers = manifest.consumers.map(consumer => {
    const result = { path: consumer.path, repository: consumer.repository || null, sources: consumer.sources, command: consumer.command, sha256: null, status: 'unverified', checks: [] };
    if (consumer.repository) return { ...result, reason: 'Related repository requires separate scoped verification' };
    if (consumer.sources.some(source => observed.get(source).status !== 'current')) return { ...result, reason: 'Source identity changed or is unavailable; reassess expectations' };
    const artifact = read(consumer.path);
    if (artifact.error) return { ...result, reason: artifact.error };
    result.sha256 = artifact.sha256;
    if (!consumer.checks.length) return { ...result, reason: 'No text checks; manual or runtime evidence required' };
    result.checks = consumer.checks.map(check => ({ ...check, passed: Object.hasOwn(check, 'contains') ? artifact.content.includes(check.contains) : !artifact.content.includes(check.absent) }));
    result.status = result.checks.every(check => check.passed) ? 'current' : 'stale';
    return result;
  });
  return { schema_version: '1', status: [...observed.values(), ...consumers].every(item => item.status === 'current') ? 'current' : 'incomplete', sources: [...observed.values()], consumers,
    boundary: 'Read-only literal checks for listed consumers only. No generators run. Does not establish complete discovery, semantics, image appearance or deployed freshness.' };
}

function main(argv) {
  const [rootFlag, root, inputFlag, input, ...extra] = argv;
  if (rootFlag !== '--root' || !root || inputFlag !== '--input' || !input || extra.length) throw new Error('Usage: check-change-propagation.js --root <checkout> --input <manifest.json>');
  return checkPropagation(JSON.parse(safeReadTextFile(path.resolve(input)).content), root);
}
if (require.main === module) {
  try { const result = main(process.argv.slice(2)); process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); process.exitCode = result.status === 'current' ? 0 : 1; }
  catch (error) { console.error(error.message); process.exitCode = 2; }
}
module.exports = { checkPropagation, main };
