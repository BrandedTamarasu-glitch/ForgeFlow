#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  parseArgs,
  renderArchitectureDocs,
  renderMarkdown,
} = require('./render-architecture-docs');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-architecture-'));
  return { root, projectDir: path.join(root, '.forgeflow', 'Demo') };
}

function seedProject(projectDir) {
  writeJson(path.join(projectDir, 'context/latest/code-topology.json'), {
    schema_version: '1',
    summary: {
      source_files: 4,
      local_edges: 3,
      external_imports: 2,
      unresolved_imports: 1,
      skipped_dynamic_imports: 1,
    },
    nodes: [
      { path: 'scripts/forgeflow/build-context-pack.js' },
      { path: 'scripts/forgeflow/render-architecture-docs.js' },
      { path: 'commands/forgeflow-architecture.md' },
    ],
    high_fan_in: [{ path: 'scripts/forgeflow/file-safety.js', fan_in: 10 }],
    high_fan_out: [{ path: 'scripts/forgeflow/build-context-pack.js', fan_out: 5 }],
    markdown_sections: [{ path: 'commands/review.md', sections: [] }],
    provenance: { git: { commit_short: 'abc123' } },
  });
  writeJson(path.join(projectDir, 'context/project-operating-model.json'), {
    schema_version: '1',
    confidence: { band: 'medium' },
    domains: [{ name: 'scripts/forgeflow', file_count: 3, confidence: 'medium', source: 'code-topology' }],
    high_care_files: [{ path: 'scripts/forgeflow/install-manifest.js', reason: 'manifest hub', confidence: 'medium' }],
    risk_zones: [{ severity: 'warn', summary: 'scope manifest over budget', next_action: 'trim context', source: 'context-advisor' }],
    validation_model: [{ command_or_pattern: 'full suite before release' }],
  });
  writeJson(path.join(projectDir, 'context/project-intelligence-rollup.json'), {
    schema_version: '1',
    validation_patterns: ['source smoke before release'],
  });
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'project-learnings.md'), '# Learnings\n\n- Use focused tests first.\n');
}

function throws(fn, pattern) {
  try {
    fn();
  } catch (err) {
    return pattern.test(err.message);
  }
  return false;
}

const seeded = makeRoot();
seedProject(seeded.projectDir);
const report = renderArchitectureDocs(seeded);
const markdown = renderMarkdown(report);

const empty = makeRoot();
const emptyReport = renderArchitectureDocs(empty);

const malformed = makeRoot();
fs.mkdirSync(path.join(malformed.projectDir, 'context/latest'), { recursive: true });
fs.writeFileSync(path.join(malformed.projectDir, 'context/latest/code-topology.json'), '{nope');
const malformedReport = renderArchitectureDocs(malformed);

const symlink = makeRoot();
fs.mkdirSync(path.join(symlink.projectDir, 'context/latest'), { recursive: true });
fs.writeFileSync(path.join(symlink.root, 'outside.json'), '{}\n');
fs.symlinkSync(path.join(symlink.root, 'outside.json'), path.join(symlink.projectDir, 'context/latest/code-topology.json'));
const symlinkReport = renderArchitectureDocs(symlink);

const writeRoot = makeRoot();
seedProject(writeRoot.projectDir);
const written = renderArchitectureDocs({ ...writeRoot, write: true });

const symlinkProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-architecture-symlink-project-'));
const realProject = path.join(symlinkProjectRoot, 'real');
fs.mkdirSync(realProject, { recursive: true });
const linkedProject = path.join(symlinkProjectRoot, 'linked');
fs.symlinkSync(realProject, linkedProject);

const opts = parseArgs(['--root', seeded.root, '--project-dir', seeded.projectDir, '--write', '--json']);

const checks = [
  ['ready with seeded evidence', report.status === 'ready' && report.summary.source_files === 4],
  ['domains from operating model', report.domains[0].name === 'scripts/forgeflow'],
  ['entrypoint hints include command and render helper', report.entrypoints.some((item) => item.path === 'commands/forgeflow-architecture.md') && report.entrypoints.some((item) => item.path === 'scripts/forgeflow/render-architecture-docs.js')],
  ['hotspots include high care and fan-in', report.hotspots.high_care_files.some((item) => item.path === 'scripts/forgeflow/install-manifest.js') && report.hotspots.high_fan_in[0].path === 'scripts/forgeflow/file-safety.js'],
  ['markdown includes boundary and gaps', markdown.includes('Generated architecture docs are advisory') && markdown.includes('static-import-gap')],
  ['empty state is explicit', emptyReport.status === 'empty' && emptyReport.gaps.some((item) => item.kind === 'missing-source')],
  ['malformed input is attention', malformedReport.status === 'attention' && malformedReport.gaps.some((item) => item.kind === 'invalid-source')],
  ['symlink input is attention', symlinkReport.status === 'attention' && symlinkReport.gaps.some((item) => /symlink/i.test(item.action))],
  ['write mode writes local artifacts', fs.existsSync(written.artifacts.markdown) && fs.existsSync(written.artifacts.json) && JSON.parse(fs.readFileSync(written.artifacts.json, 'utf8')).schema_version === '1'],
  ['symlink project directory refused', throws(() => renderArchitectureDocs({ root: symlinkProjectRoot, projectDir: linkedProject }), /symlinked project directory/)],
  ['parses args', opts.root === seeded.root && opts.projectDir === seeded.projectDir && opts.write && opts.json],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('architecture docs: ok');
