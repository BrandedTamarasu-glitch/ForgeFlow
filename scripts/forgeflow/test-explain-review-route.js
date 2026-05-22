#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
const { classify, parseArgs, readFiles } = require('./explain-review-route');

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
const outsideSecret = path.join(os.tmpdir(), `forgeflow-review-route-secret-${process.pid}.txt`);
fs.writeFileSync(outsideSecret, Array.from({ length: 500 }, (_, index) => `secret${index}`).join('\n'));
try {
  fs.symlinkSync(outsideSecret, path.join(untrackedRoot, 'secret-link.js'));
} catch {
  // Symlink creation may be unavailable on some platforms; the non-symlink path is still covered.
}
const previousCwd = process.cwd();
process.chdir(untrackedRoot);
let untrackedRoute = {};
try {
  const untrackedOpts = parseArgs(['--json']);
  untrackedRoute = classify(readFiles(untrackedOpts), untrackedOpts);
} finally {
  process.chdir(previousCwd);
}
if (untrackedRoute.lines_changed !== 60 || untrackedRoute.mode !== 'full-mode') {
  failed += 1;
  console.error(`untracked-line-count: expected 60 lines and full-mode, got ${untrackedRoute.lines_changed}/${untrackedRoute.mode || 'no-mode'}`);
} else if (untrackedRoute.tracked_lines !== 0 || untrackedRoute.untracked_lines !== 60) {
  failed += 1;
  console.error(`untracked-line-sources: expected tracked/untracked 0/60, got ${untrackedRoute.tracked_lines}/${untrackedRoute.untracked_lines}`);
} else {
  console.log('untracked-line-count: ok');
}

fs.writeFileSync(path.join(untrackedRoot, 'changed.files'), 'helper.js\nsecret-link.js\n');
const unrelatedCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-review-route-unrelated-cwd-'));
process.chdir(unrelatedCwd);
let explicitRootRoute = {};
try {
  const explicitRootOpts = parseArgs([
  '--json',
  '--root',
  untrackedRoot,
  '--files',
  'changed.files',
  '--lines',
  '75',
  '--tracked-lines',
  '15',
  '--untracked-lines',
  '60',
  ]);
  explicitRootRoute = classify(readFiles(explicitRootOpts), explicitRootOpts);
} finally {
  process.chdir(previousCwd);
}
if (explicitRootRoute.lines_changed !== 75
  || explicitRootRoute.tracked_lines !== 15
  || explicitRootRoute.untracked_lines !== 60
  || !explicitRootRoute.files.includes('helper.js')) {
  failed += 1;
  console.error('explicit-root-cli: expected root-relative files and line sources');
} else {
  console.log('explicit-root-cli: ok');
}

const explicitSourceRoute = classify(['helper.js'], {
  linesChanged: 75,
  trackedLines: 15,
  untrackedLines: 60,
  filesPath: 'changed-files.txt',
  modeOverride: '',
  ci: false,
  calibration: null,
});
if (explicitSourceRoute.lines_changed !== 75
  || explicitSourceRoute.tracked_lines !== 15
  || explicitSourceRoute.untracked_lines !== 60) {
  failed += 1;
  console.error('explicit-line-sources: expected lines_changed/tracked_lines/untracked_lines 75/15/60');
} else {
  console.log('explicit-line-sources: ok');
}

if (failed > 0) {
  process.exit(1);
}
