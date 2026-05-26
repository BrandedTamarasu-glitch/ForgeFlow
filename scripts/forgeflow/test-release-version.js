#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');

function safeRepoPath(relativePath, base = repoRoot) {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.split(/[\\/]+/).includes('..')) {
    throw new Error(`Unsafe release-version path: ${relativePath}`);
  }
  const root = path.resolve(base);
  const file = path.join(root, relativePath);
  const resolved = path.resolve(file);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Release-version path escapes repo: ${relativePath}`);
  }
  return file;
}

function regularFile(relativePath, base = repoRoot) {
  const root = path.resolve(base);
  const file = safeRepoPath(relativePath, root);
  try {
    const parts = relativePath.split(/[\\/]+/);
    let current = root;
    for (const part of parts.slice(0, -1)) {
      current = path.join(current, part);
      const parentStat = fs.lstatSync(current);
      if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) return false;
    }
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) return false;
    const rootReal = fs.realpathSync(root);
    const fileReal = fs.realpathSync(file);
    return fileReal.startsWith(`${rootReal}${path.sep}`);
  } catch (_err) {
    return false;
  }
}

function readText(relativePath, base = repoRoot) {
  if (!regularFile(relativePath, base)) {
    throw new Error(`Expected regular repo file: ${relativePath}`);
  }
  return fs.readFileSync(safeRepoPath(relativePath, base), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function fileExists(relativePath) {
  return regularFile(relativePath);
}

function changelogCandidates(version) {
  const exact = `docs/changelogs/v${version}.html`;
  const patchZero = version.endsWith('.0')
    ? `docs/changelogs/v${version.replace(/\.0$/, '')}.html`
    : null;
  return patchZero ? [exact, patchZero] : [exact];
}

const plugin = readJson('.claude-plugin/plugin.json');
const marketplace = readJson('.claude-plugin/marketplace.json');
const marketplaceEntry = marketplace.plugins.find((entry) => entry.name === plugin.name);
const releaseProcess = readText('docs/wiki/Release-Process.md');
const releaseCheck = readText('commands/forgeflow-release-check.md');
const learningsCommand = readText('commands/forgeflow-learnings.md');
const healthCommand = readText('commands/forgeflow-health.md');
const reportCommand = readText('commands/forgeflow-report.md');
const pilotCommand = readText('commands/forgeflow-pilot.md');
const trendsCommand = readText('commands/forgeflow-trends.md');
const reviewCommand = readText('commands/review.md');
const reviewAutoCommand = readText('commands/review-auto.md');
const shipCommand = readText('commands/ship.md');
const handoffCommand = readText('commands/handoff.md');
const readme = readText('README.md');
const hostedDocs = readText('docs/index.html');

const semver = /^\d+\.\d+\.\d+$/;
const changelogs = changelogCandidates(plugin.version);
const matchingChangelog = changelogs.find(fileExists);
const matchingChangelogLink = matchingChangelog && `./${matchingChangelog.replace(/^docs\//, '')}`;
const symlinkFixture = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-release-version-symlink-'));
const symlinkOutside = path.join(symlinkFixture, 'outside');
const symlinkRoot = path.join(symlinkFixture, 'repo');
fs.mkdirSync(path.join(symlinkOutside, 'commands'), { recursive: true });
fs.mkdirSync(symlinkRoot, { recursive: true });
fs.writeFileSync(path.join(symlinkOutside, 'commands', 'forgeflow-release-check.md'), 'spoof\n');
fs.symlinkSync(path.join(symlinkOutside, 'commands'), path.join(symlinkRoot, 'commands'));

const checks = [
  ['plugin version is semver', semver.test(plugin.version)],
  ['marketplace entry present', Boolean(marketplaceEntry)],
  ['marketplace version matches plugin', marketplaceEntry && marketplaceEntry.version === plugin.version],
  ['marketplace description mentions Claude Code', marketplaceEntry?.description?.includes('Claude Code')],
  ['marketplace description mentions Codex', marketplaceEntry?.description?.includes('Codex')],
  ['matching changelog exists', Boolean(matchingChangelog)],
  ['release-version rejects symlinked parent dirs', regularFile('commands/forgeflow-release-check.md', symlinkRoot) === false],
  ['hosted docs link matching changelog', matchingChangelogLink && hostedDocs.includes(`href="${matchingChangelogLink}"`)],
  ['README links release process', readme.includes('docs/wiki/Release-Process.md')],
  ['README links release gate', readme.includes('docs/wiki/Release-Gate.md')],
  ['README links user paths', readme.includes('docs/wiki/User-Paths.md')],
  ['README links project learnings', readme.includes('docs/wiki/Project-Learnings.md')],
  ['README mentions project learnings check command', readme.includes('/forgeflow-learnings --project --check')],
  ['learnings command supports project check', learningsCommand.includes('--check') && learningsCommand.includes('show-project-learnings.js') && learningsCommand.includes('context-pack smoke')],
  ['hosted docs links project learnings', hostedDocs.includes('./wiki/Project-Learnings.md')],
  ['release process mentions plugin manifest', releaseProcess.includes('.claude-plugin/plugin.json')],
  ['release process mentions marketplace manifest', releaseProcess.includes('.claude-plugin/marketplace.json')],
  ['release process mentions changelog path', releaseProcess.includes('docs/changelogs/')],
  ['release process mentions release check command', releaseProcess.includes('/forgeflow-release-check')],
  ['release process mentions public summary rendering', releaseProcess.includes('render-evaluation-report.js --public')],
  ['release check runs version drift test', releaseCheck.includes('node scripts/forgeflow/test-release-version.js')],
  ['release check runs command argument safety test', releaseCheck.includes('node scripts/forgeflow/test-command-argument-safety.js')],
  ['release check runs artifact contract test', releaseCheck.includes('node scripts/forgeflow/test-artifact-contracts.js')],
  ['release check runs guided repair test', releaseCheck.includes('node scripts/forgeflow/test-render-guided-repair.js')],
  ['release check runs guidance contract test', releaseCheck.includes('node scripts/forgeflow/test-guidance-contract.js')],
  ['release check runs failure digest test', releaseCheck.includes('node scripts/forgeflow/test-failure-digest.js')],
  ['release check runs runtime helper contract test', releaseCheck.includes('node scripts/forgeflow/test-runtime-helper-contract.js')],
  ['release check runs agent drift test', releaseCheck.includes('node scripts/forgeflow/test-check-agent-drift.js')],
  ['release check runs forgeflow report test', releaseCheck.includes('node scripts/forgeflow/test-render-forgeflow-report.js')],
  ['release check runs release notes test', releaseCheck.includes('node scripts/forgeflow/test-render-release-notes.js')],
  ['release check runs release readiness test', releaseCheck.includes('node scripts/forgeflow/test-render-release-readiness.js')],
  ['release check runs support bundle test', releaseCheck.includes('node scripts/forgeflow/test-render-support-bundle.js')],
  ['release check runs evaluation report test', releaseCheck.includes('node scripts/forgeflow/test-render-evaluation-report.js')],
  ['release check renders public evaluation summary', releaseCheck.includes('render-evaluation-report.js --outcomes fixtures/evaluation/sample-outcomes.jsonl --public')],
  ['release check runs privacy boundary test', releaseCheck.includes('node scripts/forgeflow/test-privacy-boundary.js')],
  ['release check runs adoption pack test', releaseCheck.includes('node scripts/forgeflow/test-render-adoption-pack.js')],
  ['release check runs pilot evidence test', releaseCheck.includes('node scripts/forgeflow/test-record-pilot-evidence.js')],
  ['release check runs agent feedback test', releaseCheck.includes('node scripts/forgeflow/test-record-agent-feedback.js')],
  ['release check runs agent feedback rollup test', releaseCheck.includes('node scripts/forgeflow/test-rollup-agent-feedback.js')],
  ['release check runs project learning recorder test', releaseCheck.includes('node scripts/forgeflow/test-record-project-learning.js')],
  ['release check runs pattern learnings rollup test', releaseCheck.includes('node scripts/forgeflow/test-rollup-pattern-learnings.js')],
  ['release check runs pilot evidence rollup test', releaseCheck.includes('node scripts/forgeflow/test-rollup-pilot-evidence.js')],
  ['release check runs project learnings rollup test', releaseCheck.includes('node scripts/forgeflow/test-rollup-project-learnings.js')],
  ['release check runs project learnings display test', releaseCheck.includes('node scripts/forgeflow/test-show-project-learnings.js')],
  ['release check runs project trends display test', releaseCheck.includes('node scripts/forgeflow/test-show-project-trends.js')],
  ['release check runs project intelligence test', releaseCheck.includes('node scripts/forgeflow/test-build-project-intelligence.js')],
  ['release check runs smoke check test', releaseCheck.includes('node scripts/forgeflow/test-smoke-check.js')],
  ['release check runs dogfood self-test', releaseCheck.includes('node scripts/forgeflow/test-dogfood-self-test.js')],
  ['release check runs installed-runtime dogfood', releaseCheck.includes('node scripts/forgeflow/test-installed-runtime-dogfood.js')],
  ['release process runs installed-runtime dogfood', releaseProcess.includes('node scripts/forgeflow/test-installed-runtime-dogfood.js')],
  ['release process documents installed-runtime dogfood', releaseProcess.includes('test-installed-runtime-dogfood.js') && releaseProcess.includes('installed-runtime paths')],
  ['release check runs source smoke', releaseCheck.includes('node scripts/forgeflow/smoke-check.js --mode source --json')],
  ['release check runs pilot script test', releaseCheck.includes('node scripts/forgeflow/test-render-pilot-script.js')],
  ['README mentions smoke check helper', readme.includes('scripts/forgeflow/smoke-check.js --json')],
  ['pilot command uses pilot script helper', pilotCommand.includes('render-pilot-script.js') && pilotCommand.includes('public-safe result template')],
  ['report command uses report helper', reportCommand.includes('render-forgeflow-report.js') && reportCommand.includes('show-project-trends.js --json') && reportCommand.includes('--refresh')],
  ['trends command uses project trends helper', trendsCommand.includes('show-project-trends.js') && readme.includes('/forgeflow-trends')],
  ['health trends report share refresh recommendation', healthCommand.includes('/forgeflow-trends --refresh') && trendsCommand.includes('/forgeflow-trends --refresh') && reportCommand.includes('/forgeflow-trends --refresh') && readme.includes('/forgeflow-trends --refresh')],
  ['release check runs context pack test', releaseCheck.includes('node scripts/forgeflow/test-build-context-pack.js')],
  ['release check runs code topology test', releaseCheck.includes('node scripts/forgeflow/test-build-code-topology.js')],
  ['release check runs implementation notes test', releaseCheck.includes('node scripts/forgeflow/test-implementation-notes.js')],
  ['release check runs implementation notes quality test', releaseCheck.includes('node scripts/forgeflow/test-check-implementation-notes.js')],
  ['release check runs project learnings quality test', releaseCheck.includes('node scripts/forgeflow/test-check-project-learnings.js')],
  ['review command guides Arbiter topology use', reviewCommand.includes('Arbiter must use `code_topology_summary` as review-context guidance') && reviewCommand.includes('topology supports prioritization only') && reviewCommand.includes('code_topology_summary.history.trend.status')],
  ['review command guides Compass topology use', reviewCommand.includes('use it to prioritize validation around high fan-in/high fan-out files') && reviewCommand.includes('compared code-map trend deltas') && reviewCommand.includes('not proof of runtime behavior')],
  ['review command persists verdict history', reviewCommand.includes('append the final review verdict to `${FORGEFLOW_DIR}/review-history.md`') && reviewCommand.includes('/ship` reads this file as its approval gate')],
  ['ship uses installed helper fallback', shipCommand.includes('HELPER_DIR="scripts/forgeflow"') && shipCommand.includes('node "${HELPER_DIR}/check-implementation-notes.js"') && shipCommand.includes('node "${HELPER_DIR}/show-project-learnings.js"')],
  ['ship secret scan is hard gate', shipCommand.includes('### 1f. Secret scan (hard gate)') && shipCommand.includes('Do not prompt to continue') && shipCommand.includes('Secret-scan failures must never fail open')],
  ['ship hygiene always enforced', shipCommand.includes('Do not depend on a `CLAUDE.md` opt-in') && shipCommand.includes('Commit body line length (hard gate)')],
  ['review-auto avoids whole-worktree checkout', reviewAutoCommand.includes('Never run `git checkout -- .`') && !reviewAutoCommand.includes('git checkout -- .\n')],
  ['review-auto refreshes project learnings', reviewAutoCommand.includes('show-project-learnings.js') && reviewAutoCommand.includes('--check --json')],
  ['learnings command separates mode flags', learningsCommand.includes('Choose either current-project mode') && learningsCommand.includes('Do not pass this flag through to cross-project rollup helpers')],
  ['handoff summary source matches gathered state', handoffCommand.includes('draw from the recent git log, current git status, linked PR metadata')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

if (failed > 0) {
  console.error(`Expected changelog: ${changelogs.join(' or ')}`);
  process.exit(1);
}

console.log(`release version: ok (${plugin.version}, ${matchingChangelog})`);
