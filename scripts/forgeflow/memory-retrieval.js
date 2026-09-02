#!/usr/bin/env node
// Deterministic, advisory-only selection for the local memory index.

function keywordList(value) {
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values.flatMap((item) => String(item || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length >= 4)))];
}

function sourceClass(source = '') {
  const name = String(source).replace(/\\/g, '/').split('/').pop() || '';
  if (/^current-(discussion|research|plan|brief)\.md$/u.test(name)) return 'current';
  if (name === 'project-learnings.md' || name === 'learnings.jsonl') return 'project-learning';
  if (name === 'implementation-notes.md') return 'implementation';
  if (name === 'review-history.md') return 'history';
  return 'other';
}

function classRank(value) {
  return {
    current: 4,
    'project-learning': 3,
    implementation: 2,
    history: 1,
    other: 0,
  }[value] || 0;
}

function normalizedText(record) {
  return String(record.text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function inactive(record) {
  const lifecycle = String(record.lifecycle || '').toLowerCase();
  return record.kind === 'jsonl-invalid'
    || lifecycle === 'stale'
    || lifecycle === 'superseded'
    || lifecycle === 'invalid';
}

function recordLabel(record) {
  const lifecycle = String(record.lifecycle || '').toLowerCase();
  if (lifecycle === 'current' || record.source_class === 'current') return 'current';
  if (lifecycle === 'active') return 'active';
  return 'verify';
}

function matches(record, keys) {
  const haystack = `${record.text || ''} ${(record.keywords || []).join(' ')}`.toLowerCase();
  return keys.filter((key) => haystack.includes(key));
}

function selectMemoryRecords(records, query, options = {}) {
  const keys = keywordList(query);
  const maxHits = Number.isFinite(options.maxHits) ? Math.max(0, options.maxHits) : 48;
  const perSource = Number.isFinite(options.perSource) ? Math.max(1, options.perSource) : 10;
  const diagnostics = {
    eligible: 0,
    excluded_inactive: 0,
    query_matches: 0,
    selected_count: 0,
  };
  const candidates = [];

  for (const value of Array.isArray(records) ? records : []) {
    if (!value || typeof value !== 'object') continue;
    if (inactive(value)) {
      diagnostics.excluded_inactive += 1;
      continue;
    }
    diagnostics.eligible += 1;
    const queryMatches = matches(value, keys);
    if (queryMatches.length === 0) continue;
    diagnostics.query_matches += 1;
    const source = String(value.source || '(unknown)');
    const candidate = {
      ...value,
      source,
      source_class: value.source_class || sourceClass(source),
      source_mtime_ms: Number(value.source_mtime_ms || 0),
      line: Number(value.line || 0),
      query_matches: queryMatches,
      normalized_text: normalizedText(value),
    };
    candidate.label = recordLabel(candidate);
    candidates.push(candidate);
  }

  const seenText = new Set();
  const sourceCounts = new Map();
  const selected = candidates
    .sort((a, b) => classRank(b.source_class) - classRank(a.source_class)
      || b.query_matches.length - a.query_matches.length
      || b.source_mtime_ms - a.source_mtime_ms
      || a.source.localeCompare(b.source)
      || a.line - b.line
      || String(a.id || '').localeCompare(String(b.id || '')))
    .filter((record) => {
      if (!record.normalized_text || seenText.has(record.normalized_text)) return false;
      const count = sourceCounts.get(record.source) || 0;
      if (count >= perSource) return false;
      seenText.add(record.normalized_text);
      sourceCounts.set(record.source, count + 1);
      return true;
    })
    .slice(0, maxHits);
  diagnostics.selected_count = selected.length;
  return { selected, diagnostics, keywords: keys };
}

function renderMemorySelection(selection, options = {}) {
  const title = options.title || '# Memory Hits';
  const lines = [title, ''];
  if (options.indexLabel) lines.push(`Index: ${options.indexLabel}`);
  const keys = selection && Array.isArray(selection.keywords) ? selection.keywords : [];
  lines.push(`Keywords: ${keys.join(', ') || '(none)'}`, '');
  const selected = selection && Array.isArray(selection.selected) ? selection.selected : [];
  for (const record of selected) {
    lines.push(`- ${record.source}:${record.line || 1} [${record.label || 'verify'}] [${record.kind || 'memory'}] ${record.text || ''}`);
  }
  if (selected.length === 0) lines.push('(no strong local memory hits)');
  return lines.join('\n');
}

module.exports = {
  classRank,
  keywordList,
  recordLabel,
  renderMemorySelection,
  selectMemoryRecords,
  sourceClass,
};
