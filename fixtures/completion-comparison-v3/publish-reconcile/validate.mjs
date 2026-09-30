import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const base = fileURLToPath(new URL('.', import.meta.url));
const clean = readFileSync(join(base, 'src/store.mjs'), 'utf8');
const mutations = JSON.parse(readFileSync(join(base, 'mutations.json'), 'utf8'));
const root = mkdtempSync(join(tmpdir(), 'publish-reconcile-'));
mkdirSync(join(root, 'src'));
function run(source) {
  writeFileSync(join(root, 'src/store.mjs'), source);
  const result = spawnSync(process.execPath, [join(base, 'acceptance.mjs'), root], { encoding: 'utf8', timeout: 1500 });
  assert.ifError(result.error);
  assert.ok(result.status === 0 || result.status === 1, result.stderr);
  return JSON.parse(result.stdout);
}
try {
  assert.equal(run(clean).pass, true);
  const defective = run(readFileSync(join(base, 'src/store-defective.mjs'), 'utf8'));
  assert.equal(defective.pass, false);
  const evidence = [{ id: 'defective', failed: defective.checks.filter(c => !c.pass).map(c => c.id) }];
  for (const mutation of mutations) {
    assert.equal(clean.split(mutation.find).length, 2, `exactly one target: ${mutation.id}`);
    const result = run(clean.replace(mutation.find, mutation.replace));
    assert.equal(result.pass, false);
    const failed = result.checks.filter(c => !c.pass).map(c => c.id);
    for (const id of mutation.expectedFailedChecks) assert.ok(failed.includes(id), `${mutation.id} must fail ${id}`);
    evidence.push({ id: mutation.id, failed });
  }
  console.log(JSON.stringify({ pass: true, checks: 14, evidence }));
} finally { rmSync(root, { recursive: true, force: true }); }
