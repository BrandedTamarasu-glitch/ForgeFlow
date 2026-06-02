#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildFirstRunSimulator, parseArgs, pluginVersion, renderMarkdown, semverLike } = require('./render-first-run-simulator');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-first-run-simulator-'));
fs.mkdirSync(path.join(root, '.codex-plugin'), { recursive: true });
fs.writeFileSync(path.join(root, '.codex-plugin', 'plugin.json'), JSON.stringify({ version: '4.3.43' }));
const claudeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-first-run-simulator-claude-'));
fs.mkdirSync(path.join(claudeRoot, '.claude-plugin'), { recursive: true });
fs.writeFileSync(path.join(claudeRoot, '.claude-plugin', 'plugin.json'), JSON.stringify({ version: '4.3.44' }));
const result = buildFirstRunSimulator({
  root,
  runtime: 'codex',
  smoke: { status: 'pass', mode: 'source', checks: [{ name: 'health', status: 'pass' }] },
});
const missingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-first-run-simulator-missing-'));
const missing = buildFirstRunSimulator({
  root: missingRoot,
  skipSmoke: true,
  smoke: { status: 'skip', mode: 'source', checks: [] },
});
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', '.', '--project-dir', '.forgeflow/Forgeflow', '--runtime', 'codex', '--skip-smoke', '--json']);

const checks = [
  ['builds ready simulator', result.schema_version === '1' && result.status === 'ready'],
  ['reads plugin version', result.version === '4.3.43' && pluginVersion(root) === '4.3.43'],
  ['reads claude plugin version', pluginVersion(claudeRoot) === '4.3.44'],
  ['uses codex first-use path', result.first_use_path.runtime === 'codex' && result.first_use_path.steps[0].command.includes('health-check.js')],
  ['includes smoke summary', result.smoke_summary.status === 'pass' && result.smoke_summary.checks === 1],
  ['missing version needs attention', missing.status === 'attention' && missing.checks.some((item) => item.name === 'release-version' && item.status === 'attention')],
  ['skip smoke is informational', missing.checks.some((item) => item.name === 'source-smoke' && item.status === 'info')],
  ['semver helper stable', semverLike('1.2.3') && semverLike('1.2.3-beta.1') && !semverLike('latest')],
  ['renders markdown', markdown.includes('# Forgeflow First-Run Simulator') && markdown.includes('## First-Use Path') && markdown.includes('source-smoke: pass')],
  ['parses args', opts.root === path.resolve('.') && opts.projectDir === path.resolve('.forgeflow/Forgeflow') && opts.runtime === 'codex' && opts.skipSmoke === true && opts.json === true],
  ['read-only boundary', result.boundary.includes('read-only') && result.boundary.includes('without installing')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('first-run simulator: ok');
