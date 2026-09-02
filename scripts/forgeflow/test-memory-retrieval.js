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
const sourceCapped = selectMemoryRecords([
  ...records,
  {
    id: 'current-brief:8',
    source: '.forgeflow/Demo/current-brief.md',
    source_class: 'current',
    source_mtime_ms: 1767225600000,
    line: 8,
    kind: 'bullet',
    text: 'Session cache release checks must include the guard checklist.',
    keywords: ['session', 'cache', 'release', 'guard'],
    lifecycle: 'active',
  },
], expected.query, { maxHits: 8, perSource: 1 });
const maxCapped = selectMemoryRecords(records, expected.query, { maxHits: 2, perSource: 4 });
const privateInactiveMarker = 'PRIVATE_INACTIVE_MEMORY_MARKER';
const privateInactive = selectMemoryRecords([
  ...records,
  {
    id: 'project-learnings:private',
    source: '.forgeflow/Demo/project-learnings.md',
    kind: 'jsonl',
    text: `${privateInactiveMarker} cache invalidation guard`,
    keywords: ['cache', 'invalidation', 'guard'],
    lifecycle: 'superseded',
  },
], expected.query, { maxHits: 8, perSource: 4 });
const metrics = metricReport(selection, rendered);

assert.deepStrictEqual(ids(selection), expected.selected_ids, 'active relevant records should use the deterministic source-priority order');
assert.deepStrictEqual(ids(reversed), expected.selected_ids, 'selection ordering should remain stable when input order changes');
assert.strictEqual(selection.diagnostics.eligible, 6, 'only non-inactive records should be eligible');
assert.strictEqual(selection.diagnostics.excluded_inactive, 3, 'stale, superseded, and invalid structured records should be excluded');
assert.strictEqual(selection.diagnostics.query_matches, 5, 'only positive keyword matches should qualify before deduplication');
assert.strictEqual(selection.diagnostics.selected_count, 4, 'duplicate matching content should collapse before selection');
assert.strictEqual(selection.diagnostics.excluded_invalid, 1, 'invalid structured records should be counted only as an aggregate exclusion');
assert.strictEqual(selection.diagnostics.excluded_no_match, 1, 'active irrelevant records should be counted only as an aggregate exclusion');
assert.strictEqual(selection.diagnostics.suppressed_duplicate, 1, 'duplicate matching records should be counted after ranking');
assert.strictEqual(selection.diagnostics.suppressed_source_cap, 0, 'the default source cap should not suppress the fixture');
assert.strictEqual(selection.diagnostics.suppressed_max_hits, 0, 'the generous result cap should not suppress the fixture');
assert.deepStrictEqual(selection.ranking_policy.source_class_priority, ['current', 'project-learning', 'implementation', 'history', 'other'], 'selection should disclose its stable source-priority policy');
assert.ok(selection.ranking_policy.tie_breakers.includes('keyword-match-count'), 'selection should disclose its deterministic tie breaker');
assert.ok(selection.ranking_policy.boundary.includes('active records'), 'selection should disclose the ranking boundary without exposing records');
assert.ok(selection.selected.every((record) => /^source priority: [a-z-]+; \d+ keyword match(?:es)?$/u.test(record.selection_reason)), 'each selected record should have a concise non-content selection reason');
assert.ok(rendered.includes('[selected: source priority: current; 4 keyword matches]'), 'rendered output should explain why the highest-priority record was selected');
assert.strictEqual(sourceCapped.diagnostics.suppressed_source_cap, 1, 'the per-source cap should be reflected in aggregate diagnostics');
assert.ok(sourceCapped.selected.length <= 4, 'the per-source cap should constrain selected records');
assert.strictEqual(maxCapped.selected.length, 2, 'the result cap should constrain selected records');
assert.strictEqual(maxCapped.diagnostics.suppressed_max_hits, 2, 'the result cap should report the number omitted after filtering');
assert.ok(!JSON.stringify(privateInactive.diagnostics).includes(privateInactiveMarker), 'aggregate diagnostics must not expose suppressed memory content');
assert.ok(!renderMemorySelection(privateInactive).includes(privateInactiveMarker), 'suppressed memory content must not leak into rendered context');
assert.ok(expected.inactive_ids.every((id) => !ids(selection).includes(id)), 'inactive records must never leak into selected memory');
assert.ok(!ids(selection).includes(expected.unrelated_id), 'unrelated headings must not qualify without a keyword match');
assert.ok(!ids(selection).includes(expected.duplicate_id), 'duplicate material must collapse to one selected record');
assert.deepStrictEqual(selection.selected.map((record) => record.label), ['current', 'active', 'active', 'verify'], 'render labels should communicate current, active, and verify states');
assert.ok(rendered.includes('[current]') && rendered.includes('[active]') && rendered.includes('[verify]'), 'rendered memory should expose trust labels');
assert.strictEqual(noMatch.selected.length, 0, 'a focused no-match query should select nothing');
assert.ok(renderMemorySelection(noMatch).includes('(no strong local memory hits)'), 'a focused no-match query should explain the absence of advice');
assert.ok(renderMemorySelection(noMatch).includes('6 active records did not match.'), 'a no-hit response should expose only the aggregate active non-match count');
assert.strictEqual(metrics.precision_at_4, 1, 'benchmark precision should be exact for the deterministic fixture');
assert.strictEqual(metrics.stale_leakage, 0, 'benchmark must have no stale leakage');
assert.strictEqual(metrics.duplicate_count, 0, 'benchmark must not emit duplicate content');
assert.strictEqual(metrics.source_diversity, 4, 'benchmark should retain evidence from each ranked source class');
assert.strictEqual(metrics.confidence_coverage, 1, 'selected fixture records should all state confidence');
assert.ok(metrics.compact_tokens > 0 && metrics.compact_tokens < 400, 'rendered fixture output should remain compact');

console.log(`memory retrieval: ok ${JSON.stringify(metrics)}`);
