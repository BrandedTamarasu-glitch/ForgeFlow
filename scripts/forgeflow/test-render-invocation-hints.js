#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  configHints,
  parseArgs,
  renderInvocationHints,
  renderMarkdown,
  topologyEntryHints,
} = require('./render-invocation-hints');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-invocation-'));
  return { root, projectDir: path.join(root, '.forgeflow', 'Demo') };
}

function seed(root, projectDir) {
  writeJson(path.join(root, 'package.json'), {
    name: 'demo',
    main: 'src/server.js',
    scripts: {
      start: 'node src/server.js',
      test: 'node test.js',
    },
  });
  writeJson(path.join(root, 'services/api/package.json'), {
    name: 'api',
    bin: { api: 'cli.js' },
    scripts: { dev: 'node cli.js' },
  });
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/server.js'), 'require("./routes/index")\n');
  fs.mkdirSync(path.join(root, 'src/routes'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/routes/index.js'), 'module.exports = {}\n');
  fs.writeFileSync(path.join(root, 'vite.config.js'), 'export default {}\n');
  fs.mkdirSync(path.join(root, 'fixtures/app'), { recursive: true });
  fs.writeFileSync(path.join(root, 'fixtures/app/main.ts'), 'export {}\n');
  fs.mkdirSync(path.join(root, 'node_modules/skip'), { recursive: true });
  writeJson(path.join(root, 'node_modules/skip/package.json'), { name: 'skip', scripts: { start: 'bad' } });
  writeJson(path.join(projectDir, 'context/latest/code-topology.json'), {
    nodes: [
      { path: 'src/server.js', fan_in: 0, fan_out: 2 },
      { path: 'commands/demo.md', fan_in: 0, fan_out: 0 },
      { path: 'src/routes/index.js', fan_in: 1, fan_out: 0 },
      { path: 'fixtures/app/main.ts', fan_in: 0, fan_out: 0 },
    ],
    changed_files: ['src/server.js'],
  });
}

function throws(fn, pattern) {
  try {
    fn();
  } catch (err) {
    return pattern.test(err.message);
  }
  return false;
}

const base = makeRoot();
seed(base.root, base.projectDir);
const report = renderInvocationHints(base);
const markdown = renderMarkdown(report);
const written = renderInvocationHints({ ...base, write: true });

const malformed = makeRoot();
fs.mkdirSync(path.join(malformed.projectDir, 'context/latest'), { recursive: true });
fs.writeFileSync(path.join(malformed.projectDir, 'context/latest/code-topology.json'), '{nope');
const malformedReport = renderInvocationHints(malformed);

const symlink = makeRoot();
fs.mkdirSync(path.join(symlink.projectDir, 'context/latest'), { recursive: true });
fs.writeFileSync(path.join(symlink.root, 'outside.json'), '{}\n');
fs.symlinkSync(path.join(symlink.root, 'outside.json'), path.join(symlink.projectDir, 'context/latest/code-topology.json'));
const symlinkReport = renderInvocationHints(symlink);

const symlinkProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-invocation-symlink-project-'));
const realProject = path.join(symlinkProjectRoot, 'real');
fs.mkdirSync(realProject, { recursive: true });
const linkedProject = path.join(symlinkProjectRoot, 'linked');
fs.symlinkSync(realProject, linkedProject);

const opts = parseArgs(['--root', base.root, '--project-dir', base.projectDir, '--write', '--json']);
const topologyHints = topologyEntryHints({
  nodes: [{ path: 'src/app.ts', fan_out: 3 }, { path: 'lib/util.ts', fan_out: 1 }],
  changed_files: ['src/app.ts'],
});
const configs = configHints(['next.config.js', 'src/app.ts', 'playwright.config.ts']);

const checks = [
  ['ready with package and topology evidence', report.status === 'ready'],
  ['node_modules packages skipped', report.packages.length === 2 && report.packages.every((item) => !item.path.startsWith('node_modules/'))],
  ['package scripts become invocation hints', report.invocation_hints.some((item) => item.kind === 'package-script' && item.suggested_invocation === 'npm run start')],
  ['nested package script has cd hint', report.invocation_hints.some((item) => item.suggested_invocation === 'cd services/api && npm run dev')],
  ['entry fields and bins are reported', report.invocation_hints.some((item) => item.kind === 'package-entry-field') && report.invocation_hints.some((item) => item.kind === 'package-bin')],
  ['topology command and source entrypoints reported', report.invocation_hints.some((item) => item.kind === 'slash-command') && report.invocation_hints.some((item) => item.kind === 'source-entrypoint')],
  ['fixture paths skipped from invocation hints', report.invocation_hints.every((item) => !String(item.path || '').startsWith('fixtures/'))],
  ['config hints reported', report.config_hints.some((item) => item.kind === 'vite-config')],
  ['markdown includes boundary', markdown.includes('Invocation hints are advisory static evidence')],
  ['write mode writes local artifacts', fs.existsSync(written.artifacts.markdown) && fs.existsSync(written.artifacts.json) && JSON.parse(fs.readFileSync(written.artifacts.json, 'utf8')).schema_version === '1'],
  ['malformed topology attention', malformedReport.status === 'attention' && malformedReport.invalid_artifacts.length === 1],
  ['symlink topology attention', symlinkReport.status === 'attention' && /symlink/i.test(symlinkReport.invalid_artifacts[0].reason)],
  ['symlink project refused', throws(() => renderInvocationHints({ root: symlinkProjectRoot, projectDir: linkedProject }), /symlinked project directory/)],
  ['parses args', opts.root === base.root && opts.projectDir === base.projectDir && opts.write && opts.json],
  ['topology helper detects changed app entrypoint', topologyHints.length === 1 && topologyHints[0].changed],
  ['config helper detects common configs', configs.length === 2],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('invocation hints: ok');
