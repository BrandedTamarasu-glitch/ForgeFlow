#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildLeanDebt,
  hasUpgradeLanguage,
  markerRows,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-debt');

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function writeJson(file, value) {
  write(file, `${JSON.stringify(value, null, 2)}\n`);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-debt-'));
const projectDir = path.join(root, '.forgeflow', 'Demo');
write(path.join(root, 'src', 'a.js'), [
  '// forgeflow: lean: small parser until multi-format input is requested',
  'const value = 1;',
  '// forgeflow: no-new-deps',
  '// forgeflow: upgrade when: user asks for timezone support',
  '',
].join('\n'));
write(path.join(root, 'node_modules', 'skip.js'), '// forgeflow: lean: ignored\n');
writeJson(path.join(projectDir, 'context', 'lean-decision.json'), {
  implementation_note_candidate: {
    note: 'Lean path selected. Known ceiling: linear scan.',
    why: 'Upgrade trigger: list grows beyond 1000 rows.',
  },
});
write(path.join(projectDir, 'implementation-notes.md'), '- 2026-06-15 | Atlas | tradeoff | Lean path selected. Known ceiling: in-memory lookup. Upgrade trigger: shared cache needed.\n');

const result = buildLeanDebt({ root, projectDir });
const markdown = renderMarkdown(result);
const written = buildLeanDebt({ root, projectDir, write: true });
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--write', '--json']);
const rows = markerRows([{ source: 'x.js', line: 1, kind: 'lean', detail: '', valid: false, issue: 'marker-missing-detail' }]);

let symlinkRejected = false;
const linkedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-debt-link-'));
const linkedProject = path.join(linkedRoot, '.forgeflow', 'Demo');
fs.mkdirSync(path.dirname(linkedProject), { recursive: true });
fs.symlinkSync(root, linkedProject);
try {
  buildLeanDebt({ root: linkedRoot, projectDir: linkedProject });
} catch (_err) {
  symlinkRejected = true;
}

const checks = [
  ['finds marker rows', result.markers.count === 3 && result.by_source_type.marker === 3],
  ['ignores vendor dirs', !result.rows.some((row) => row.file.includes('node_modules'))],
  ['flags missing trigger', result.no_trigger_count === 1 && result.rows.some((row) => row.issue === 'missing-upgrade-trigger')],
  ['captures lean decision and notes', result.by_source_type['lean-decision'] === 1 && result.by_source_type['implementation-notes'] === 1],
  ['renders markdown ledger', markdown.includes('# Forgeflow Lean Debt') && markdown.includes('Missing upgrade trigger: 1')],
  ['writes artifacts under context', fs.existsSync(path.join(projectDir, 'context', 'lean-debt.md')) && fs.existsSync(path.join(projectDir, 'context', 'lean-debt.json')) && written.artifacts.json.endsWith('lean-debt.json')],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.write && opts.json],
  ['detects upgrade language', hasUpgradeLanguage('upgrade when throughput matters')],
  ['invalid marker row is no-trigger', rows[0].risk === 'no-trigger'],
  ['symlink project rejected', symlinkRejected],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error(`FAIL: ${name}`);
  process.exit(1);
}

console.log('lean debt: ok');
