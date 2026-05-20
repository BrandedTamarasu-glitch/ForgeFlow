#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
const { classify } = require('./explain-review-route');
const { readFiles } = require('./explain-review-route');

const repoRoot = path.resolve(__dirname, '..', '..');

const cases = [
  {
    name: 'docs-only',
    files: 'fixtures/review-route/docs-only.files',
    lines: '20',
    mode: 'skip-mode',
    verifier: 'not-required',
  },
  {
    name: 'auth',
    files: 'fixtures/review-route/auth.files',
    lines: '80',
    mode: 'deep-mode',
    verifier: 'required',
  },
  {
    name: 'frontend',
    files: 'fixtures/review-route/frontend.files',
    lines: '120',
    mode: 'full-mode',
    verifier: 'not-required',
    includes: 'lumen_reviewer',
  },
  {
    name: 'frontend-calibration-noisy',
    files: 'fixtures/review-route/frontend.files',
    calibration: 'fixtures/review-route/calibration-summary.json',
    lines: '120',
    mode: 'full-mode',
    verifier: 'required',
    includes: 'aegis',
    hintType: 'noisy-class',
  },
  {
    name: 'service-boundary-calibration',
    files: 'fixtures/review-route/service-boundary.files',
    calibration: 'fixtures/review-route/calibration-summary.json',
    lines: '30',
    mode: 'thin-mode',
    verifier: 'not-required',
    includes: 'lumen_reviewer',
    hintType: 'high-value-class',
  },
  {
    name: 'low-history-calibration',
    files: 'fixtures/review-route/migration-low-history.files',
    calibration: 'fixtures/review-route/calibration-summary.json',
    lines: '30',
    mode: 'deep-mode',
    verifier: 'required',
    hintType: 'insufficient-history',
  },
  {
    name: 'tests',
    files: 'fixtures/review-route/tests.files',
    lines: '100',
    mode: 'thin-mode',
    verifier: 'not-required',
  },
];

let failed = 0;

for (const testCase of cases) {
  const files = fs.readFileSync(path.join(repoRoot, testCase.files), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const route = classify(files, {
    linesChanged: Number.parseInt(testCase.lines, 10),
    filesPath: testCase.files,
    modeOverride: '',
    ci: false,
    calibration: testCase.calibration
      ? JSON.parse(fs.readFileSync(path.join(repoRoot, testCase.calibration), 'utf8'))
      : null,
  });
  const errors = [];
  if (route.mode !== testCase.mode) {
    errors.push(`mode ${route.mode} !== ${testCase.mode}`);
  }
  if (route.verifier !== testCase.verifier) {
    errors.push(`verifier ${route.verifier} !== ${testCase.verifier}`);
  }
  if (testCase.includes && !route.agents.included.includes(testCase.includes)) {
    errors.push(`missing included agent ${testCase.includes}`);
  }
  if (testCase.hintType && !route.telemetry_hints.some((hint) => hint.type === testCase.hintType)) {
    errors.push(`missing telemetry hint ${testCase.hintType}`);
  }

  if (errors.length) {
    failed += 1;
    console.error(`${testCase.name}: ${errors.join('; ')}`);
  } else {
    console.log(`${testCase.name}: ok`);
  }
}

const noisyFiles = readFiles({ filesPath: path.join(repoRoot, 'fixtures/review-route/noisy.files') });
const noisyExpected = [
  'commands/review.md',
  'commands/update-forgeflow.md',
  'scripts/forgeflow/explain-review-route.js',
];
const noisyErrors = [];
for (const expected of noisyExpected) {
  if (!noisyFiles.includes(expected)) noisyErrors.push(`missing ${expected}`);
}
for (const forbidden of ['--- Changes ---', 'README.md | 12 +++++', '2 files changed, 10 insertions(+), 2 deletions(-)', '@@ -1,2 +1,3 @@']) {
  if (noisyFiles.includes(forbidden)) noisyErrors.push(`kept noisy line ${forbidden}`);
}
if (noisyFiles.length !== noisyExpected.length) {
  noisyErrors.push(`expected ${noisyExpected.length} sanitized files, got ${noisyFiles.length}: ${noisyFiles.join(', ')}`);
}
if (noisyErrors.length) {
  failed += 1;
  console.error(`noisy-file-list: ${noisyErrors.join('; ')}`);
} else {
  console.log('noisy-file-list: ok');
}

const untrackedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-review-route-untracked-'));
spawnSync('git', ['init'], { cwd: untrackedRoot, encoding: 'utf8' });
fs.writeFileSync(path.join(untrackedRoot, 'helper.js'), Array.from({ length: 60 }, (_, index) => `const line${index} = ${index};`).join('\n'));
const untrackedCli = spawnSync(path.join(repoRoot, 'scripts/forgeflow/explain-review-route.js'), ['--json'], {
  cwd: untrackedRoot,
  encoding: 'utf8',
});
const untrackedRoute = untrackedCli.status === 0 ? JSON.parse(untrackedCli.stdout) : {};
if (untrackedRoute.lines_changed !== 60 || untrackedRoute.mode !== 'full-mode') {
  failed += 1;
  console.error(`untracked-line-count: expected 60 lines and full-mode, got ${untrackedRoute.lines_changed}/${untrackedRoute.mode || 'no-mode'}`);
} else {
  console.log('untracked-line-count: ok');
}

if (failed > 0) {
  process.exit(1);
}
