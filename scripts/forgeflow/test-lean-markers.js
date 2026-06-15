#!/usr/bin/env node
const {
  MARKER_KINDS,
  parseLeanMarkersFromLines,
  summarizeLeanMarkers,
} = require('./lean-markers');

const markers = parseLeanMarkersFromLines([
  { line: 3, text: '// forgeflow: lean: keep direct until a second caller appears' },
  { line: 4, text: '# forgeflow: upgrade when: more than one package needs this' },
  { line: 5, text: '// forgeflow: no-new-deps' },
  { line: 6, text: '// forgeflow: stdlib-first: Array.sort covers this' },
  { line: 7, text: '// forgeflow: native-first' },
], 'src/demo.js');
const summary = summarizeLeanMarkers(markers);

const checks = [
  ['marker kinds stable', MARKER_KINDS.includes('upgrade when') && MARKER_KINDS.includes('no-new-deps')],
  ['parses supported markers', markers.length === 5],
  ['captures source and line', markers[0].source === 'src/demo.js' && markers[0].line === 3],
  ['no-new-deps can omit detail', markers.find((marker) => marker.kind === 'no-new-deps').valid],
  ['missing detail is invalid for other markers', !markers.find((marker) => marker.kind === 'native-first').valid],
  ['summary counts invalid markers', summary.count === 5 && summary.valid_count === 4 && summary.invalid_count === 1 && summary.by_kind.lean === 1],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error(`FAIL: ${name}`);
  process.exit(1);
}

console.log('lean markers: ok');
