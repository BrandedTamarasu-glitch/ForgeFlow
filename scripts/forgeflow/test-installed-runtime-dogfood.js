#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { isManagedSource, manifestEntry } = require('./install-manifest');

const repoRoot = path.resolve(__dirname, '..', '..');
const installHome = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-installed-runtime-home-'));
const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-installed-runtime-project-'));
const callerCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-installed-runtime-caller-'));

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
  const entry = manifestEntry(source, installHome);
  if (!entry || entry.preserve) return null;
  const from = path.join(repoRoot, source);
  const to = entry.destination;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  if (entry.executable) fs.chmodSync(to, 0o755);
  return entry;
}

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

const runtimeEntries = walk(repoRoot)
  .filter(isManagedSource)
  .map(copyManaged)
  .filter(Boolean);
const installedHelperDir = path.join(installHome, 'forgeflow', 'scripts', 'forgeflow');
const installedSmokePath = path.join(installedHelperDir, 'smoke-check.js');
const installedHealthPath = path.join(installedHelperDir, 'health-check.js');
const installedProfileReviewPath = path.join(installedHelperDir, 'render-profile-review.js');
const installedFirstRunResultPath = path.join(installedHelperDir, 'record-first-run-result.js');
const installedFirstRunRollupPath = path.join(installedHelperDir, 'rollup-first-run-results.js');
const installedNextWorkOutcomePath = path.join(installedHelperDir, 'record-next-work-outcome.js');
const installedLearningStatusPath = path.join(installedHelperDir, 'show-learning-status.js');
const installedReleaseVerifyPath = path.join(installedHelperDir, 'render-release-verify.js');

git(projectRoot, ['init']);
git(projectRoot, ['config', 'user.email', 'forgeflow@example.invalid']);
git(projectRoot, ['config', 'user.name', 'Forgeflow Test']);
write(path.join(projectRoot, 'README.md'), '# Installed Runtime Dogfood\n');
write(path.join(projectRoot, 'src/shared.ts'), 'export const value = 1;\n');
git(projectRoot, ['add', 'README.md', 'src/shared.ts']);
git(projectRoot, ['commit', '-m', 'init']);
write(path.join(projectRoot, 'src/shared.ts'), 'export const value = 2;\n');

const installedHealth = require(installedHealthPath);
const installedSmoke = require(installedSmokePath);
const installedProfileReview = require(installedProfileReviewPath);
const installedFirstRunResult = require(installedFirstRunResultPath);
const installedFirstRunRollup = require(installedFirstRunRollupPath);
const installedNextWorkOutcome = require(installedNextWorkOutcomePath);
const installedLearningStatus = require(installedLearningStatusPath);
const installedReleaseVerify = require(installedReleaseVerifyPath);
const projectDir = path.join(projectRoot, '.forgeflow', path.basename(projectRoot));
const patternsDir = path.join(projectRoot, 'forgeflow-patterns');

installedHealth.runHealthCheck({ root: projectRoot, fix: true });
installedFirstRunResult.recordFirstRunResult({
  projectDir,
  runtime: 'codex',
  health: 'pass',
  smoke: 'pass',
  profile: 'pass',
  decision: 'continue',
  friction: 'docs',
  notes: 'Needed docs clarification.',
});
const firstRunRollup = installedFirstRunRollup.rollupFirstRunResults({ projectDir });
installedNextWorkOutcome.recordNextWorkOutcome({
  projectDir,
  title: 'Review profile guidance before implementation',
  source: 'user-profile',
  outcome: 'useful',
  summary: 'Helped scope agent prompts.',
  confidence: 'high',
});
const nextWorkOutcomes = installedNextWorkOutcome.readNextWorkOutcomes(projectDir);
const learningStatus = installedLearningStatus.buildLearningStatus({ root: projectRoot, projectDir });
const profileReview = installedProfileReview.buildProfileReview({ projectDir, home: installHome });
const releaseVerify = installedReleaseVerify.buildReleaseVerify({ root: projectRoot, runner: () => ({ status: 0, stdout: '', stderr: '' }) });
const previousCwd = process.cwd();
process.chdir(callerCwd);
let smoke = null;
try {
  smoke = installedSmoke.smokeCheck({
    root: projectRoot,
    projectDir,
    patternsDir,
    mode: 'downstream',
  });
} finally {
  process.chdir(previousCwd);
}

const checks = [
  ['runtime helpers copied', runtimeEntries.length > 0 && fs.existsSync(installedSmokePath) && fs.existsSync(installedHealthPath)],
  ['new installed helpers copied', [installedProfileReviewPath, installedFirstRunResultPath, installedFirstRunRollupPath, installedNextWorkOutcomePath, installedLearningStatusPath, installedReleaseVerifyPath].every((file) => fs.existsSync(file))],
  ['installed tree excludes source tests', ['test-smoke-check.js', 'test-dogfood-self-test.js', 'test-installed-runtime-dogfood.js'].every((file) => !fs.existsSync(path.join(installedHelperDir, file)))],
  ['installed smoke runs from unrelated cwd', smoke && process.cwd() === previousCwd],
  ['installed downstream smoke passes', smoke && ['pass', 'warn'].includes(smoke.status)],
  ['installed downstream checks core path', smoke && ['health', 'trends-refresh', 'report-refresh', 'code-map'].every((name) => smoke.checks.some((item) => item.name === name))],
  ['installed downstream excludes source tests', smoke && !smoke.checks.some((item) => ['doc-links', 'dogfood-self-test', 'installed-runtime-dogfood'].includes(item.name))],
  ['installed profile review runs', profileReview && profileReview.schema_version === '1' && profileReview.boundary.includes('advisory')],
  ['installed first-run rollup runs', firstRunRollup && firstRunRollup.records === 1 && firstRunRollup.recommendation],
  ['installed next-work outcome runs', nextWorkOutcomes && nextWorkOutcomes.records === 1 && nextWorkOutcomes.by_outcome.useful === 1],
  ['installed learning status runs', learningStatus && learningStatus.schema_version === '1' && learningStatus.sections.some((item) => item.name === 'next-work-outcomes')],
  ['installed release verify runs', releaseVerify && releaseVerify.schema_version === '1' && releaseVerify.boundary.includes('advisory')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
    if (name === 'installed downstream smoke passes' && smoke) {
      const summary = smoke.checks.map((item) => ({ ...item }));
      console.error(JSON.stringify({ status: smoke.status, checks: summary }, null, 2));
    }
  }
}

if (failed > 0) process.exit(1);
console.log('installed runtime dogfood: ok');
