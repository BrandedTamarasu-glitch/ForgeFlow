'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { assertSafeDirectory, assertSafeDestination, safeReadTextFile } = require('./file-safety');
const directory = root => path.join(root, '.forgeflow', 'vault-outbox');
function listIntents(root) {
  const dir = directory(root); assertSafeDirectory(dir);
  if (!fs.existsSync(dir)) return [];
  const names = fs.readdirSync(dir).filter(name => /^vm_[a-f0-9]{32}\.json$/.test(name));
  if (names.length > 2000) throw new Error('Publication queue exceeds limit');
  return names.map(name => {
    const file = path.join(dir, name);
    if (fs.lstatSync(file).size > 128 * 1024) throw new Error('Invalid publication intent');
    const value = JSON.parse(safeReadTextFile(file, root).content);
    if (value.schema_version !== 1 || `${value.id}.json` !== name || !['pending', 'published', 'blocked', 'cancelled'].includes(value.state)
      || typeof value.markdown !== 'string' || !value.note || !value.connection || !Number.isSafeInteger(value.sequence)) throw new Error('Invalid publication intent');
    return value;
  }).sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
}
function saveIntent(root, intent) {
  if (!/^vm_[a-f0-9]{32}$/.test(intent.id)) throw new Error('Invalid publication identity');
  const dir = directory(root); assertSafeDirectory(dir); fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, `${intent.id}.json`); assertSafeDestination(file);
  const temp = path.join(dir, `.${intent.id}.${crypto.randomBytes(8).toString('hex')}.tmp`);
  const fd = fs.openSync(temp, 'wx', 0o600);
  try { fs.writeFileSync(fd, `${JSON.stringify(intent)}\n`); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  try { fs.renameSync(temp, file); } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
  const dirfd = fs.openSync(dir, 'r'); try { fs.fsyncSync(dirfd); } finally { fs.closeSync(dirfd); }
}
function withLock(root, run) {
  const dir = directory(root); assertSafeDirectory(dir); fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const lock = path.join(dir, '.lock');
  const busy = () => new Error('Publication queue is busy; retry after the publisher exits.');
  try { fs.mkdirSync(lock); } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    assertSafeDirectory(lock);
    const owners = fs.readdirSync(lock);
    if (owners.length !== 1 || !/^[1-9][0-9]*$/.test(owners[0])) throw busy();
    let dead = false;
    try { process.kill(Number(owners[0]), 0); } catch (error) { dead = error.code === 'ESRCH'; }
    if (!dead) throw busy();
    // Only the process that exclusively removes the dead owner's marker may reclaim.
    try { fs.unlinkSync(path.join(lock, owners[0])); fs.rmdirSync(lock); fs.mkdirSync(lock); } catch (_) { throw busy(); }
  }
  const owner = path.join(lock, String(process.pid));
  const fd = fs.openSync(owner, 'wx', 0o600); fs.closeSync(fd);
  try { return run(); } finally { fs.unlinkSync(owner); fs.rmdirSync(lock); }

}
function outboxStatus(root) {
  try {
    const intents = listIntents(root);
    return { pending: intents.filter(x => x.state === 'pending').length, published: intents.filter(x => x.state === 'published').length, blocked: intents.filter(x => x.state === 'blocked').length };
  } catch (_) { return { status: 'unavailable', warning: 'Publication queue could not be read safely.' }; }
}
module.exports = { listIntents, saveIntent, withLock, outboxStatus };
