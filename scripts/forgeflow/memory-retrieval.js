#!/usr/bin/env node
// Deterministic, advisory-only selection for the local memory index.

const MEMORY_RANKING_POLICY = Object.freeze({
  source_class_priority: Object.freeze([
    'current',
    'project-learning',
    'implementation',
    'history',
    'other',
  ]),
  tie_breakers: Object.freeze([
    'keyword-match-count',
    'source-modified-time',
    'source-path',
    'line',
    'record-id',
  ]),
  boundary: 'Ranks matching unconflicted active records only; explicit conflict controls, lifecycle, duplicate, source-cap, and result-cap suppression happen after ranking.',
});

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
  if (name === 'project-learnings.md' || name === 'learnings.jsonl' || name === 'project-learning-candidates.jsonl') return 'project-learning';
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

// Conflict withholding is intentionally driven only by an upstream structured
// control record. Retrieval never tries to infer disagreement from prose.
function conflicted(record) {
  return record.conflict_withheld === true;
}

function incorrectOutcome(record) {
  return record.outcome_withheld === true;
}

function invalid(record) {
  return record.kind === 'jsonl-invalid'
    || String(record.lifecycle || '').toLowerCase() === 'invalid';
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

function selectionReason(record) {
  const count = Array.isArray(record.query_matches) ? record.query_matches.length : 0;
  const matchLabel = count === 1 ? 'keyword match' : 'keyword matches';
  return `source priority: ${record.source_class}; ${count} ${matchLabel}`;
}

function selectMemoryRecords(records, query, options = {}) {
  const keys = keywordList(query);
  const maxHits = Number.isFinite(options.maxHits) ? Math.max(0, options.maxHits) : 48;
  const perSource = Number.isFinite(options.perSource) ? Math.max(1, options.perSource) : 10;
  const diagnostics = {
    eligible: 0,
    excluded_inactive: 0,
    excluded_invalid: 0,
    excluded_conflicted: 0,
    excluded_outcome_incorrect: 0,
    excluded_no_match: 0,
    query_matches: 0,
    suppressed_duplicate: 0,
    suppressed_source_cap: 0,
    suppressed_max_hits: 0,
    selected_count: 0,
    ranking_policy: MEMORY_RANKING_POLICY,
  };
  const candidates = [];

  for (const value of Array.isArray(records) ? records : []) {
    if (!value || typeof value !== 'object') continue;
    if (conflicted(value)) {
      diagnostics.excluded_conflicted += 1;
      continue;
    }
    if (incorrectOutcome(value)) {
      diagnostics.excluded_outcome_incorrect += 1;
      continue;
    }
    if (inactive(value)) {
      diagnostics.excluded_inactive += 1;
      if (invalid(value)) diagnostics.excluded_invalid += 1;
      continue;
    }
    diagnostics.eligible += 1;
    const queryMatches = matches(value, keys);
    if (queryMatches.length === 0) {
      diagnostics.excluded_no_match += 1;
      continue;
    }
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
    candidate.selection_reason = selectionReason(candidate);
    candidates.push(candidate);
  }

  const seenText = new Set();
  const sourceCounts = new Map();
  const retained = candidates
    .sort((a, b) => classRank(b.source_class) - classRank(a.source_class)
      || b.query_matches.length - a.query_matches.length
      || b.source_mtime_ms - a.source_mtime_ms
      || a.source.localeCompare(b.source)
      || a.line - b.line
      || String(a.id || '').localeCompare(String(b.id || '')))
    .filter((record) => {
      if (!record.normalized_text || seenText.has(record.normalized_text)) {
        diagnostics.suppressed_duplicate += 1;
        return false;
      }
      const count = sourceCounts.get(record.source) || 0;
      if (count >= perSource) {
        diagnostics.suppressed_source_cap += 1;
        return false;
      }
      seenText.add(record.normalized_text);
      sourceCounts.set(record.source, count + 1);
      return true;
    });
  const selected = retained.slice(0, maxHits);
  diagnostics.suppressed_max_hits = retained.length - selected.length;
  diagnostics.selected_count = selected.length;
  return { selected, diagnostics, keywords: keys, ranking_policy: MEMORY_RANKING_POLICY };
}

function renderMemorySelection(selection, options = {}) {
  const title = options.title || '# Memory Hits';
  const lines = [title, ''];
  if (options.indexLabel) lines.push(`Index: ${options.indexLabel}`);
  const keys = selection && Array.isArray(selection.keywords) ? selection.keywords : [];
  lines.push(`Keywords: ${keys.join(', ') || '(none)'}`, '');
  const selected = selection && Array.isArray(selection.selected) ? selection.selected : [];
  for (const record of selected) {
    lines.push(`- ${record.source}:${record.line || 1} [${record.label || 'verify'}] [${record.kind || 'memory'}] [selected: ${record.selection_reason || 'ranked match'}] ${record.text || ''}`);
  }
  if (selected.length === 0) {
    const diagnostics = selection && selection.diagnostics ? selection.diagnostics : {};
    const excluded = Number(diagnostics.excluded_no_match || 0);
    lines.push('(no strong local memory hits)');
    if (excluded > 0) {
      lines.push(`${excluded} active record${excluded === 1 ? '' : 's'} did not match.`);
    }
  }
  const conflicted = Number(selection && selection.diagnostics && selection.diagnostics.excluded_conflicted || 0);
  if (conflicted > 0) {
    lines.push(`${conflicted} conflicting active record${conflicted === 1 ? ' was' : 's were'} withheld pending correction or clarification.`);
  }
  const incorrect = Number(selection && selection.diagnostics && selection.diagnostics.excluded_outcome_incorrect || 0);
  if (incorrect > 0) {
    lines.push(`${incorrect} command-interface learning record${incorrect === 1 ? ' was' : 's were'} withheld after explicit incorrect-outcome feedback. Correct the exact learning with /forgeflow-memory-correct before relying on replacement guidance.`);
  }
  return lines.join('\n');
}

module.exports = {
  classRank,
  conflicted,
  incorrectOutcome,
  keywordList,
  MEMORY_RANKING_POLICY,
  recordLabel,
  renderMemorySelection,
  selectionReason,
  selectMemoryRecords,
  sourceClass,
};
