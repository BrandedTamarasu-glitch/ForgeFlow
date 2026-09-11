#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { installClaude, installCodex } = require('./install-template');
const { updateForgeflow, rollbackForgeflow } = require('./update-forgeflow');
const { manifestEntry, CODEX_INVENTORY_SOURCE, readCodexInventory } = require('./install-manifest');
const repo = path.resolve(__dirname, '../..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-update-migration-'));
const put = (file, bytes) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); };
// Actual HEAD at the pre-migration audit, pinned so this remains a regression
// after the migration itself is committed. Requires this commit in local history.
const legacyCommit = 'a0a8a85edf21ee406713eff8718f181f4d7401e3';
const version = '1'.repeat(40);
const emberSetup = () => ({ status: 'test' });
(async () => {
  // Exercise the real committed executable and dependencies, not a reconstruction
  // of its deletion logic. All downloads remain injected local bytes.
  const oldRoot = path.join(root, 'head');
  fs.mkdirSync(oldRoot);
  const archive = cp.execFileSync('git', ['archive', legacyCommit, 'scripts/forgeflow', 'agents', '.codex/agents'], { cwd: repo, maxBuffer: 30e6 });
  cp.execFileSync('tar', ['-x', '-C', oldRoot], { input: archive });
  const oldUpdater = require(path.join(oldRoot, 'scripts/forgeflow/update-forgeflow.js'));
  const oldHome = path.join(root, 'old-updater');
  const edited = 'User-maintained legacy review instructions\n';
  put(path.join(oldHome, 'agents/smith-review.md'), edited);
  put(path.join(oldHome, 'forgeflow-version'), `${version}\n`);
  const oldResult = await oldUpdater.updateForgeflow({ home: oldHome, current: version, latest: '2'.repeat(40),
    missingRequired: [], plan: { files: ['agents/builder-review.md', 'scripts/forgeflow/update-forgeflow.js'], deleted: ['agents/smith-review.md'] },
    fetcher: async (_repo, _sha, source) => fs.readFileSync(path.join(repo, source)), emberSetup });
  assert.equal(oldResult.status, 'updated');
  assert.equal(fs.existsSync(path.join(oldHome, 'agents/smith-review.md')), false,
    'negative control: replacing the running HEAD helper does not make its deletion safe');
  assert.equal(oldUpdater.rollbackForgeflow({ home: oldHome }).status, 'rolled-back');
  assert.equal(fs.readFileSync(path.join(oldHome, 'agents/smith-review.md'), 'utf8'), edited);

  for (const target of ['claude', 'codex']) {
    const install = target === 'claude' ? installClaude : installCodex;
    const source = target === 'claude' ? 'agents/smith-review.md' : '.codex/agents/smith-reviewer.toml';
    const replacement = target === 'claude' ? 'agents/builder-review.md' : '.codex/agents/builder-reviewer.toml';
    const other = target === 'claude' ? 'agents/warden-review.md' : '.codex/agents/warden-reviewer.toml';
    const home = path.join(root, target);
    const destination = manifestEntry(source, home, target).destination;
    const canonical = manifestEntry(replacement, home, target).destination;
    put(destination, fs.readFileSync(path.join(oldRoot, source)));
    put(manifestEntry(other, home, target).destination, edited);
    put(path.join(home, 'forgeflow-version'), `${version}\n`);
    // This is the documented bootstrap: execute the installer from the complete
    // new source checkout, without first launching the installed old updater.
    const first = install({ home });
    assert(first.retired.includes(source));
    assert(first.preserved_legacy.includes(other));
    assert.equal(fs.readFileSync(manifestEntry(other, home, target).destination, 'utf8'), edited);
    const snapshot = path.join(home, 'forgeflow/backups/previous/manifest.json');
    const before = fs.readFileSync(snapshot);
    const second = install({ home });
    assert.equal(second.copied.length, 0);
    assert(fs.readFileSync(snapshot).equals(before), 'identical bootstrap preserves recovery snapshot');
    assert.equal(rollbackForgeflow({ home, target }).status, 'rolled-back');
    assert(fs.readFileSync(destination).equals(fs.readFileSync(path.join(oldRoot, source))));
    assert.equal(fs.existsSync(canonical), false);

    install({ home });
    put(destination, fs.readFileSync(path.join(oldRoot, source)));
    put(canonical, 'Customized canonical role\n');
    const inventoryBefore = target === 'codex' ? readCodexInventory(home) : null;
    let downloads = 0;
    const options = { home, target, latest: version, emberSetup,
      fetcher: async () => { downloads += 1; throw new Error('cleanup must not download'); } };
    const cleaned = await updateForgeflow(options);
    assert.equal(cleaned.status, 'updated');
    assert.equal(cleaned.legacy_cleanup, true);
    assert.equal(cleaned.repair, false);
    assert.equal(downloads, 0);
    assert.equal(fs.readFileSync(canonical, 'utf8'), 'Customized canonical role\n');
    assert.equal(fs.existsSync(destination), false);
    if (target === 'codex') assert.deepEqual(readCodexInventory(home), inventoryBefore);
    const cleanupSnapshot = JSON.parse(fs.readFileSync(snapshot));
    assert.deepEqual(cleanupSnapshot.files.map(item => item.source).sort(),
      [source, ...(target === 'codex' ? [CODEX_INVENTORY_SOURCE] : [])].sort());
    // Simulate interruption after deletion but before transaction completion.
    cleanupSnapshot.pending = true;
    fs.writeFileSync(snapshot, JSON.stringify(cleanupSnapshot));
    const retried = await updateForgeflow(options);
    assert.equal(retried.legacy_cleanup, true);
    assert.equal(downloads, 0);
    assert.equal(fs.readFileSync(canonical, 'utf8'), 'Customized canonical role\n');
    assert.equal((await updateForgeflow(options)).status, 'up-to-date');
    assert.equal(rollbackForgeflow({ home, target }).status, 'rolled-back');
    assert(fs.existsSync(destination));
    assert.equal(fs.readFileSync(canonical, 'utf8'), 'Customized canonical role\n');
  }
  console.log('update migration: HEAD control, source bootstrap, no-op recovery, cleanup and retry passed');
})().finally(() => fs.rmSync(root, { recursive: true, force: true })).catch(err => { console.error(err); process.exitCode = 1; });
