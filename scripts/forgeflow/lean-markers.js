const MARKER_RE = /^\s*(?:(?:\/\/|#|\/\*|\*|<!--)\s*)?(?:-\s*)?forgeflow:\s*(lean|upgrade when|no-new-deps|stdlib-first|native-first|reuse-first)\b\s*:?\s*(.*)$/i;

const MARKER_KINDS = ['lean', 'upgrade when', 'no-new-deps', 'stdlib-first', 'native-first', 'reuse-first'];

function normalizeKind(kind) {
  return String(kind || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseLeanMarkersFromLines(lines = [], source = '') {
  const markers = [];
  for (const line of lines) {
    const text = typeof line === 'string' ? line : String(line.text || '');
    const match = text.match(MARKER_RE);
    if (!match) continue;
    const kind = normalizeKind(match[1]);
    const detail = String(match[2] || '').trim();
    markers.push({
      kind,
      detail,
      line: typeof line === 'object' && line.line ? line.line : 0,
      source,
      valid: Boolean(detail) || kind === 'no-new-deps',
      issue: detail || kind === 'no-new-deps' ? '' : 'marker-missing-detail',
    });
  }
  return markers;
}

function summarizeLeanMarkers(markers = []) {
  const valid = markers.filter((marker) => marker.valid);
  const invalid = markers.filter((marker) => !marker.valid);
  const byKind = {};
  for (const marker of markers) byKind[marker.kind] = (byKind[marker.kind] || 0) + 1;
  return {
    count: markers.length,
    valid_count: valid.length,
    invalid_count: invalid.length,
    by_kind: byKind,
    markers,
  };
}

module.exports = {
  MARKER_KINDS,
  parseLeanMarkersFromLines,
  summarizeLeanMarkers,
};
