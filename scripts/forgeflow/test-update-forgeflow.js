#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  isMissingRuntimeHelperContractError,
  missingRequiredManagedFiles,
  renderMarkdown,
  requiredManagedSources,
  rollbackForgeflow,
  updateForgeflow,
  versionPath,
} = require('./update-forgeflow');
const {
  isManagedSource,
  manifestEntry,
} = require('./install-manifest');

const repoRoot = path.resolve(__dirname, '..', '..');
const latest = '1111111111111111111111111111111111111111';
const previous = '0000000000000000000000000000000000000000';
const CANONICAL_NON_REQUIRED_MANAGED_SOURCES = [
  'agents/_shared/arbiter-intelligence.md',
  'agents/_shared/lumen-design-principles.md',
  'agents/_shared/rules.md',
  'agents/_shared/smith-craft.md',
  'agents/_shared/warden-security-intelligence.md',
  'agents/aegis.md',
  'agents/arbiter-consult.md',
  'agents/arbiter-implement.md',
  'agents/arbiter-review.md',
  'agents/atlas-consult.md',
  'agents/atlas-early.md',
  'agents/atlas-implement.md',
  'agents/atlas-present.md',
  'agents/atlas-review.md',
  'agents/compass-discuss.md',
  'agents/compass-implement.md',
  'agents/compass-plan.md',
  'agents/compass-present.md',
  'agents/compass-research.md',
  'agents/compass-review.md',
  'agents/lumen-consult.md',
  'agents/lumen-implement.md',
  'agents/lumen-review.md',
  'agents/smith-audit.md',
  'agents/smith-consult.md',
  'agents/smith-implement.md',
  'agents/smith-review.md',
  'agents/warden-audit.md',
  'agents/warden-consult.md',
  'agents/warden-implement.md',
  'agents/warden-review.md',
  'commands/agent-chat/off.md',
  'commands/agent-chat/on.md',
  'commands/audit.md',
  'commands/ci-wrapper.md',
  'commands/consult.md',
  'commands/create-agent.md',
  'commands/dashboard.md',
  'commands/debate.md',
  'commands/discuss.md',
  'commands/fleet.md',
  'commands/forgeflow-adoption.md',
  'commands/forgeflow-code-map.md',
  'commands/forgeflow-compact-output.md',
  'commands/forgeflow-context-contract.md',
  'commands/forgeflow-context-retention.md',
  'commands/forgeflow-drift.md',
  'commands/forgeflow-failure-digest.md',
  'commands/forgeflow-first-run.md',
  'commands/forgeflow-first-run-result.md',
  'commands/forgeflow-first-run-rollup.md',
  'commands/forgeflow-first-useful-win.md',
  'commands/forgeflow-health.md',
  'commands/forgeflow-health-timeline.md',
  'commands/forgeflow-insight-injection.md',
  'commands/forgeflow-learning-status.md',
  'commands/forgeflow-learnings.md',
  'commands/forgeflow-metrics.md',
  'commands/forgeflow-next-action-audit.md',
  'commands/forgeflow-next-work-outcome.md',
  'commands/forgeflow-noisy-command.md',
  'commands/forgeflow-pattern-review.md',
  'commands/forgeflow-pilot.md',
  'commands/forgeflow-post-release-install-verify.md',
  'commands/forgeflow-profile.md',
  'commands/forgeflow-profile-review.md',
  'commands/forgeflow-release-check.md',
  'commands/forgeflow-release-readiness.md',
  'commands/forgeflow-release-verify.md',
  'commands/forgeflow-repair.md',
  'commands/forgeflow-report.md',
  'commands/forgeflow-review-auto-classify.md',
  'commands/forgeflow-runtime-drift.md',
  'commands/forgeflow-smoke.md',
  'commands/forgeflow-support.md',
  'commands/forgeflow-sync.md',
  'commands/forgeflow-trends.md',
  'commands/forgeflow-version.md',
  'commands/handoff.md',
  'commands/implement.md',
  'commands/plan.md',
  'commands/quick.md',
  'commands/research.md',
  'commands/review-auto.md',
  'commands/review.md',
  'commands/ship.md',
  'commands/sync-upstream.md',
  'commands/ui-iterate.md',
  'commands/update-forgeflow.md',
  'forgeflow-patterns/auto-fix-patterns.md',
  'forgeflow-patterns/recurring-blockers.md',
  'forgeflow-patterns/tooling-patterns.md',
  'forgeflow-patterns/verdict-trends.md',
  'project-rules/commit-hygiene.md',
  'project-rules/dev-environment.md',
];

async function localFetcher(_repo, _sha, source) {
  return fs.readFileSync(path.join(repoRoot, source), 'utf8');
}

async function failingFetcher(_repo, _sha, source) {
  if (source.endsWith('health-check.js')) throw new Error('simulated fetch failure');
  return localFetcher(_repo, _sha, source);
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, files);
    else if (entry.isFile()) files.push(path.relative(repoRoot, file).replace(/\\/g, '/'));
  }
  return files;
}

function allManagedSources() {
  return walk(repoRoot)
    .filter(isManagedSource)
    .filter((source) => !manifestEntry(source)?.preserve)
    .sort();
}

function installedManagedSources(home, sources) {
  return sources
    .map((source) => manifestEntry(source, home))
    .filter(Boolean)
    .filter((entry) => !entry.preserve && fs.existsSync(entry.destination))
    .map((entry) => entry.source)
    .sort();
}

function copySourceToHome(source, home) {
  const entry = manifestEntry(source, home);
  if (!entry || entry.preserve) return;
  fs.mkdirSync(path.dirname(entry.destination), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, source), entry.destination);
  if (entry.executable) fs.chmodSync(entry.destination, 0o755);
}

function sameList(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

async function run() {
  const requiredSources = requiredManagedSources();
  const freshHomeSources = [...new Set([...requiredSources, ...CANONICAL_NON_REQUIRED_MANAGED_SOURCES])].sort();
  const managedSources = allManagedSources();
  const freshHome = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-update-fresh-'));
  const freshInstall = await updateForgeflow({
    home: freshHome,
    repo: 'local/repo',
    current: '',
    latest,
    plan: {
      firstRun: true,
      files: freshHomeSources,
      deleted: [],
    },
    fetcher: localFetcher,
  });
  const freshRepairHome = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-update-fresh-repair-'));
  const freshRepair = await updateForgeflow({
    home: freshRepairHome,
    repo: 'local/repo',
    current: '',
    latest,
    repair: true,
    plan: {
      firstRun: false,
      files: freshHomeSources,
      deleted: [],
    },
    fetcher: localFetcher,
  });

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
    missingRequired: [],
    fetcher: localFetcher,
  });

  const incompleteHome = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-update-incomplete-'));
  fs.writeFileSync(versionPath(incompleteHome), `${latest}\n`);
  for (const source of requiredSources.filter((source) => source !== 'scripts/forgeflow/smoke-check.js')) {
    copySourceToHome(source, incompleteHome);
  }
  const autoRepair = await updateForgeflow({
    home: incompleteHome,
    repo: 'local/repo',
    current: latest,
    latest,
    plan: {
      firstRun: false,
      files: ['scripts/forgeflow/smoke-check.js'],
      deleted: [],
    },
    fetcher: localFetcher,
  });
  const autoRepairMarkdown = renderMarkdown(autoRepair);

  const repairHome = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-update-repair-'));
  fs.writeFileSync(versionPath(repairHome), `${latest}\n`);
  const repaired = await updateForgeflow({
    home: repairHome,
    repo: 'local/repo',
    current: latest,
    latest,
    repair: true,
    plan: {
      firstRun: false,
      files: ['scripts/forgeflow/health-check.js'],
      deleted: [],
    },
    fetcher: localFetcher,
  });
  const futureHelperHome = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-update-future-helper-'));
  fs.writeFileSync(versionPath(futureHelperHome), `${latest}\n`);
  const futureHelper = await updateForgeflow({
    home: futureHelperHome,
    repo: 'local/repo',
    current: latest,
    latest,
    repair: true,
    plan: {
      firstRun: false,
      files: ['scripts/forgeflow/future-helper.js'],
      deleted: [],
    },
    fetcher: async () => '#!/usr/bin/env node\nconsole.log("future helper");\n',
  });

  const rollbackHome = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-update-rollback-'));
  fs.mkdirSync(path.join(rollbackHome, 'commands'), { recursive: true });
  fs.mkdirSync(path.join(rollbackHome, 'agents'), { recursive: true });
  fs.writeFileSync(versionPath(rollbackHome), `${previous}\n`);
  fs.writeFileSync(path.join(rollbackHome, 'commands', 'review.md'), 'old review\n');
  fs.writeFileSync(path.join(rollbackHome, 'commands', 'old.md'), 'old command\n');
  fs.writeFileSync(path.join(rollbackHome, 'agents', 'custom-local.md'), 'custom\n');
  const rollbackUpdate = await updateForgeflow({
    home: rollbackHome,
    repo: 'local/repo',
    current: previous,
    latest,
    plan: {
      firstRun: false,
      files: ['commands/review.md', 'commands/quick.md'],
      deleted: ['commands/old.md'],
    },
    fetcher: localFetcher,
  });
  const rollbackUpdateRemovedOld = rollbackUpdate.removed.some((item) => item.source === 'commands/old.md') && !fs.existsSync(path.join(rollbackHome, 'commands', 'old.md'));
  const rollback = rollbackForgeflow({ home: rollbackHome });
  const missingContractError = Object.assign(new Error("Cannot find module './runtime-helper-contract'"), { code: 'MODULE_NOT_FOUND' });
  const nestedMissingError = Object.assign(new Error("Cannot find module './other'"), { code: 'MODULE_NOT_FOUND' });

  const checks = [
    ['canonical managed source list matches checkout', sameList(managedSources, freshHomeSources)],
    ['fresh home updates', freshInstall.status === 'updated' && freshInstall.first_run === true],
    ['fresh home writes version', fs.readFileSync(versionPath(freshHome), 'utf8').trim() === latest],
    ['fresh home syncs canonical files', installedManagedSources(freshHome, freshHomeSources).length === freshHomeSources.length],
    ['fresh home has no missing required files', missingRequiredManagedFiles(freshHome).length === 0],
    ['fresh home installs commands', fs.existsSync(path.join(freshHome, 'commands', 'review.md'))],
    ['fresh home installs runtime helper', fs.existsSync(path.join(freshHome, 'forgeflow', 'scripts', 'forgeflow', 'update-forgeflow.js'))],
    ['fresh home keeps runtime helpers executable', requiredSources.every((source) => {
      const entry = manifestEntry(source, freshHome);
      return Boolean(entry && (!entry.executable || ((fs.statSync(entry.destination).mode & 0o111) !== 0)));
    })],
    ['fresh home repair bootstraps canonical files', freshRepair.status === 'repaired' && installedManagedSources(freshRepairHome, freshHomeSources).length === freshHomeSources.length],
    ['fresh home repair writes version', fs.readFileSync(versionPath(freshRepairHome), 'utf8').trim() === latest],
    ['fresh home repair has no missing required files', missingRequiredManagedFiles(freshRepairHome).length === 0],
    ['first updated', first.status === 'updated'],
    ['version written', fs.readFileSync(versionPath(home), 'utf8').trim() === latest],
    ['command installed', fs.existsSync(path.join(home, 'commands', 'review.md'))],
    ['runtime helper installed', fs.existsSync(path.join(home, 'forgeflow', 'scripts', 'forgeflow', 'health-check.js'))],
    ['test helper skipped by manifest', !fs.existsSync(path.join(home, 'forgeflow', 'scripts', 'forgeflow', 'test-health-check.js'))],
    ['runtime helper executable', (fs.statSync(path.join(home, 'forgeflow', 'scripts', 'forgeflow', 'health-check.js')).mode & 0o111) !== 0],
    ['affected command reported', first.affected_commands.some((item) => item.command === 'commands/forgeflow-health.md' && item.helpers.includes('scripts/forgeflow/health-check.js'))],
    ['updater only tolerates missing helper contract', isMissingRuntimeHelperContractError(missingContractError) && !isMissingRuntimeHelperContractError(nestedMissingError) && !isMissingRuntimeHelperContractError(Object.assign(new Error('syntax'), { code: 'ERR' }))],
    ['partial status', partial.status === 'partial'],
    ['partial version not advanced', fs.readFileSync(versionPath(partialHome), 'utf8').trim() === previous],
    ['partial deleted reported', partial.deleted.includes('commands/old.md')],
    ['up to date', upToDate.status === 'up-to-date'],
    ['up to date has no affected commands', upToDate.affected_commands.length === 0],
    ['latest incomplete auto repairs', autoRepair.status === 'repaired' && autoRepair.repair_needed === true],
    ['latest incomplete reports missing managed files', autoRepair.missing_required.includes('scripts/forgeflow/smoke-check.js')],
    ['latest incomplete installs missing helper', fs.existsSync(path.join(incompleteHome, 'forgeflow', 'scripts', 'forgeflow', 'smoke-check.js'))],
    ['auto repair affected commands scoped to missing helper', autoRepair.affected_commands.every((item) => item.helpers.includes('scripts/forgeflow/smoke-check.js'))],
    ['auto repair markdown renders affected commands', autoRepairMarkdown.includes('Affected commands:')],
    ['repair status', repaired.status === 'repaired'],
    ['repair installs missing file', fs.existsSync(path.join(repairHome, 'forgeflow', 'scripts', 'forgeflow', 'health-check.js'))],
    ['repair writes version', fs.readFileSync(versionPath(repairHome), 'utf8').trim() === latest],
    ['future helper repair status', futureHelper.status === 'repaired'],
    ['future helper installed from tree discovery', fs.existsSync(path.join(futureHelperHome, 'forgeflow', 'scripts', 'forgeflow', 'future-helper.js'))],
    ['future helper executable', (fs.statSync(path.join(futureHelperHome, 'forgeflow', 'scripts', 'forgeflow', 'future-helper.js')).mode & 0o111) !== 0],
    ['rollback update created backup', rollbackUpdate.backup.created === true],
    ['rollback update removed deleted file', rollbackUpdateRemovedOld],
    ['rollback status', rollback.status === 'rolled-back'],
    ['rollback restored prior file', fs.readFileSync(path.join(rollbackHome, 'commands', 'review.md'), 'utf8') === 'old review\n'],
    ['rollback restored deleted file', fs.readFileSync(path.join(rollbackHome, 'commands', 'old.md'), 'utf8') === 'old command\n'],
    ['rollback removed newly created file', !fs.existsSync(path.join(rollbackHome, 'commands', 'quick.md'))],
    ['rollback restored version', fs.readFileSync(versionPath(rollbackHome), 'utf8').trim() === previous],
    ['rollback preserved custom agent', fs.readFileSync(path.join(rollbackHome, 'agents', 'custom-local.md'), 'utf8') === 'custom\n'],
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
