#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  buildCodeTopology,
  deniedPath,
  extractImports,
  extractSections,
  parseDiffChangedLines,
  resolveLocalImport,
  sectionsForChangedLines,
  withSectionRanges,
} = require('./build-code-topology');

const repoRoot = path.resolve(__dirname, '..', '..');
const fixtureRoot = path.join(repoRoot, 'fixtures/code-topology');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-code-topology-'));
const out = path.join(tmp, 'code-topology.json');
const markdownOut = path.join(tmp, 'code-topology.md');
const telemetryOut = path.join(tmp, 'code-topology-telemetry.json');

const result = buildCodeTopology({
  root: fixtureRoot,
  filesPath: path.join(fixtureRoot, 'changed.files'),
  out,
  markdownOut,
  telemetryOut,
  maxHotspots: 5,
});

const topology = JSON.parse(fs.readFileSync(out, 'utf8'));
const markdown = fs.readFileSync(markdownOut, 'utf8');
const telemetry = JSON.parse(fs.readFileSync(telemetryOut, 'utf8'));
const shared = topology.nodes.find((node) => node.path === 'src/shared/index.ts');
const feature = topology.nodes.find((node) => node.path === 'src/features/feature.ts');
const guideSections = topology.markdown_sections.find((item) => item.path === 'docs/guide.md');
const cli = spawnSync(path.join(repoRoot, 'scripts/forgeflow/build-code-topology.js'), [
  '--root',
  fixtureRoot,
  '--files',
  path.join(fixtureRoot, 'changed.files'),
  '--out',
  path.join(tmp, 'cli.json'),
  '--markdown-out',
  path.join(tmp, 'cli.md'),
  '--telemetry-out',
  path.join(tmp, 'cli-telemetry.json'),
  '--json',
], { encoding: 'utf8' });
const cliJson = cli.status === 0 ? JSON.parse(cli.stdout) : {};
const compactResult = buildCodeTopology({
  root: fixtureRoot,
  filesPath: path.join(fixtureRoot, 'changed.files'),
  out: path.join(tmp, 'compact.json'),
  markdownOut: path.join(tmp, 'compact.md'),
  telemetryOut: path.join(tmp, 'compact-telemetry.json'),
  maxHotspots: 5,
  compact: true,
});
const outsideFilesPath = path.join(tmp, 'outside.files');
fs.writeFileSync(outsideFilesPath, 'src/features/feature.ts\n');
const externalFilesPathResult = buildCodeTopology({
  root: fixtureRoot,
  filesPath: outsideFilesPath,
  out: path.join(tmp, 'external-files-path.json'),
  markdownOut: path.join(tmp, 'external-files-path.md'),
  telemetryOut: path.join(tmp, 'external-files-path-telemetry.json'),
});
const importKinds = extractImports("import type { User } from './types';\nexport { x } from './x';\nconst y = require('./y');");
const sourceSections = extractSections('src/example.ts', 'export class Example {}\nexport function run() {}\nconst local = () => true;\n');
const markdownSections = extractSections('README.md', '# Title\n\n## Details\n');
const changedLines = parseDiffChangedLines('diff --git a/src/example.ts b/src/example.ts\n--- a/src/example.ts\n+++ b/src/example.ts\n@@ -2,0 +3,2 @@\n+const x = 1;\n+const y = 2;\n');
const touchedSections = sectionsForChangedLines([
  { kind: 'function', name: 'first', line: 1 },
  { kind: 'function', name: 'second', line: 5 },
], [3, 6], 8);
const rangedSections = withSectionRanges([
  { kind: 'function', name: 'first', line: 1 },
  { kind: 'function', name: 'second', line: 5 },
], 8);
const sourceSet = new Set(['src/shared/index.ts']);
const gitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-code-topology-git-'));
fs.mkdirSync(path.join(gitRoot, 'src'), { recursive: true });
fs.writeFileSync(path.join(gitRoot, 'src/tracked.ts'), 'export const tracked = true;\n');
spawnSync('git', ['init'], { cwd: gitRoot, encoding: 'utf8' });
spawnSync('git', ['add', 'src/tracked.ts'], { cwd: gitRoot, encoding: 'utf8' });
spawnSync('git', ['-c', 'user.name=Forgeflow Test', '-c', 'user.email=forgeflow@example.invalid', 'commit', '-m', 'base'], { cwd: gitRoot, encoding: 'utf8' });
fs.writeFileSync(path.join(gitRoot, 'src/tracked.ts'), 'export function tracked() {\n  return false;\n}\n');
fs.unlinkSync(path.join(gitRoot, 'src/tracked.ts'));
fs.writeFileSync(path.join(gitRoot, 'src/untracked.ts'), 'export const untracked = true;\n');
const gitResult = buildCodeTopology({
  root: gitRoot,
  out: path.join(tmp, 'git-topology.json'),
  markdownOut: path.join(tmp, 'git-topology.md'),
  telemetryOut: path.join(tmp, 'git-topology-telemetry.json'),
});
const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-code-topology-outside-'));
fs.writeFileSync(path.join(outsideRoot, 'outside.ts'), 'export const outside = true;\n');
const symlinkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-code-topology-symlink-'));
fs.mkdirSync(path.join(symlinkRoot, 'src'), { recursive: true });
try {
  fs.symlinkSync(path.join(outsideRoot, 'outside.ts'), path.join(symlinkRoot, 'src/linked.ts'));
} catch (_err) {
  // Some filesystems disable symlink creation; the check below accepts that case.
}
const symlinkResult = buildCodeTopology({
  root: symlinkRoot,
  out: path.join(tmp, 'symlink-topology.json'),
  markdownOut: path.join(tmp, 'symlink-topology.md'),
  telemetryOut: path.join(tmp, 'symlink-topology-telemetry.json'),
});
const changedSectionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-code-topology-changed-section-'));
fs.mkdirSync(path.join(changedSectionRoot, 'src'), { recursive: true });
fs.writeFileSync(path.join(changedSectionRoot, 'src/work.ts'), [
  'export function stable() {',
  '  return true;',
  '}',
  '',
  'export function target() {',
  '  return 1;',
  '}',
  '',
].join('\n'));
spawnSync('git', ['init'], { cwd: changedSectionRoot, encoding: 'utf8' });
spawnSync('git', ['add', 'src/work.ts'], { cwd: changedSectionRoot, encoding: 'utf8' });
spawnSync('git', ['-c', 'user.name=Forgeflow Test', '-c', 'user.email=forgeflow@example.invalid', 'commit', '-m', 'base'], { cwd: changedSectionRoot, encoding: 'utf8' });
fs.writeFileSync(path.join(changedSectionRoot, 'src/work.ts'), [
  'export function stable() {',
  '  return true;',
  '}',
  '',
  'export function target() {',
  '  return 2;',
  '}',
  '',
].join('\n'));
const changedSectionResult = buildCodeTopology({
  root: changedSectionRoot,
  out: path.join(tmp, 'changed-section-topology.json'),
  markdownOut: path.join(tmp, 'changed-section-topology.md'),
  telemetryOut: path.join(tmp, 'changed-section-topology-telemetry.json'),
});
const changedSectionNeighbor = changedSectionResult.topology.changed_file_neighbors.find((item) => item.path === 'src/work.ts');

const checks = [
  ['result paths', result.out === out && result.markdown_out === markdownOut && result.telemetry_path === telemetryOut],
  ['writes outputs', fs.existsSync(out) && fs.existsSync(markdownOut) && fs.existsSync(telemetryOut)],
  ['counts source files', topology.summary.source_files === 7],
  ['records provenance', topology.provenance && topology.provenance.source === 'build-code-topology' && topology.provenance.git_available === false],
  ['counts mapped sections', topology.summary.sections >= 8],
  ['counts markdown section files', topology.summary.markdown_section_files === 1],
  ['skips dependencies', !topology.nodes.some((node) => node.path.includes('node_modules')) && deniedPath('node_modules/ignored/index.ts') === 'generated or dependency path'],
  ['extracts import forms', importKinds.imports.length === 3],
  ['extracts source sections', sourceSections.some((item) => item.kind === 'class' && item.name === 'Example') && sourceSections.some((item) => item.kind === 'function' && item.name === 'run') && sourceSections.some((item) => item.kind === 'const' && item.name === 'local')],
  ['extracts markdown headings', markdownSections.length === 2 && markdownSections[1].name === 'Details'],
  ['parses diff changed lines', changedLines['src/example.ts'].length === 2 && changedLines['src/example.ts'][0] === 3],
  ['maps changed lines to sections', touchedSections.length === 2 && touchedSections[0].name === 'first' && touchedSections[1].name === 'second'],
  ['adds section ranges', rangedSections[0].end_line === 4 && rangedSections[1].end_line === 8],
  ['resolves index import', resolveLocalImport('src/app/main.ts', '../shared', sourceSet).target === 'src/shared/index.ts'],
  ['tracks local edges', topology.edges.some((edge) => edge.source === 'src/app/main.ts' && edge.target === 'src/features/feature.ts')],
  ['tracks commonjs edge', topology.edges.some((edge) => edge.source === 'src/lib/legacy.js' && edge.target === 'src/shared/index.ts' && edge.kind === 'require')],
  ['tracks re-export edge', topology.edges.some((edge) => edge.source === 'src/lib/helper.ts' && edge.target === 'src/shared/index.ts' && edge.kind === 'export-from')],
  ['resolves js specifier to ts file', topology.edges.some((edge) => edge.source === 'src/app/main.ts' && edge.target === 'src/lib/helper.ts' && edge.specifier === '../lib/helper.js')],
  ['high fan-in detects shared', topology.high_fan_in[0].path === 'src/shared/index.ts' && shared.fan_in === 4],
  ['node records sections', feature.sections.some((item) => item.kind === 'function' && item.name === 'runFeature' && Number.isInteger(item.end_line))],
  ['markdown sections recorded', guideSections && guideSections.sections.some((item) => item.name === 'Review Notes' && Number.isInteger(item.end_line))],
  ['high fan-out detects feature', topology.high_fan_out.some((item) => item.path === 'src/features/feature.ts' && item.fan_out === 2)],
  ['changed neighbor includes dependent', feature.imported_by.includes('src/app/main.ts') && topology.changed_file_neighbors[0].read_next.some((item) => item.path === 'src/app/main.ts')],
  ['changed neighbor includes sections', topology.changed_file_neighbors[0].sections.some((item) => item.name === 'runFeature')],
  ['unresolved import reported', topology.unresolved.some((item) => item.source === 'src/features/feature.ts' && item.specifier === './missing')],
  ['markdown escapes unresolved imports', markdown.includes('bad\\]\\#missing')],
  ['dynamic import reported', topology.skipped_dynamic.some((item) => item.source === 'src/features/feature.ts')],
  ['markdown renders review focus', markdown.includes('## Changed File Neighbors') && markdown.includes('Static JS/TS module graph only.')],
  ['markdown renders provenance', markdown.includes('Provenance: git unavailable')],
  ['markdown renders sections', markdown.includes('Sections mapped') && markdown.includes('## Markdown Sections') && markdown.includes('function runFeature (lines 6-9)')],
  ['telemetry written', telemetry.kind === 'code-topology' && Number.isInteger(telemetry.estimated_compact_tokens)],
  ['cli json works', cli.status === 0 && cliJson.summary.source_files === 7 && cliJson.provenance.source === 'build-code-topology'],
  ['compact scope marks topology', compactResult.topology.scope === 'changed-neighborhood'],
  ['compact keeps changed neighbor', compactResult.topology.changed_file_neighbors.some((item) => item.path === 'src/features/feature.ts')],
  ['compact trims node list', compactResult.topology.nodes.length < topology.nodes.length],
  ['external files path redacted', externalFilesPathResult.topology.provenance.files_path === '(external)'],
  ['denies sensitive paths', deniedPath('config/api-token.ts') === 'sensitive filename'],
  ['git scan includes untracked source', gitResult.topology.nodes.some((node) => node.path === 'src/untracked.ts') && gitResult.topology.changed_files.includes('src/untracked.ts')],
  ['git provenance records dirty repo', gitResult.topology.provenance.git_available === true && gitResult.topology.provenance.dirty === true && gitResult.topology.provenance.untracked_files === 1],
  ['git scan skips deleted tracked source', !gitResult.topology.nodes.some((node) => node.path === 'src/tracked.ts') && gitResult.topology.denied.some((item) => item.path === 'src/tracked.ts' && item.reason === 'missing source path')],
  ['changed section detected from git diff', changedSectionResult.topology.summary.changed_sections === 1 && changedSectionNeighbor.changed_sections[0].name === 'target' && changedSectionNeighbor.changed_sections[0].end_line === 7],
  ['symlink source denied', symlinkResult.topology.nodes.length === 0 && (!fs.existsSync(path.join(symlinkRoot, 'src/linked.ts')) || symlinkResult.topology.denied.some((item) => item.reason === 'symbolic links are not accepted'))],
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

console.log('code topology: ok');
