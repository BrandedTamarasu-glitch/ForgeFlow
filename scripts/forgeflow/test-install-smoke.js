#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  isManagedSource,
  manifestEntry,
} = require('./install-manifest');

const repoRoot = path.resolve(__dirname, '..', '..');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-install-home-'));
const plugin = JSON.parse(fs.readFileSync(path.join(repoRoot, '.claude-plugin/plugin.json'), 'utf8'));

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, files);
    else if (entry.isFile()) files.push(path.relative(repoRoot, file).replace(/\\/g, '/'));
  }
  return files;
}

function copyManaged(source) {
  const entry = manifestEntry(source, home);
  if (!entry || entry.preserve) return null;
  const from = path.join(repoRoot, source);
  const to = entry.destination;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  if (entry.executable) fs.chmodSync(to, 0o755);
  return entry;
}

const runtimeSources = walk(path.join(repoRoot, 'scripts', 'forgeflow'))
  .filter(isManagedSource)
  .sort();
const copiedRuntime = runtimeSources.map(copyManaged).filter(Boolean);

const customDest = path.join(home, 'agents', 'custom-local.md');
fs.mkdirSync(path.dirname(customDest), { recursive: true });
fs.writeFileSync(customDest, 'custom agent\n');
const customEntry = manifestEntry('agents/custom-local.md', home);
if (customEntry && !customEntry.preserve) {
  fs.copyFileSync(path.join(repoRoot, 'agents', 'smith-review.md'), customDest);
}

const checks = [
  ['plugin maps js helpers', plugin.install.destinations['scripts/forgeflow/*.js'] === '~/.claude/forgeflow/scripts/forgeflow/'],
  ['plugin maps sh helpers', plugin.install.destinations['scripts/forgeflow/*.sh'] === '~/.claude/forgeflow/scripts/forgeflow/'],
  ['plugin excludes tests', (plugin.install.exclude || []).includes('scripts/forgeflow/test-*')],
  ['runtime helpers copied', copiedRuntime.length > 0],
  ['health helper installed', fs.existsSync(path.join(home, 'forgeflow', 'scripts', 'forgeflow', 'health-check.js'))],
  ['test helper excluded', !fs.existsSync(path.join(home, 'forgeflow', 'scripts', 'forgeflow', 'test-health-check.js'))],
  ['shell helper executable', (fs.statSync(path.join(home, 'forgeflow', 'scripts', 'forgeflow', 'ensure-forgeflow-state.sh')).mode & 0o111) !== 0],
  ['js helper executable', (fs.statSync(path.join(home, 'forgeflow', 'scripts', 'forgeflow', 'health-check.js')).mode & 0o111) !== 0],
  ['custom agent preserved', fs.readFileSync(customDest, 'utf8') === 'custom agent\n'],
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

console.log('install smoke: ok');
