#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const mode = process.argv[2] || '--all';
if (!['--all', '--helpers', '--services'].includes(mode) || process.argv.length > 3) {
  console.error('Usage: node scripts/run-tests.js [--helpers|--services]');
  process.exit(2);
}

const config = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-test-config-'));
const env = {
  ...process.env,
  FORGEFLOW_CONFIG_HOME: config,
  GIT_AUTHOR_NAME: 'Forgeflow Test',
  GIT_AUTHOR_EMAIL: 'forgeflow-test@example.invalid',
  GIT_COMMITTER_NAME: 'Forgeflow Test',
  GIT_COMMITTER_EMAIL: 'forgeflow-test@example.invalid',
};
const checks = [];
if (mode !== '--services') {
  for (const file of fs.readdirSync(path.join(root, 'scripts/forgeflow')).sort()) {
    if (/^test-.*\.js$/.test(file)) checks.push([`scripts/forgeflow/${file}`]);
  }
}
if (mode !== '--helpers') {
  for (const service of fs.readdirSync(path.join(root, 'services')).sort()) {
    const tests = path.join(root, 'services', service, '__tests__');
    if (!fs.existsSync(tests)) continue;
    const files = fs.readdirSync(tests).filter(file => /\.test\.(js|ts)$/.test(file)).sort();
    if (files.length) checks.push(['--import', 'tsx', '--test', ...files.map(file => path.join(tests, file))]);
  }
  checks.push(['--test', 'pi-extension/test/extension.test.js']);
  checks.push(['node_modules/typescript/bin/tsc', '-p', 'services/chat-bridge/tsconfig.json', '--noEmit']);
}

let failed = 0;
try {
  // Helpers may seed local artifact fixtures; keep them sequential.
  for (const args of checks) {
    const label = args.join(' ').replaceAll(`${root}${path.sep}`, '');
    const result = spawnSync(process.execPath, args, {
      cwd: root, env, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024,
    });
    if (result.status !== 0 || result.error) {
      failed += 1;
      console.error(`FAIL ${label}\n${result.stdout || ''}${result.stderr || ''}${result.error?.message || ''}`);
    } else {
      console.log(`PASS ${label}`);
    }
  }
} finally {
  fs.rmSync(config, { recursive: true, force: true });
}
console.log(`${checks.length - failed}/${checks.length} test commands passed`);
process.exitCode = failed ? 1 : 0;
