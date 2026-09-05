#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeFileSafe, appendFileSafe } = require('./file-safety');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-safe-write-'));
try {
  const regular = path.join(root, 'nested', 'regular.txt');
  writeFileSafe(regular, 'first', { mode: 0o600 });
  appendFileSafe(regular, '-second', 'utf8');
  assert.equal(fs.readFileSync(regular, 'utf8'), 'first-second');
  writeFileSafe(regular, 'new', 'utf8');
  assert.equal(fs.readFileSync(regular, 'utf8'), 'new');
  assert.equal(fs.statSync(regular).mode & 0o777, 0o600);

  const target = path.join(root, 'existing.txt');
  const absent = path.join(root, 'absent.txt');
  fs.writeFileSync(target, 'preserve');
  fs.symlinkSync(target, path.join(root, 'link'));
  fs.symlinkSync(absent, path.join(root, 'dangling'));
  fs.linkSync(target, path.join(root, 'hardlink'));
  fs.mkdirSync(path.join(root, 'directory'));
  fs.symlinkSync(path.join(root, 'nested'), path.join(root, 'linked-parent'), 'dir');
  fs.symlinkSync(path.join(root, 'absent-directory'), path.join(root, 'dangling-parent'), 'dir');

  for (const write of [writeFileSafe, appendFileSafe]) {
    for (const name of ['link', 'dangling', 'hardlink', 'directory', 'linked-parent/child', 'dangling-parent/child']) {
      assert.throws(() => write(path.join(root, name), 'unwanted'), /Refusing/);
    }
    assert.equal(fs.readFileSync(target, 'utf8'), 'preserve');
    assert.equal(fs.existsSync(absent), false);
    assert.equal(fs.existsSync(path.join(root, 'nested/child')), false);
    assert.equal(fs.existsSync(path.join(root, 'absent-directory')), false);
  }
  console.log('file safety: ok');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
