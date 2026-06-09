#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  parseArgs,
  renderDogfoodReport,
  renderMarkdown,
} = require('./render-dogfood-report');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-dogfood-'));
  return { root, projectDir: path.join(root, '.forgeflow', 'Demo') };
}

function seedComplete(projectDir) {
  writeJson(path.join(projectDir, 'context', 'architecture.json'), { schema_version: '1', sections: [] });
  writeJson(path.join(projectDir, 'context', 'ownership-map.json'), { schema_version: '1', owner_surfaces: [] });
  writeJson(path.join(projectDir, 'context', 'invocation-hints.json'), { schema_version: '1', invocation_hints: [] });
  writeJson(path.join(projectDir, 'context', 'project-operating-model.json'), { schema_version: '1', domains: [] });
  writeJson(path.join(projectDir, 'context', 'latest', 'context-telemetry.json'), { compact_tokens: 1200, estimated_saved_tokens: 4000 });
  writeJson(path.join(projectDir, 'context', 'latest', 'synthesis-input.json'), {
    context_blocks: [{ name: 'architecture-intelligence' }, { name: 'ownership-map' }],
  });
  writeJson(path.join(projectDir, 'context', 'latest', 'packet-artifacts.json'), { packet_count: 4 });
  writeJson(path.join(projectDir, 'context', 'latest', 'latest-insights-report.json'), { status: 'injected' });
  writeJson(path.join(projectDir, 'context', 'latest', 'code-topology.json'), { nodes: [] });
  fs.writeFileSync(path.join(projectDir, 'context', 'latest', 'failure-digest.md'), '# Failure Digest\n');
}

function throws(fn, pattern) {
  try {
    fn();
  } catch (err) {
    return pattern.test(err.message);
  }
  return false;
}

const complete = makeRoot();
seedComplete(complete.projectDir);
const report = renderDogfoodReport(complete);
const markdown = renderMarkdown(report);
const written = renderDogfoodReport({ ...complete, write: true });

const missing = makeRoot();
fs.mkdirSync(path.join(missing.projectDir, 'context'), { recursive: true });
const missingReport = renderDogfoodReport(missing);

const invalid = makeRoot();
fs.mkdirSync(path.join(invalid.projectDir, 'context'), { recursive: true });
fs.writeFileSync(path.join(invalid.projectDir, 'context', 'architecture.json'), '{nope');
const invalidReport = renderDogfoodReport(invalid);

const symlink = makeRoot();
fs.mkdirSync(path.join(symlink.projectDir, 'context'), { recursive: true });
fs.writeFileSync(path.join(symlink.root, 'outside.json'), '{}\n');
fs.symlinkSync(path.join(symlink.root, 'outside.json'), path.join(symlink.projectDir, 'context', 'architecture.json'));
const symlinkReport = renderDogfoodReport(symlink);

const symlinkProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-dogfood-symlink-project-'));
const realProject = path.join(symlinkProjectRoot, 'real');
fs.mkdirSync(realProject, { recursive: true });
const linkedProject = path.join(symlinkProjectRoot, 'linked');
fs.symlinkSync(realProject, linkedProject);

const opts = parseArgs(['--root', complete.root, '--project-dir', complete.projectDir, '--write', '--json']);

const checks = [
  ['complete evidence can be considered for promotion', report.status === 'ready' && report.promotion_decision === 'consider-promote'],
  ['context pack signals detect architecture injection', report.context_pack_signals.architecture_injected],
  ['boundary names deferred automation classes', markdown.includes('no GitHub calls') && markdown.includes('no automatic promotion')],
  ['write mode writes local artifacts', fs.existsSync(written.artifacts.markdown) && fs.existsSync(written.artifacts.json) && JSON.parse(fs.readFileSync(written.artifacts.json, 'utf8')).schema_version === '1'],
  ['missing evidence stays read-only', missingReport.status === 'watch' && missingReport.promotion_decision === 'keep-read-only'],
  ['invalid evidence asks refine', invalidReport.status === 'attention' && invalidReport.promotion_decision === 'refine'],
  ['symlink artifact becomes invalid evidence', symlinkReport.status === 'attention' && /symlink/i.test(symlinkReport.invalid_artifacts[0].reason)],
  ['symlink project refused', throws(() => renderDogfoodReport({ root: symlinkProjectRoot, projectDir: linkedProject }), /symlinked project directory/)],
  ['parses args', opts.root === complete.root && opts.projectDir === complete.projectDir && opts.write && opts.json],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('dogfood report: ok');
