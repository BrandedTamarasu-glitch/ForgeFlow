#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  updateForgeflow,
  versionPath,
} = require('./update-forgeflow');

const repoRoot = path.resolve(__dirname, '..', '..');
const latest = '1111111111111111111111111111111111111111';
const previous = '0000000000000000000000000000000000000000';

async function localFetcher(_repo, _sha, source) {
  return fs.readFileSync(path.join(repoRoot, source), 'utf8');
}

async function failingFetcher(_repo, _sha, source) {
  if (source.endsWith('health-check.js')) throw new Error('simulated fetch failure');
  return localFetcher(_repo, _sha, source);
}

async function run() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-update-home-'));
  const first = await updateForgeflow({
    home,
    repo: 'local/repo',
    current: '',
    latest,
    plan: {
      firstRun: true,
      files: [
        'commands/review.md',
        'scripts/forgeflow/health-check.js',
        'scripts/forgeflow/test-health-check.js',
      ],
      deleted: [],
    },
    fetcher: localFetcher,
  });

  fs.mkdirSync(path.join(home, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(home, 'agents', 'custom-local.md'), 'custom\n');
  const partialHome = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-update-partial-'));
  fs.writeFileSync(versionPath(partialHome), `${previous}\n`);
  const partial = await updateForgeflow({
    home: partialHome,
    repo: 'local/repo',
    current: previous,
    latest,
    plan: {
      firstRun: false,
      files: ['scripts/forgeflow/health-check.js'],
      deleted: ['commands/old.md'],
    },
    fetcher: failingFetcher,
  });

  const upToDate = await updateForgeflow({
    home,
    repo: 'local/repo',
    current: latest,
    latest,
    plan: { firstRun: false, files: [], deleted: [] },
    fetcher: localFetcher,
  });

  const checks = [
    ['first updated', first.status === 'updated'],
    ['version written', fs.readFileSync(versionPath(home), 'utf8').trim() === latest],
    ['command installed', fs.existsSync(path.join(home, 'commands', 'review.md'))],
    ['runtime helper installed', fs.existsSync(path.join(home, 'forgeflow', 'scripts', 'forgeflow', 'health-check.js'))],
    ['test helper skipped by manifest', !fs.existsSync(path.join(home, 'forgeflow', 'scripts', 'forgeflow', 'test-health-check.js'))],
    ['runtime helper executable', (fs.statSync(path.join(home, 'forgeflow', 'scripts', 'forgeflow', 'health-check.js')).mode & 0o111) !== 0],
    ['partial status', partial.status === 'partial'],
    ['partial version not advanced', fs.readFileSync(versionPath(partialHome), 'utf8').trim() === previous],
    ['partial deleted reported', partial.deleted.includes('commands/old.md')],
    ['up to date', upToDate.status === 'up-to-date'],
  ];

  let failed = 0;
  for (const [name, ok] of checks) {
    if (!ok) {
      failed += 1;
      console.error(`FAIL ${name}`);
    }
  }
  if (failed > 0) process.exit(1);
  console.log('update forgeflow: ok');
}

run().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
