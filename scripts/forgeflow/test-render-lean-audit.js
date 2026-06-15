#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildLeanAudit,
  packageFindings,
  parseArgs,
  renderMarkdown,
  textFindings,
} = require('./render-lean-audit');

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function writeJson(file, value) {
  write(file, `${JSON.stringify(value, null, 2)}\n`);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-audit-'));
const projectDir = path.join(root, '.forgeflow', 'Demo');
writeJson(path.join(root, 'package.json'), { dependencies: { moment: '^2.0.0' } });
write(path.join(root, 'src', 'factory.js'), [
  'class AbstractThing {}',
  'function runWrapper() { return runThing(); }',
  '// forgeflow: lean: simple path',
  '',
].join('\n'));
write(path.join(root, 'src', 'auth.js'), 'function authToken() { return "secret"; }\nclass AbstractAuth {}\n');
write(path.join(root, 'node_modules', 'ignored.js'), 'class AbstractIgnored {}\n');
writeJson(path.join(projectDir, 'context', 'code-topology.json'), {
  nodes: [{ path: 'src/factory.js', fan_in: 1, fan_out: 0 }],
});

const result = buildLeanAudit({ root, projectDir });
const markdown = renderMarkdown(result);
const written = buildLeanAudit({ root, projectDir, write: true });
const pkg = packageFindings(root);
const text = textFindings(root, { topology: { nodes: [{ path: 'src/factory.js', fan_in: 1, fan_out: 0 }] }, invocation: {} });
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--write', '--json']);

let symlinkRejected = false;
const linkedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-audit-link-'));
const linkedProject = path.join(linkedRoot, '.forgeflow', 'Demo');
fs.mkdirSync(path.dirname(linkedProject), { recursive: true });
fs.symlinkSync(root, linkedProject);
try {
  buildLeanAudit({ root: linkedRoot, projectDir: linkedProject });
} catch (_err) {
  symlinkRejected = true;
}

const classes = result.findings.map((item) => item.class);
const checks = [
  ['finds package native candidate', pkg.some((item) => item.file === 'package.json' && item.class === 'native')],
  ['finds abstraction candidate', classes.includes('yagni') && result.findings.some((item) => item.file === 'src/factory.js' && item.title.includes('Abstraction'))],
  ['finds wrapper candidate', classes.includes('delete') && text.findings.some((item) => item.title.includes('Wrapper'))],
  ['integrates lean debt', classes.includes('marker-debt') && result.findings.some((item) => item.replacement.includes('upgrade trigger'))],
  ['skips hard-boundary files', result.skipped.some((item) => item.file === 'src/auth.js' && item.reasons.includes('hard-boundary-scope'))],
  ['ignores vendor dirs', !result.findings.some((item) => item.file.includes('node_modules'))],
  ['ranks with scores', result.findings.every((item) => typeof item.score === 'number') && result.findings[0].score >= result.findings[result.findings.length - 1].score],
  ['renders markdown', markdown.includes('# Forgeflow Lean Audit') && markdown.includes('Estimated net-line reduction')],
  ['writes artifacts', fs.existsSync(path.join(projectDir, 'context', 'lean-audit.md')) && fs.existsSync(path.join(projectDir, 'context', 'lean-audit.json')) && written.write_artifacts.json.endsWith('lean-audit.json')],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.write && opts.json],
  ['symlink project rejected', symlinkRejected],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error(`FAIL: ${name}`);
  process.exit(1);
}

console.log('lean audit: ok');
