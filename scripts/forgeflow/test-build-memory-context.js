#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildMemoryContext } = require('./build-memory-context');

const repoRoot = path.resolve(__dirname, '..', '..');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-memory-context-'));
const out = path.join(tmpDir, 'memory-context.md');
const telemetryOut = path.join(tmpDir, 'memory-context-telemetry.json');
const result = buildMemoryContext({
  projectDir: path.join(repoRoot, 'fixtures/memory-index'),
  query: 'plan auth session token review',
  out,
  indexOut: path.join(tmpDir, 'memory-index.json'),
  telemetryOut,
  maxHits: 8,
  maxChars: 4000,
});
const symlinkOutProject = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-memory-context-symlink-'));
fs.writeFileSync(path.join(symlinkOutProject, 'project-learnings.md'), '# Project Learnings\n\n- safe session note\n');
const outsideContext = path.join(symlinkOutProject, 'outside-context.md');
const symlinkContext = path.join(symlinkOutProject, 'context', 'memory-context.md');
fs.mkdirSync(path.dirname(symlinkContext), { recursive: true });
fs.writeFileSync(outsideContext, 'do not overwrite\n');
let symlinkContextBlocked = true;
try {
  fs.symlinkSync(outsideContext, symlinkContext);
  buildMemoryContext({
    projectDir: symlinkOutProject,
    query: 'session',
    out: symlinkContext,
    indexOut: path.join(symlinkOutProject, 'index', 'memory-index.json'),
    telemetryOut: path.join(symlinkOutProject, 'context', 'memory-context-telemetry.json'),
  });
  symlinkContextBlocked = false;
} catch (err) {
  symlinkContextBlocked = err.message.includes('symlinked file');
}

const content = fs.readFileSync(out, 'utf8');
const telemetry = JSON.parse(fs.readFileSync(telemetryOut, 'utf8'));
const checks = [
  ['result path', result.out === out],
  ['context written', fs.existsSync(out)],
  ['telemetry written', fs.existsSync(telemetryOut)],
  ['telemetry path returned', result.telemetry_path === telemetryOut],
  ['sources counted', result.sources === 5],
  ['hits selected', result.selected_count > 0],
  ['index path included', content.includes('Index:')],
  ['session hit included', content.includes('Session token reviews')],
  ['implementation notes hit included', content.includes('retry validation')],
  ['project learnings hit included', content.includes('session-token-refresh')],
  ['plan heading included', content.includes('Review Context Plan')],
  ['telemetry kind', telemetry.kind === 'memory-context'],
  ['telemetry estimates tokens', Number.isInteger(telemetry.estimated_compact_tokens)],
  ['symlink context destination blocked', symlinkContextBlocked && fs.readFileSync(outsideContext, 'utf8') === 'do not overwrite\n'],
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

console.log('memory context: ok');
