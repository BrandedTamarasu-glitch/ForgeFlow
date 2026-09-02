#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  renderMemorySelection,
  selectMemoryRecords,
} = require('./memory-retrieval');

const repoRoot = path.resolve(__dirname, '..', '..');
const fixtureDir = path.join(repoRoot, 'fixtures', 'memory-retrieval');
const records = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'records.json'), 'utf8'));
const expected = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'expected.json'), 'utf8'));

function ids(selection) {
  return selection.selected.map((record) => record.id);
}

function metricReport(selection, rendered) {
  const selected = selection.selected;
  const normalized = selected.map((record) => record.normalized_text);
  const confidenceCoverage = selected.length === 0
    ? 1
    : selected.filter((record) => ['low', 'medium', 'high'].includes(record.confidence)).length / selected.length;
  return {
    precision_at_4: selected.length === 0 ? 1 : selected.filter((record) => expected.selected_ids.includes(record.id)).length / selected.length,
    stale_leakage: selected.filter((record) => expected.inactive_ids.includes(record.id)).length,
    duplicate_count: normalized.length - new Set(normalized).size,
    source_diversity: new Set(selected.map((record) => record.source)).size,
    confidence_coverage: confidenceCoverage,
    compact_tokens: Math.ceil(rendered.length / 4),
  };
}

const selection = selectMemoryRecords(records, expected.query, { maxHits: 8, perSource: 4 });
const rendered = renderMemorySelection(selection, { title: '# Fixture Memory Hits', indexLabel: 'fixtures/memory-retrieval' });
const reversed = selectMemoryRecords([...records].reverse(), expected.query, { maxHits: 8, perSource: 4 });
const noMatch = selectMemoryRecords(records, expected.no_match_query, { maxHits: 8, perSource: 4 });
const metrics = metricReport(selection, rendered);

assert.deepStrictEqual(ids(selection), expected.selected_ids, 'active relevant records should use the deterministic source-priority order');
assert.deepStrictEqual(ids(reversed), expected.selected_ids, 'selection ordering should remain stable when input order changes');
assert.strictEqual(selection.diagnostics.eligible, 6, 'only non-inactive records should be eligible');
assert.strictEqual(selection.diagnostics.excluded_inactive, 3, 'stale, superseded, and invalid structured records should be excluded');
assert.strictEqual(selection.diagnostics.query_matches, 5, 'only positive keyword matches should qualify before deduplication');
assert.strictEqual(selection.diagnostics.selected_count, 4, 'duplicate matching content should collapse before selection');
assert.ok(expected.inactive_ids.every((id) => !ids(selection).includes(id)), 'inactive records must never leak into selected memory');
assert.ok(!ids(selection).includes(expected.unrelated_id), 'unrelated headings must not qualify without a keyword match');
assert.ok(!ids(selection).includes(expected.duplicate_id), 'duplicate material must collapse to one selected record');
assert.deepStrictEqual(selection.selected.map((record) => record.label), ['current', 'active', 'active', 'verify'], 'render labels should communicate current, active, and verify states');
assert.ok(rendered.includes('[current]') && rendered.includes('[active]') && rendered.includes('[verify]'), 'rendered memory should expose trust labels');
assert.strictEqual(noMatch.selected.length, 0, 'a focused no-match query should select nothing');
assert.ok(renderMemorySelection(noMatch).includes('(no strong local memory hits)'), 'a focused no-match query should explain the absence of advice');
assert.strictEqual(metrics.precision_at_4, 1, 'benchmark precision should be exact for the deterministic fixture');
assert.strictEqual(metrics.stale_leakage, 0, 'benchmark must have no stale leakage');
assert.strictEqual(metrics.duplicate_count, 0, 'benchmark must not emit duplicate content');
assert.strictEqual(metrics.source_diversity, 4, 'benchmark should retain evidence from each ranked source class');
assert.strictEqual(metrics.confidence_coverage, 1, 'selected fixture records should all state confidence');
assert.ok(metrics.compact_tokens > 0 && metrics.compact_tokens < 400, 'rendered fixture output should remain compact');

console.log(`memory retrieval: ok ${JSON.stringify(metrics)}`);
