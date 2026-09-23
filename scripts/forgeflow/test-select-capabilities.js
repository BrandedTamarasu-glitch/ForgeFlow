#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { CAPABILITIES } = require('./capability-catalog');
const { selectCapabilities: select, renderSelection, LIMITS } = require('./select-capabilities');

const selected = input => select(input).selected;
assert.equal(CAPABILITIES.length, 9);
assert.equal(new Set(CAPABILITIES.map(item => item.id)).size, 9);
const readFile = fs.readFileSync;
try {
  fs.readFileSync = () => { throw new Error('Selector must not eagerly read procedure bodies'); };
  assert.deepEqual(selected({ task: 'Update the logo' }), ['change-propagation', 'visual-acceptance']);
} finally {
  fs.readFileSync = readFile;
}
for (const capability of CAPABILITIES) {
  for (const key of ['id', 'version', 'summary', 'owner', 'handoffs', 'phases', 'triggers', 'exclusions', 'inputs', 'requires', 'procedure', 'prerequisites', 'cost', 'availability']) assert.ok(capability[key], `${capability.id} missing ${key}`);
  assert.deepEqual(capability.requires, []);
  assert.equal(capability.availability, ['change-propagation', 'visual-acceptance', 'persistence-recovery', 'review-calibration', 'provider-compatibility', 'release-qualification'].includes(capability.id) ? 'evaluation' : 'planned');
}
assert.deepEqual(selected({ task: 'Update the logo and palette' }), ['change-propagation', 'visual-acceptance']);
assert.deepEqual(selected({ task: 'Fix recurring budget calculations', phase: 'plan' }), ['money-calendar-correctness']);
assert.deepEqual(selected({ task: 'Design a controller cradle with physical retention', phase: 'plan' }), ['cad-fabrication-acceptance']);
assert.deepEqual(selected({ task: 'Fix a typo in the currency documentation', files: ['src/currency.js'] }), []);
assert.deepEqual(selected({ task: 'Correct README spelling', project: 'Budget calendar CAD', files: ['README.md'] }), []);
assert.deepEqual(selected({ task: 'Update the anvil logo illustration' }), ['change-propagation', 'visual-acceptance']);
assert.deepEqual(selected({ task: 'Verify the deployed artifact' }), ['release-qualification']);
assert.deepEqual(selected({ task: 'Measure accelerator throughput' }), ['benchmark-verification']);
assert.deepEqual(selected({ task: 'Evaluate reviewer quality and false findings' }), ['review-calibration']);
assert.deepEqual(selected({ task: 'Fix external API response parsing' }), ['provider-compatibility']);
assert.deepEqual(selected({ task: 'Fix the journal cleanup', criteria: ['Prevent data loss after interrupted saves'] }), ['persistence-recovery']);
assert.deepEqual(selected({ task: 'Migrate currency schema and verify storage recovery' }), ['change-propagation', 'persistence-recovery', 'money-calendar-correctness']);
assert.deepEqual(selected({ task: 'Fix recurrence', phase: 'ship' }), []);
assert.deepEqual(selected({ task: 'Fix recurrence', phase: 'consult' }), ['money-calendar-correctness']);

const ambiguous = select({ files: ['src/providers/client.js'], task: 'Inspect this change' });
assert.deepEqual(ambiguous.selected, []);
assert.deepEqual(ambiguous.inspection_requests.map(item => item.id), ['provider-compatibility']);
const clarified = select({ files: ['src/providers/client.js'], task: 'Inspect this change', assessments: [{ id: 'provider-compatibility', relevance: 'relevant', reason: 'The changed normalizer handles partial external responses.', evidence: 'src/providers/client.js:12' }], previous: ambiguous });
assert.deepEqual(clarified.selected, ['provider-compatibility']);
assert.equal(clarified.reassessment_count, 1);
assert.equal(select({ task: 'provider' }).selected.length, 0, 'domain keyword alone cannot activate');
assert.equal(select({ task: 'Do not change the currency logic' }).selected.length, 0);
assert.equal(select({ task: 'Update the provider logo, not its protocol', assessments: [{ id: 'provider-compatibility', relevance: 'irrelevant', reason: 'Only artwork changes.', evidence: 'assets/logo.svg' }] }).selected.includes('provider-compatibility'), false);

const overrides = { include: ['cad-fabrication-acceptance', 'cad-fabrication-acceptance'], exclude: ['visual-acceptance'] };
const forced = select({ task: 'Update logo', overrides });
assert.deepEqual(forced.selected, ['change-propagation', 'cad-fabrication-acceptance']);
assert.equal(forced.decisions.find(item => item.id === 'visual-acceptance').decision, 'excluded');
for (const item of forced.decisions) assert.equal(item.executable, false, 'selection must not claim unavailable procedures executed');
assert.match(renderSelection(forced), /Planned procedures are unavailable/);
assert.match(renderSelection(forced, 'designer'), /cad-fabrication-acceptance/);
assert.doesNotMatch(renderSelection(forced, 'guardian'), /cad-fabrication-acceptance/);

const many = select({ files: ['src/providers/storage/migration/review/perf/calendar/model.stl', 'page.css'] });
assert.equal(many.inspection_requests.length, LIMITS.inspections);
assert.ok(many.decisions.some(item => item.decision === 'deferred'));
let previous = select({ task: 'Fix currency rounding' });
assert.equal(select({ task: 'Fix currency rounding', previous }).reassessment_count, 0);
for (let index = 1; index <= LIMITS.reassessments; index++) {
  previous = select({ task: `Fix currency rounding case ${index}`, previous });
  assert.equal(previous.reassessment_count, index);
}
const capped = select({ task: 'Fix a new currency representation', previous });
assert.equal(capped.status, 'limited');
assert.deepEqual(capped.selected, []);
assert.equal(select({ task: 'Fix a new currency representation', previous: capped }).status, 'limited');
assert.equal(select({ task: 'Fix currency rounding case 3', previous: capped }).status, 'assessed');

for (const invalid of [
  { overrides: { include: ['unknown'] } },
  { overrides: { excludes: ['visual-acceptance'] } }, { overrides: [] }, { versions: [] },
  { versions: { 'visual-acceptance': 99 } },
  { overrides: { include: ['visual-acceptance'], exclude: ['visual-acceptance'] } },
  { files: ['../private.txt'] }, { files: ['/etc/passwd'] }, { files: ['a\nb.js'] },
  { files: Array(201).fill('file.js') }, { task: 'x'.repeat(12001) },
  { assessments: [{ id: 'visual-acceptance', relevance: 'relevant', reason: '', evidence: 'source' }] },
  { previous: { scope_key: 'bad', reassessment_count: -1 } }, { phase: 'publish' },
]) assert.throws(() => select(invalid));

const cli = spawnSync(process.execPath, [require.resolve('./select-capabilities'), '--task', 'Fix currency rounding'], { encoding: 'utf8' });
assert.equal(cli.status, 0, cli.stderr);
assert.deepEqual(JSON.parse(cli.stdout).selected, ['money-calendar-correctness']);
const badCli = spawnSync(process.execPath, [require.resolve('./select-capabilities'), '--input'], { encoding: 'utf8' });
assert.equal(badCli.status, 1);
assert.match(badCli.stderr, /Usage/);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-capabilities-'));
try {
  const inputPath = path.join(temporary, 'selection.json');
  fs.writeFileSync(inputPath, JSON.stringify({ task: 'Fix recurrence', phase: 'plan' }));
  const fromFile = spawnSync(process.execPath, [require.resolve('./select-capabilities'), '--input', inputPath], { encoding: 'utf8' });
  assert.equal(fromFile.status, 0, fromFile.stderr);
  assert.deepEqual(JSON.parse(fromFile.stdout).selected, ['money-calendar-correctness']);
  fs.writeFileSync(inputPath, '{');
  const malformed = spawnSync(process.execPath, [require.resolve('./select-capabilities'), '--input', inputPath], { encoding: 'utf8' });
  assert.equal(malformed.status, 1);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
console.log('capability selection: ok');
