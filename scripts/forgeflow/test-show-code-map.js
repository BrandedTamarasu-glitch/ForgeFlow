#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  compactCodeMapHistory,
  importGapSummary,
  importGapScope,
  livingProjectMapFromTrend,
  renderProjectCodeMap,
  showCodeMap,
} = require('./show-code-map');

const repoRoot = path.resolve(__dirname, '..', '..');
const fixtureRoot = path.join(repoRoot, 'fixtures/code-topology');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-code-map-'));
const out = path.join(tmp, 'project-code-map.md');
const projectDir = path.join(tmp, 'project');

const result = showCodeMap({
  root: fixtureRoot,
  projectDir,
  out,
  maxHotspots: 5,
});
const secondResult = showCodeMap({
  root: fixtureRoot,
  projectDir,
  out: path.join(tmp, 'project-code-map-second.md'),
  maxHotspots: 5,
});
const retainedProjectDir = path.join(tmp, 'retained-project');
for (let i = 0; i < 4; i += 1) {
  showCodeMap({
    root: fixtureRoot,
    projectDir: retainedProjectDir,
    out: path.join(tmp, `retained-code-map-${i}.md`),
    maxHotspots: 5,
    historyLimit: 2,
  });
}
const markdown = fs.readFileSync(out, 'utf8');
const graphPath = path.resolve(fixtureRoot, result.summary.artifacts.graph);
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
const historyPath = path.join(projectDir, 'context', 'code-map-history.jsonl');
const retainedHistoryPath = path.join(retainedProjectDir, 'context', 'code-map-history.jsonl');
const symlinkHistoryProjectDir = path.join(tmp, 'symlink-history-project');
const symlinkHistoryPath = path.join(symlinkHistoryProjectDir, 'context', 'code-map-history.jsonl');
const symlinkHistoryTarget = path.join(tmp, 'outside-code-map-history.jsonl');
fs.mkdirSync(path.dirname(symlinkHistoryPath), { recursive: true });
fs.writeFileSync(symlinkHistoryTarget, 'do not overwrite\n');
fs.symlinkSync(symlinkHistoryTarget, symlinkHistoryPath);
let symlinkHistoryWriteBlocked = false;
try {
  showCodeMap({
    root: fixtureRoot,
    projectDir: symlinkHistoryProjectDir,
    out: path.join(tmp, 'symlink-history-code-map.md'),
    maxHotspots: 5,
  });
} catch (err) {
  symlinkHistoryWriteBlocked = err.message.includes('symlinked file');
}
const symlinkOutProjectDir = path.join(tmp, 'symlink-out-project');
const symlinkOut = path.join(symlinkOutProjectDir, 'context', 'project-code-map.md');
const symlinkOutTarget = path.join(tmp, 'outside-project-code-map.md');
fs.mkdirSync(path.dirname(symlinkOut), { recursive: true });
fs.writeFileSync(symlinkOutTarget, 'do not overwrite\n');
fs.symlinkSync(symlinkOutTarget, symlinkOut);
let symlinkOutWriteBlocked = false;
try {
  showCodeMap({
    root: fixtureRoot,
    projectDir: symlinkOutProjectDir,
    out: symlinkOut,
    maxHotspots: 5,
  });
} catch (err) {
  symlinkOutWriteBlocked = err.message.includes('symlinked file');
}
const hardlinkOutProjectDir = path.join(tmp, 'hardlink-out-project');
const hardlinkOut = path.join(hardlinkOutProjectDir, 'context', 'project-code-map.md');
const hardlinkOutTarget = path.join(tmp, 'outside-hardlink-project-code-map.md');
fs.mkdirSync(path.dirname(hardlinkOut), { recursive: true });
fs.writeFileSync(hardlinkOutTarget, 'do not overwrite\n');
fs.linkSync(hardlinkOutTarget, hardlinkOut);
let hardlinkOutWriteBlocked = false;
try {
  showCodeMap({
    root: fixtureRoot,
    projectDir: hardlinkOutProjectDir,
    out: hardlinkOut,
    maxHotspots: 5,
  });
} catch (err) {
  hardlinkOutWriteBlocked = err.message.includes('hardlinked file');
}
const cliResult = showCodeMap({
  root: fixtureRoot,
  projectDir: path.join(tmp, 'cli-project'),
  out: path.join(tmp, 'cli-code-map.md'),
  maxHotspots: 1,
});
const cliJson = { out: cliResult.out, ...cliResult.summary };
const rendered = renderProjectCodeMap(result.summary);
const triagedGaps = importGapSummary({
  unresolved: [
    { source: 'src/app.ts', specifier: '../../favicon.ico', kind: 'import' },
    { source: 'src/types.ts', specifier: '../types/audit.types', kind: 'import' },
    { source: 'src/app.ts', specifier: './missing', kind: 'import' },
    { source: 'fixtures/demo/test-app.ts', specifier: './missing', kind: 'import' },
  ],
  skipped_dynamic: [
    { source: 'src/routes.ts', expression: "'@/routes/admin'" },
    { source: 'src/pdf.ts', expression: "'@react-pdf/renderer'" },
    { source: 'src/i18n.ts', expression: '`./langs/${lang}.json`' },
  ],
}, 10);
const triageCategories = Object.fromEntries(triagedGaps.triage.categories.map((item) => [item.category, item]));
const attentionMap = livingProjectMapFromTrend({
  status: 'compared',
  source_files_delta: 1,
  local_edges_delta: 2,
  unresolved_imports_delta: 1,
  skipped_dynamic_imports_delta: 0,
  sections_delta: 3,
  changed_sections_delta: 2,
  new_high_fan_in: ['src/core.ts'],
  new_high_fan_out: [],
  removed_high_fan_in: ['src/old.ts'],
  removed_high_fan_out: [],
});
const stableMap = livingProjectMapFromTrend({
  status: 'compared',
  source_files_delta: 0,
  local_edges_delta: 0,
  unresolved_imports_delta: 0,
  skipped_dynamic_imports_delta: 0,
  sections_delta: 0,
  changed_sections_delta: 0,
  new_high_fan_in: [],
  new_high_fan_out: [],
  removed_high_fan_in: [],
  removed_high_fan_out: [],
});
const mixedImportGapMap = livingProjectMapFromTrend({
  status: 'compared',
  source_files_delta: 0,
  local_edges_delta: 0,
  unresolved_imports_delta: 2,
  skipped_dynamic_imports_delta: -2,
  sections_delta: 0,
  changed_sections_delta: 0,
  new_high_fan_in: [],
  new_high_fan_out: [],
  removed_high_fan_in: [],
  removed_high_fan_out: [],
});

const checks = [
  ['writes markdown', fs.existsSync(out) && markdown.includes('# Forgeflow Project Code Map')],
  ['writes topology graph', fs.existsSync(graphPath)],
  ['writes code map history', fs.existsSync(historyPath) && fs.readFileSync(historyPath, 'utf8').trim().split(/\r?\n/).length === 2],
  ['retains bounded history', fs.existsSync(retainedHistoryPath) && fs.readFileSync(retainedHistoryPath, 'utf8').trim().split(/\r?\n/).length === 2],
  ['symlink history write blocked', symlinkHistoryWriteBlocked && fs.readFileSync(symlinkHistoryTarget, 'utf8') === 'do not overwrite\n'],
  ['symlink markdown write blocked', symlinkOutWriteBlocked && fs.readFileSync(symlinkOutTarget, 'utf8') === 'do not overwrite\n'],
  ['hardlink markdown write blocked', hardlinkOutWriteBlocked && fs.readFileSync(hardlinkOutTarget, 'utf8') === 'do not overwrite\n'],
  ['history compactor keeps latest records', compactCodeMapHistory([{ id: 1 }, { id: 2 }, { id: 3 }], 2).map((item) => item.id).join(',') === '2,3'],
  ['writes compact topology graph', graph.scope === 'changed-neighborhood'],
  ['summary includes provenance', result.summary.provenance && result.summary.provenance.source === 'show-code-map'],
  ['summary includes history', result.summary.history && result.summary.history.recorded === true && result.summary.history.trend.status === 'first-run'],
  ['summary includes living project map', result.summary.living_project_map && result.summary.living_project_map.categories.some((item) => item.category === 'baseline')],
  ['summary compares history', secondResult.summary.history && secondResult.summary.history.trend.status === 'compared' && secondResult.summary.history.retained_runs === 2],
  ['compares living project map categories', attentionMap.status === 'attention' && attentionMap.categories.some((item) => item.category === 'new-hotspot' && item.paths.includes('src/core.ts')) && attentionMap.categories.some((item) => item.category === 'import-gap-growth') && attentionMap.categories.some((item) => item.category === 'changed-section-churn') && attentionMap.categories.some((item) => item.category === 'cooling-hotspot')],
  ['classifies stable living project map', stableMap.status === 'stable' && stableMap.categories[0].category === 'stable-structure'],
  ['tracks mixed import gap deltas separately', mixedImportGapMap.status === 'attention' && mixedImportGapMap.categories.some((item) => item.category === 'import-gap-growth' && item.metric === 'unresolved imports' && item.count === 2) && mixedImportGapMap.categories.some((item) => item.category === 'import-gap-reduction' && item.metric === 'skipped dynamic imports' && item.count === 2)],
  ['labels graph growth as score', attentionMap.categories.some((item) => item.category === 'graph-growth' && item.score === 6 && item.deltas.source_files === 1 && item.deltas.local_edges === 2 && item.deltas.sections === 3)],
  ['summary counts source files', result.summary.summary.source_files === 7],
  ['summary includes sections', result.summary.summary.sections >= 8],
  ['summary honors max hotspots', result.summary.high_fan_in.length <= 5 && result.summary.high_fan_out.length <= 5],
  ['summary includes fan-in', result.summary.high_fan_in.some((item) => item.path === 'src/shared/index.ts')],
  ['summary includes resolved edge types', result.summary.resolved_edges && Number.isInteger(result.summary.resolved_edges.relative) && Number.isInteger(result.summary.resolved_edges.alias) && result.summary.resolved_edges.examples],
  ['summary includes unsupported language scope', result.summary.unsupported_languages && result.summary.summary.unsupported_source_files === 0],
  ['summary includes markdown section count', result.summary.summary.markdown_section_files >= 1],
  ['summary includes import gaps', result.summary.import_gaps.unresolved.some((item) => item.specifier === './missing' && item.reason.includes('no matching local')) && result.summary.import_gaps.skipped_dynamic.some((item) => item.reason.includes('runtime'))],
  ['triages expected import gaps', triagedGaps.triage.expected_total === 4 && triageCategories['asset-or-data-import'].total === 1 && triageCategories['dynamic-package'].total === 1 && triageCategories['runtime-dynamic-import'].total === 1],
  ['triages review import gaps', triagedGaps.triage.needs_review_total === 3 && triageCategories['local-module-missing'].total === 1 && triageCategories['source-suffix-resolution-gap'].total === 1 && triageCategories['dynamic-local-or-alias'].total === 1],
  ['triages test fixture import gaps', triageCategories['test-fixture'].total === 1 && triageCategories['test-fixture'].expected === true],
  ['classifies fixture import gap paths', importGapScope('src/app.ts') === 'production' && importGapScope('fixtures/demo/test-app.ts') === 'test-fixture'],
  ['markdown includes provenance', markdown.includes('## Provenance') && markdown.includes('- Source: show\\-code\\-map')],
  ['markdown includes resolved edge summary', markdown.includes('## Resolved Edge Types') && markdown.includes('### Alias Edge Examples') && markdown.includes('### Literal Dynamic Edge Examples')],
  ['markdown includes unsupported language section', markdown.includes('## Unsupported Language Scope') && markdown.includes('None detected')],
  ['markdown includes trends', markdown.includes('## Trends') && markdown.includes('first recorded code-map snapshot')],
  ['markdown includes living project map', markdown.includes('## Living Project Map') && markdown.includes('Static JS/TS import and section trend only') && markdown.includes('baseline')],
  ['markdown includes import gaps', markdown.includes('## Import Gaps') && markdown.includes('### Triage') && markdown.includes('no matching local JS/TS file') && markdown.includes('non\\-literal dynamic import')],
  ['markdown includes artifacts', markdown.includes('## Artifacts') && markdown.includes('code-topology.json')],
  ['markdown includes limits', markdown.includes('Not a runtime call graph')],
  ['render returns markdown', rendered.includes('## High Fan-In')],
  ['cli json works', cliJson.summary.source_files === 7 && cliJson.artifacts.graph.endsWith('code-topology.json') && cliJson.high_fan_in.length <= 1 && cliJson.provenance.source === 'show-code-map'],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log('code map display: ok');
