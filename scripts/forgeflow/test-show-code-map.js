#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  renderProjectCodeMap,
  showCodeMap,
} = require('./show-code-map');

const repoRoot = path.resolve(__dirname, '..', '..');
const fixtureRoot = path.join(repoRoot, 'fixtures/code-topology');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-code-map-'));
const out = path.join(tmp, 'project-code-map.md');

const result = showCodeMap({
  root: fixtureRoot,
  out,
  maxHotspots: 5,
});
const markdown = fs.readFileSync(out, 'utf8');
const graphPath = path.join(fixtureRoot, result.summary.artifacts.graph);
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
const cli = spawnSync(path.join(repoRoot, 'scripts/forgeflow/show-code-map.js'), [
  '--root',
  fixtureRoot,
  '--out',
  path.join(tmp, 'cli-code-map.md'),
  '--max-hotspots',
  '1',
  '--json',
], { encoding: 'utf8' });
const cliJson = cli.status === 0 ? JSON.parse(cli.stdout) : {};
const rendered = renderProjectCodeMap(result.summary);

const checks = [
  ['writes markdown', fs.existsSync(out) && markdown.includes('# Forgeflow Project Code Map')],
  ['writes topology graph', fs.existsSync(graphPath)],
  ['writes compact topology graph', graph.scope === 'changed-neighborhood'],
  ['summary includes provenance', result.summary.provenance && result.summary.provenance.source === 'show-code-map'],
  ['summary counts source files', result.summary.summary.source_files === 7],
  ['summary includes sections', result.summary.summary.sections >= 8],
  ['summary honors max hotspots', result.summary.high_fan_in.length <= 5 && result.summary.high_fan_out.length <= 5],
  ['summary includes fan-in', result.summary.high_fan_in.some((item) => item.path === 'src/shared/index.ts')],
  ['summary includes markdown section count', result.summary.summary.markdown_section_files >= 1],
  ['markdown includes provenance', markdown.includes('## Provenance') && markdown.includes('- Source: show\\-code\\-map')],
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
