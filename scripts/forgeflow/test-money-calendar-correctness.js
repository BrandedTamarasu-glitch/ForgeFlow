#!/usr/bin/env node
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const m = require('../../fixtures/money-calendar-correctness/model');
const cases = require('../../fixtures/money-calendar-correctness/cases.json');

for (const [text, digits, policy, expected] of cases.rounding) assert.equal(m.parseAmount(text, digits, policy), expected, JSON.stringify([text, digits, policy]));
for (const amount of [-m.MAX_MINOR, m.MAX_MINOR]) {
  for (let digits = 0; digits <= 3; digits++) assert.equal(m.parseAmount(m.canonical(amount, digits), digits, 'half-away'), amount);
}
for (const [anchor, offset, policy, expected] of cases.dates) assert.equal(m.occurrence(anchor, offset, policy), expected, JSON.stringify([anchor, offset, policy]));
for (const value of ['', ' ', '1,23', '1e2', 'NaN', 'Infinity', '.5', '1.', '+1', 12, {}, '1'.repeat(65), '10000000.005', '-10000000.005']) {
  assert.throws(() => m.parseAmount(value, 2, 'half-away'));
}
assert.throws(() => m.parseAmount('1', 2, 'implicit'));
assert.throws(() => m.parseAmount(null, 4, 'half-even'));
assert.throws(() => m.canonical(Infinity, 2));
for (const value of ['1900-02-29', '2100-02-29', '2024-04-31', '2024-00-01', '2024-13-01', '2024-01-00', '1899-12-31', '2101-01-01', '2024-2-1', '2024-01-01T00:00:00Z', null, []]) assert.throws(() => m.civil(value));
for (const offset of [-1, 0.5, 2412, Infinity]) assert.throws(() => m.occurrence('2024-01-01', offset, 'clamp'));
assert.throws(() => m.occurrence('2100-12-31', 1, 'clamp'));
assert.throws(() => m.occurrence('2024-01-31', 1, 'implicit'));

assert.deepEqual(m.allocate(100, 3), [34, 33, 33]);
assert.deepEqual(m.allocate(-100, 3), [-34, -33, -33]);
assert.deepEqual(m.totals([0, null, 125, -25]), { known: 100, missing: 1, total: null });
assert.deepEqual(m.totals([0, 0]), { known: 0, missing: 0, total: 0 });
assert.deepEqual(m.totals([]), { known: 0, missing: 0, total: 0 });
assert.throws(() => m.totals([undefined]));
assert.throws(() => m.totals([m.MAX_MINOR, 1]));
const account = value => ({ unit: 'synthetic-credit', scale: 2, minor: value });
const left = account(1000), right = account(-100);
assert.deepEqual(m.transfer(left, right, 50), [account(950), account(-50)]);
assert.equal(left.minor, 1000, 'transfer preparation is pure');
assert.throws(() => m.transfer(left, { ...right, scale: 3 }, 1));
assert.throws(() => m.transfer(left, { ...right, unit: 'other-unit' }, 1));
assert.throws(() => m.transfer(left, account(m.MAX_MINOR), 1));
assert.throws(() => m.transfer(left, right, -1));
for (const count of [0, 101, 1.5]) assert.throws(() => m.allocate(100, count));

// Fixed seed: bounded metamorphic checks, independent of the decimal parser.
let seed = cases.seed;
const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
const sample = bound => Math.floor(next() / 0x100000000 * bound);
const coveredScales = new Set();
for (let index = 0; index < 256; index++) {
  const amount = sample(2000001) - 1000000, digits = sample(4), count = sample(100) + 1;
  coveredScales.add(digits);
  const shares = m.allocate(amount, count);
  assert.equal(shares.reduce((sum, value) => sum + value, 0), amount);
  assert.ok(shares.every(Number.isSafeInteger));
  assert.ok(Math.max(...shares) - Math.min(...shares) <= 1);
  assert.equal(m.parseAmount(m.canonical(amount, digits), digits, 'half-even'), amount);
  const balances = m.transfer(account(amount), account(-amount), sample(100001));
  assert.equal(balances[0].minor + balances[1].minor, 0);
}
assert.deepEqual([...coveredScales].sort(), [0, 1, 2, 3], 'generated cases cover every declared scale');
// Independent UTC date oracle for every target month in the declared year range.
let months = 0;
for (let year = 1900; year <= 2100; year++) {
  for (let month = 1; month <= 12; month++) {
    const expected = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    assert.equal(m.occurrence('1900-01-31', (year - 1900) * 12 + month - 1, 'clamp'), expected);
    months++;
  }
}

function storeWith(overrides = {}) {
  let bytes = JSON.stringify({ version: 1, anchor: '2024-01-31', amountMinor: null, scale: 2, ...overrides });
  const events = [];
  return { read: () => bytes, write: value => { events.push('write'); bytes = value; }, events };
}
const store = storeWith(), before = store.read();
const preview = m.preview(store, 3, 1, 'clamp');
assert.deepEqual(preview, [{ date: '2024-01-31', amountMinor: null }, { date: '2024-02-29', amountMinor: null }, { date: '2024-03-31', amountMinor: null }]);
assert.deepEqual(m.preview(store, 3, 1, 'clamp'), preview);
preview[0].amountMinor = 999;
assert.equal(store.read(), before);
assert.deepEqual(store.events, []);
const yearly = storeWith({ anchor: '2024-02-29', amountMinor: 0 });
assert.deepEqual(m.preview(yearly, 5, 12, 'clamp').map(row => row.date), ['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
assert.deepEqual(yearly.events, []);
for (const invalid of ['1,23', '10000000.005', undefined]) {
  assert.throws(() => m.saveAmount(store, invalid, 'half-away'));
  assert.equal(store.read(), before);
  assert.deepEqual(store.events, []);
}
for (const overrides of [{ version: 2 }, { anchor: '2100-12-31' }, { amountMinor: undefined }, { amountMinor: 1.5 }, { scale: 4 }]) {
  const invalid = storeWith(overrides), bytes = invalid.read();
  assert.throws(() => m.preview(invalid, 3, 1, 'clamp'));
  assert.equal(invalid.read(), bytes);
  assert.deepEqual(invalid.events, []);
}
for (const overrides of [{ version: 2 }, { anchor: '1900-02-29' }, { scale: 4 }]) {
  const invalid = storeWith(overrides), bytes = invalid.read();
  assert.throws(() => m.saveAmount(invalid, '0', 'half-even'));
  assert.equal(invalid.read(), bytes);
  assert.deepEqual(invalid.events, []);
}
for (const [count, interval] of [[0, 1], [25, 1], [1, 0], [1, 13]]) assert.throws(() => m.preview(store, count, interval, 'clamp'));
m.saveAmount(store, '0', 'half-even');
assert.equal(JSON.parse(store.read()).amountMinor, 0);
assert.deepEqual(store.events, ['write']);
assert.equal(m.preview(store, 1, 1, 'clamp')[0].amountMinor, 0);
assert.deepEqual(store.events, ['write']);

assert.equal(m.present(123456, 2, 'en-US'), '1,234.56');
assert.equal(m.present(123456, 2, 'de-DE'), '1.234,56');
assert.equal(m.present(123456, 0, 'ja-JP'), '123,456');
assert.equal(m.present(-1234, 3, 'en-US'), '-1.234');
assert.equal(m.present(0, 2, 'de-DE'), '0,00');
assert.equal(m.present(null, 2, 'en-US'), 'Not entered');
assert.throws(() => m.parseAmount(m.present(123456, 2, 'de-DE'), 2, 'half-even'));
const probe = `const m=require(${JSON.stringify(require.resolve('../../fixtures/money-calendar-correctness/model'))}); console.log(JSON.stringify(['2024-03-10','2024-11-03','2024-12-31'].map(d=>m.occurrence(d,1,'clamp'))));`;
for (const zone of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
  const result = spawnSync(process.execPath, ['-e', probe], { env: { ...process.env, TZ: zone }, encoding: 'utf8', timeout: 5000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), ['2024-04-10', '2024-12-03', '2025-01-31']);
}

// Deliberately bad implementations: prove the acceptance assertions reject them.
const rejects = check => assert.throws(check, assert.AssertionError);
rejects(() => assert.equal(Number('12.34'), 1234)); // Major units stored as minor units.
rejects(() => assert.equal(Math.round(Number('1.005') * 100), 101));
rejects(() => assert.equal(Math.round(-100.5), -101)); // Wrong signed tie rule.
rejects(() => assert.equal(Array.from({ length: 3 }, () => Math.trunc(100 / 3)).reduce((a, b) => a + b), 100));
rejects(() => assert.equal(m.occurrence(m.occurrence('2023-01-31', 1, 'clamp'), 1, 'clamp'), '2023-03-31'));
rejects(() => assert.equal(1900 % 4 === 0, false));
rejects(() => assert.equal(new Date(Date.UTC(2023, 1, 31)).toISOString().slice(0, 10), '2023-02-28'));
rejects(() => assert.equal([null, 0].reduce((sum, value) => sum + (value || 0), 0), null));
rejects(() => { const bad = storeWith(); bad.write(JSON.stringify({ ...JSON.parse(bad.read()), amountMinor: 0 })); m.preview(bad, 1, 1, 'clamp'); assert.deepEqual(bad.events, []); });
console.log(`money/calendar: ${cases.rounding.length} amount cases, ${cases.dates.length} recurrence cases, 256 seeded properties, ${months} target months, 9 seeded defects, locale/timezone and no-write checks passed (synthetic only)`);
