#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildLeanDemoReport,
  parseArgs,
  renderMarkdown,
  reportFiles,
} = require('./render-lean-demo-report');

function copyDir(source, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

const root = path.resolve(__dirname, '..', '..');
const result = buildLeanDemoReport({ root });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--write', '--json']);

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-demo-report-'));
for (const dir of ['scripts', 'commands', 'docs', 'pi-extension', '.opencode', 'skills', '.claude-plugin', '.codex-plugin', '.github', 'hooks', '.cursor', '.windsurf', '.clinerules', '.kiro', '.openclaw']) {
  const source = path.join(root, dir);
  if (fs.existsSync(source)) copyDir(source, path.join(tmpRoot, dir));
}
for (const file of ['AGENTS.md', 'gemini-extension.json']) {
  const source = path.join(root, file);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(tmpRoot, file));
}
const written = buildLeanDemoReport({ root: tmpRoot, write: true });
const files = reportFiles(tmpRoot);

const checks = [
  ['builds report sections', result.sections.length === 5 && result.summary.sections === 5],
  ['includes benchmark and host summaries', result.summary.benchmark_tasks > 0 && result.summary.host_adapters > 0],
  ['renders markdown', markdown.includes('# Forgeflow Lean Demo Report') && markdown.includes('## Sections')],
  ['writes artifacts', written.artifacts && fs.existsSync(files.json) && fs.existsSync(files.markdown)],
  ['parses args', opts.root === root && opts.write && opts.json],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
fs.rmSync(tmpRoot, { recursive: true, force: true });
if (failed > 0) process.exit(1);
console.log('lean demo report: ok');
