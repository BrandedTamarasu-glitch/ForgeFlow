#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildRuntimeDriftSnapshot, parseArgs, renderMarkdown } = require('./runtime-drift-snapshot');
const { RUNTIME_HELPERS, manifestEntry } = require('./install-manifest');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-runtime-drift-root-'));
const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-runtime-drift-install-'));
for (const source of RUNTIME_HELPERS) {
  const sourcePath = path.join(root, source);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, source.endsWith('.sh') ? '#!/usr/bin/env bash\ntrue\n' : 'module.exports = {};\n');
  fs.chmodSync(sourcePath, source.endsWith('.sh') ? 0o755 : 0o644);
  const entry = manifestEntry(source, installRoot);
  fs.mkdirSync(path.dirname(entry.destination), { recursive: true });
  fs.copyFileSync(sourcePath, entry.destination);
  fs.chmodSync(entry.destination, source.endsWith('.sh') ? 0o755 : 0o644);
}
const changedSource = RUNTIME_HELPERS.find((source) => source.endsWith('.js'));
fs.writeFileSync(manifestEntry(changedSource, installRoot).destination, 'function broken syntax\n');
const missingSource = RUNTIME_HELPERS.find((source) => source.endsWith('.sh'));
fs.unlinkSync(manifestEntry(missingSource, installRoot).destination);

const result = buildRuntimeDriftSnapshot({ root, installRoot, previewRepair: true });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--install-root', installRoot, '--preview-repair', '--json']);

const modeOnlyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-runtime-drift-mode-root-'));
const modeOnlyInstall = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-runtime-drift-mode-install-'));
for (const source of RUNTIME_HELPERS) {
  const sourcePath = path.join(modeOnlyRoot, source);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, source.endsWith('.sh') ? '#!/usr/bin/env bash\ntrue\n' : 'module.exports = {};\n');
  fs.chmodSync(sourcePath, source.endsWith('.sh') ? 0o755 : 0o644);
  const entry = manifestEntry(source, modeOnlyInstall);
  fs.mkdirSync(path.dirname(entry.destination), { recursive: true });
  fs.copyFileSync(sourcePath, entry.destination);
  fs.chmodSync(entry.destination, 0o755);
}
const modeOnly = buildRuntimeDriftSnapshot({ root: modeOnlyRoot, installRoot: modeOnlyInstall, previewRepair: true });

const checks = [
  ['detects drift', result.status === 'attention' && result.drift_count >= 2],
  ['counts missing and syntax', result.missing_installed === 1 && result.syntax_failures === 1],
  ['groups drifted helpers', result.drift_groups.length > 0 && result.drift_groups.some((item) => item.count > 0) && result.helpers.every((helper) => helper.helper_group)],
  ['mode-only drift is informational', modeOnly.status === 'info' && modeOnly.actionable_drift === 0 && modeOnly.mode_only_drift > 0],
  ['recommends repair', result.recommendations.some((item) => item.action === '/update-forgeflow --repair')],
  ['repair preview read-only', result.repair_preview.status === 'would-repair' && result.repair_preview.items.length >= 2 && result.repair_preview.boundary.includes('read-only')],
  ['renders markdown', markdown.includes('# Forgeflow Runtime Drift') && markdown.includes('read-only') && markdown.includes('Drift groups:') && markdown.includes('Drifted Helpers') && markdown.includes('## Repair Preview')],
  ['parse args', opts.root === root && opts.installRoot === installRoot && opts.previewRepair === true && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('runtime drift snapshot: ok');
