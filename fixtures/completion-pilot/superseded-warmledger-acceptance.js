// Superseded WarmLedger preparation oracle, retained for reproducibility.
// NOT the Baa-ton PR acceptance; do not use for the current candidate.
const path = require('node:path');
const assert = require('node:assert/strict');
function evaluate(root) {
  const Store = require(path.resolve(root, 'js/data.js'));
  const Schema = require(path.resolve(root, 'js/data-schema.js'));
  const { MemoryStorage, makeV3Budget } = require(path.resolve(root, 'test/helpers.js'));
  let sequence = 0;
  const results = [];
  function setup(value) {
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    const storage = new MemoryStorage({ [Store.STORAGE_KEY]: raw });
    const store = Store.createStore({ storage, now: () => new Date('2026-09-23T12:00:00Z'), uuid: () => `fixture-${++sequence}` });
    store.load();
    return { store, storage, raw };
  }
  function persisted(x) { return JSON.parse(x.storage.getItem(Store.STORAGE_KEY)); }
  function check(id, run) {
    try { run(); results.push({ id, pass: true }); }
    catch (error) { results.push({ id, pass: false, error: error.message }); }
  }
  const v4 = () => Schema.migrateV3ToV4ExactMoney(makeV3Budget());
  function resetContract(x) {
    assert.equal(x.store.getStatus().state, 'recovery-required');
    x.store.startFresh();
    assert.equal(persisted(x).schemaVersion, 3);
    assert.equal(x.store.getStatus().residentSchemaVersion, 3);
    assert.equal(x.store.getExactMoneyMigrationSummary().state, 'eligible');
    assert.equal(JSON.parse(x.store.exportData()).data.schemaVersion, 3);
    x.store.updateAllocation('2026-02', 'savings', 0.29);
    assert.equal(persisted(x).schemaVersion, 3);
    assert.equal(persisted(x).months['2026-02'].allocations.savings, 0.29);
  }
  for (const [label, mutate] of [
    ['negative-cents', f => { f.months['2026-01'].expenses[0].actualAmount = -1; }],
    ['fractional-cents', f => { f.months['2026-01'].expenses[0].actualAmount = 1.5; }],
    ['invalid-structure', f => { f.categories = null; }],
  ]) check(label, () => { const f = v4(); mutate(f); resetContract(setup(f)); });
  check('invalid-json-reset', () => resetContract(setup('{')));
  check('invalid-v3-reset', () => { const f = makeV3Budget(); f.categories = null; resetContract(setup(f)); });
  for (const version of [3, 4]) check(`ready-v${version}-reset`, () => {
    const x = setup(version === 4 ? v4() : makeV3Budget());
    x.store.startFresh();
    assert.equal(persisted(x).schemaVersion, version);
    assert.equal(x.store.getStatus().residentSchemaVersion, version);
    assert.equal(JSON.parse(x.store.exportData()).data.schemaVersion, version);
    x.store.updateAllocation('2026-02', 'savings', 0.29);
    assert.equal(persisted(x).months['2026-02'].allocations.savings, version === 4 ? 29 : 0.29);
  });
  check('failed-reset-preserves-state', () => {
    const f = v4(); f.categories = null; const x = setup(f);
    const before = x.storage.getItem(Store.STORAGE_KEY), status = x.store.getStatus(), evidence = x.store.getCorruptEvidence();
    x.storage.fail({ op: 'setItem', key: Store.STORAGE_KEY });
    assert.throws(() => x.store.startFresh(), error => error.code === 'PRIMARY_WRITE_FAILED');
    assert.equal(x.storage.getItem(Store.STORAGE_KEY), before);
    assert.deepEqual(x.store.getStatus(), status);
    assert.equal(x.store.getCorruptEvidence(), evidence);
  });
  check('explicit-migration-and-missing-values', () => {
    const f = makeV3Budget(); f.months['2026-01'].paychecks[0].actualAmount = null;
    f.months['2026-01'].expenses[0].actualAmount = 0; f.months['2026-01'].allocations.savings = 0.29;
    const x = setup(f), before = x.store.getData(); x.storage.operations.length = 0;
    const preview = x.store.previewExactMoneyMigration();
    assert.ok(!x.storage.operations.some(op => ['setItem', 'removeItem'].includes(op.op)));
    x.store.commitExactMoneyMigration(preview);
    assert.equal(persisted(x).schemaVersion, 4); assert.deepEqual(x.store.getData(), before);
    const exported = JSON.parse(x.store.exportData()); assert.equal(exported.formatVersion, 1);
    assert.equal(exported.data.months['2026-01'].paychecks[0].actualAmount, null);
    assert.equal(exported.data.months['2026-01'].expenses[0].actualAmount, 0);
    assert.equal(exported.data.months['2026-01'].allocations.savings, 29);
  });
  check('subcent-rejection-no-write', () => {
    const f = makeV3Budget(); f.months['2026-01'].allocations.savings = 1.005;
    const x = setup(f), before = x.storage.getItem(Store.STORAGE_KEY); x.storage.operations.length = 0;
    assert.throws(() => x.store.previewExactMoneyMigration(), error => error.code === 'EXACT_MONEY_MIGRATION_BLOCKED');
    assert.equal(x.storage.getItem(Store.STORAGE_KEY), before);
    assert.ok(!x.storage.operations.some(op => ['setItem', 'removeItem'].includes(op.op)));
  });
  return { pass: results.every(check => check.pass), checks: results };
}
if (require.main === module) {
  try { const result = evaluate(process.argv[2]); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.pass ? 0 : 1; }
  catch (error) { console.error(error.message); process.exitCode = 2; }
}
module.exports = { evaluate };
