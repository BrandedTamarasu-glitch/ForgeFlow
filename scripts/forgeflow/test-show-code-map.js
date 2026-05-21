#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  compactCodeMapHistory,
  importGapSummary,
  importGapScope,
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
const cli = spawnSync(path.join(repoRoot, 'scripts/forgeflow/show-code-map.js'), [
  '--root',
  fixtureRoot,
  '--project-dir',
  path.join(tmp, 'cli-project'),
  '--out',
  path.join(tmp, 'cli-code-map.md'),
  '--max-hotspots',
  '1',
  '--json',
], { encoding: 'utf8' });
const cliJson = cli.status === 0 ? JSON.parse(cli.stdout) : {};
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

const checks = [
  ['writes markdown', fs.existsSync(out) && markdown.includes('# Forgeflow Project Code Map')],
  ['writes topology graph', fs.existsSync(graphPath)],
  ['writes code map history', fs.existsSync(historyPath) && fs.readFileSync(historyPath, 'utf8').trim().split(/\r?\n/).length === 2],
  ['retains bounded history', fs.existsSync(retainedHistoryPath) && fs.readFileSync(retainedHistoryPath, 'utf8').trim().split(/\r?\n/).length === 2],
  ['history compactor keeps latest records', compactCodeMapHistory([{ id: 1 }, { id: 2 }, { id: 3 }], 2).map((item) => item.id).join(',') === '2,3'],
  ['writes compact topology graph', graph.scope === 'changed-neighborhood'],
  ['summary includes provenance', result.summary.provenance && result.summary.provenance.source === 'show-code-map'],
  ['summary includes history', result.summary.history && result.summary.history.recorded === true && result.summary.history.trend.status === 'first-run'],
  ['summary compares history', secondResult.summary.history && secondResult.summary.history.trend.status === 'compared' && secondResult.summary.history.retained_runs === 2],
  ['summary counts source files', result.summary.summary.source_files === 7],
  ['summary includes sections', result.summary.summary.sections >= 8],
  ['summary honors max hotspots', result.summary.high_fan_in.length <= 5 && result.summary.high_fan_out.length <= 5],
  ['summary includes fan-in', result.summary.high_fan_in.some((item) => item.path === 'src/shared/index.ts')],
  ['summary includes resolved edge types', result.summary.resolved_edges && Number.isInteger(result.summary.resolved_edges.relative) && Number.isInteger(result.summary.resolved_edges.alias) && result.summary.resolved_edges.examples],
  ['summary includes markdown section count', result.summary.summary.markdown_section_files >= 1],
  ['summary includes import gaps', result.summary.import_gaps.unresolved.some((item) => item.specifier === './missing' && item.reason.includes('no matching local')) && result.summary.import_gaps.skipped_dynamic.some((item) => item.reason.includes('runtime'))],
  ['triages expected import gaps', triagedGaps.triage.expected_total === 4 && triageCategories['asset-or-data-import'].total === 1 && triageCategories['dynamic-package'].total === 1 && triageCategories['runtime-dynamic-import'].total === 1],
  ['triages review import gaps', triagedGaps.triage.needs_review_total === 3 && triageCategories['local-module-missing'].total === 1 && triageCategories['source-suffix-resolution-gap'].total === 1 && triageCategories['dynamic-local-or-alias'].total === 1],
  ['triages test fixture import gaps', triageCategories['test-fixture'].total === 1 && triageCategories['test-fixture'].expected === true],
  ['classifies fixture import gap paths', importGapScope('src/app.ts') === 'production' && importGapScope('fixtures/demo/test-app.ts') === 'test-fixture'],
  ['markdown includes provenance', markdown.includes('## Provenance') && markdown.includes('- Source: show\\-code\\-map')],
  ['markdown includes resolved edge summary', markdown.includes('## Resolved Edge Types') && markdown.includes('### Alias Edge Examples') && markdown.includes('### Literal Dynamic Edge Examples')],
  ['markdown includes trends', markdown.includes('## Trends') && markdown.includes('first recorded code-map snapshot')],
  ['markdown includes import gaps', markdown.includes('## Import Gaps') && markdown.includes('### Triage') && markdown.includes('no matching local JS/TS file') && markdown.includes('non\\-literal dynamic import')],
  ['markdown includes artifacts', markdown.includes('## Artifacts') && markdown.includes('code-topology.json')],
  ['markdown includes limits', markdown.includes('Not a runtime call graph')],
  ['render returns markdown', rendered.includes('## High Fan-In')],
  ['cli json works', cli.status === 0 && cliJson.summary.source_files === 7 && cliJson.artifacts.graph.endsWith('code-topology.json') && cliJson.high_fan_in.length <= 1 && cliJson.provenance.source === 'show-code-map'],
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
