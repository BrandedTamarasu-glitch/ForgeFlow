#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  codeownersFor,
  ownerSurface,
  parseArgs,
  parseCodeowners,
  renderMarkdown,
  renderOwnershipMap,
} = require('./render-ownership-map');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-ownership-'));
  return { root, projectDir: path.join(root, '.forgeflow', 'Demo') };
}

function seed(projectDir) {
  writeJson(path.join(projectDir, 'context/latest/code-topology.json'), {
    summary: { source_files: 4 },
    nodes: [
      { path: 'scripts/forgeflow/file-safety.js' },
      { path: 'scripts/forgeflow/build-context-pack.js' },
      { path: 'commands/forgeflow-health.md' },
      { path: 'README.md' },
    ],
    high_fan_in: [{ path: 'scripts/forgeflow/file-safety.js', fan_in: 8 }],
    high_fan_out: [{ path: 'scripts/forgeflow/build-context-pack.js', fan_out: 6 }],
  });
  writeJson(path.join(projectDir, 'context/project-operating-model.json'), {
    high_care_files: [
      { path: 'scripts/forgeflow/install-manifest.js', reason: 'manifest hub' },
      { path: 'scripts/forgeflow/build-context-pack.js (3 signals)', reason: 'learned hot file' },
    ],
  });
  writeJson(path.join(projectDir, 'context/architecture.json'), { status: 'ready' });
}

function throws(fn, pattern) {
  try {
    fn();
  } catch (err) {
    return pattern.test(err.message);
  }
  return false;
}

const noOwners = makeRoot();
seed(noOwners.projectDir);
const noOwnersReport = renderOwnershipMap(noOwners);
const noOwnersMarkdown = renderMarkdown(noOwnersReport);

const withOwners = makeRoot();
seed(withOwners.projectDir);
fs.writeFileSync(path.join(withOwners.root, 'CODEOWNERS'), [
  'scripts/forgeflow/file-safety.js @core',
  'scripts/forgeflow/ @forgeflow/runtime',
  'commands/ @forgeflow/commands',
  'README.md @docs',
  '',
].join('\n'));
const withOwnersReport = renderOwnershipMap(withOwners);

const parsed = parseCodeowners('scripts/ @team\nbroken\n');
const matches = codeownersFor('scripts/forgeflow/file-safety.js', { entries: parsed.entries });

const malformed = makeRoot();
fs.mkdirSync(path.join(malformed.projectDir, 'context/latest'), { recursive: true });
fs.writeFileSync(path.join(malformed.projectDir, 'context/latest/code-topology.json'), '{nope');
const malformedReport = renderOwnershipMap(malformed);

const symlink = makeRoot();
fs.mkdirSync(path.join(symlink.projectDir, 'context/latest'), { recursive: true });
fs.writeFileSync(path.join(symlink.root, 'outside.json'), '{}\n');
fs.symlinkSync(path.join(symlink.root, 'outside.json'), path.join(symlink.projectDir, 'context/latest/code-topology.json'));
const symlinkReport = renderOwnershipMap(symlink);

const writeRoot = makeRoot();
seed(writeRoot.projectDir);
const written = renderOwnershipMap({ ...writeRoot, write: true });

const symlinkProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-ownership-symlink-project-'));
const realProject = path.join(symlinkProjectRoot, 'real');
fs.mkdirSync(realProject, { recursive: true });
const linkedProject = path.join(symlinkProjectRoot, 'linked');
fs.symlinkSync(realProject, linkedProject);

const opts = parseArgs(['--root', noOwners.root, '--project-dir', noOwners.projectDir, '--write', '--json']);

const checks = [
  ['surface mapping works', ownerSurface('commands/forgeflow-health.md') === 'command-wrapper' && ownerSurface('README.md') === 'docs'],
  ['absent CODEOWNERS still ready', noOwnersReport.status === 'ready' && noOwnersReport.codeowners.status === 'missing'],
  ['surfaces include runtime and docs', noOwnersReport.owner_surfaces.some((item) => item.surface === 'context-intelligence') && noOwnersReport.owner_surfaces.some((item) => item.surface === 'docs')],
  ['learned signal suffixes removed from paths', noOwnersReport.high_care_files.some((item) => item.path === 'scripts/forgeflow/build-context-pack.js') && !noOwnersReport.high_care_files.some((item) => item.path.includes('(3 signals)'))],
  ['surface examples are de-duplicated', noOwnersReport.owner_surfaces.every((item) => item.example_files.length === new Set(item.example_files).size)],
  ['coverage gaps reported without CODEOWNERS', noOwnersReport.coverage_gaps.length > 0],
  ['markdown includes boundary', noOwnersMarkdown.includes('Ownership map is advisory')],
  ['CODEOWNERS coverage parsed', withOwnersReport.codeowners.status === 'present' && withOwnersReport.summary.codeowners_entries === 4 && withOwnersReport.high_care_files.some((item) => item.codeowners.length > 0)],
  ['CODEOWNERS parser flags malformed line', parsed.entries.length === 1 && parsed.invalid.length === 1 && matches.includes('@team')],
  ['malformed artifact attention', malformedReport.status === 'attention' && malformedReport.invalid_artifacts.length === 1],
  ['symlink artifact attention', symlinkReport.status === 'attention' && /symlink/i.test(symlinkReport.invalid_artifacts[0].reason)],
  ['write mode writes local artifacts', fs.existsSync(written.artifacts.markdown) && fs.existsSync(written.artifacts.json) && JSON.parse(fs.readFileSync(written.artifacts.json, 'utf8')).schema_version === '1'],
  ['symlink project refused', throws(() => renderOwnershipMap({ root: symlinkProjectRoot, projectDir: linkedProject }), /symlinked project directory/)],
  ['parses args', opts.root === noOwners.root && opts.projectDir === noOwners.projectDir && opts.write && opts.json],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('ownership map: ok');
