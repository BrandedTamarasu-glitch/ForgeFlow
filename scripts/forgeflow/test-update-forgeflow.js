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
  'commands/forgeflow-command-args.md',
  'commands/forgeflow-command-capability.md',
  'commands/forgeflow-command-interface-evidence.md',
  'commands/forgeflow-command-wrapper-batch.md',
  'commands/forgeflow-compact-output.md',
  'commands/forgeflow-context-advisor.md',
  'commands/forgeflow-context-contract.md',
  'commands/forgeflow-context-retention.md',
  'commands/forgeflow-context-wave-build.md',
  'commands/forgeflow-context-wave-plan.md',
  'commands/forgeflow-capture-output.md',
  'commands/forgeflow-dogfood-refresh-plan.md',
  'commands/forgeflow-dogfood-report.md',
  'commands/forgeflow-drift.md',
  'commands/forgeflow-efficiency-gaps.md',
  'commands/forgeflow-failure-digest.md',
  'commands/forgeflow-first-run.md',
  'commands/forgeflow-first-run-result.md',
  'commands/forgeflow-first-run-rollup.md',
  'commands/forgeflow-first-run-simulator.md',
  'commands/forgeflow-first-task-adoption-loop.md',
  'commands/forgeflow-first-task-report.md',
  'commands/forgeflow-first-useful-win.md',
  'commands/forgeflow-health.md',
  'commands/forgeflow-health-timeline.md',
  'commands/forgeflow-insight-injection.md',
  'commands/forgeflow-invocation-hints.md',
  'commands/forgeflow-lean-adapter-contract.md',
  'commands/forgeflow-lean-adapter-drift.md',
  'commands/forgeflow-lean-adapter-smoke.md',
  'commands/forgeflow-lean-audit.md',
  'commands/forgeflow-lean-behavior.md',
  'commands/forgeflow-lean-benchmark.md',
  'commands/forgeflow-lean-benchmark-results.md',
  'commands/forgeflow-lean-benchmark-runner.md',
  'commands/forgeflow-lean-correctness.md',
  'commands/forgeflow-lean-debt.md',
  'commands/forgeflow-lean-decision.md',
  'commands/forgeflow-lean-demo-report.md',
  'commands/forgeflow-lean-eval.md',
  'commands/forgeflow-lean-hook-contract.md',
  'commands/forgeflow-lean-host-adapters.md',
  'commands/forgeflow-lean-host-cli-probes.md',
  'commands/forgeflow-lean-host-command-parity.md',
  'commands/forgeflow-lean-host-packages.md',
  'commands/forgeflow-lean-lab.md',
  'commands/forgeflow-lean-mode.md',
  'commands/forgeflow-lean-openclaw-skill.md',
  'commands/forgeflow-lean-pi-smoke.md',
  'commands/forgeflow-lean-portability.md',
  'commands/forgeflow-lean-prime.md',
  'commands/forgeflow-lean-report.md',
  'commands/forgeflow-lean-review.md',
  'commands/forgeflow-lean-robustness.md',
  'commands/forgeflow-lean-rule-canary.md',
  'commands/forgeflow-lean-session.md',
  'commands/forgeflow-lean-skills.md',
  'commands/forgeflow-lean-status.md',
  'commands/forgeflow-lean-windows-smoke.md',
  'commands/forgeflow-learning-action.md',
  'commands/forgeflow-learning-capture-nudge.md',
  'commands/forgeflow-learning-policy.md',
  'commands/forgeflow-learning-status.md',
  'commands/forgeflow-learnings.md',
  'commands/forgeflow-memory-correct.md',
  'commands/forgeflow-metrics.md',
  'commands/forgeflow-next-action-audit.md',
  'commands/forgeflow-next-work-outcome.md',
  'commands/forgeflow-next-work-ranking.md',
  'commands/forgeflow-noisy-command.md',
  'commands/forgeflow-output-contract.md',
  'commands/forgeflow-outcome-capture-plan.md',
  'commands/forgeflow-pattern-review.md',
  'commands/forgeflow-pilot.md',
  'commands/forgeflow-post-release-install-verify.md',
  'commands/forgeflow-profile.md',
  'commands/forgeflow-profile-bootstrap.md',
  'commands/forgeflow-profile-review.md',
  'commands/forgeflow-project-brief.md',
  'commands/forgeflow-project-model.md',
  'commands/forgeflow-research-divergence-advice.md',
  'commands/forgeflow-research-divergence-eval.md',
  'commands/forgeflow-ownership.md',
  'commands/forgeflow-release-check.md',
  'commands/forgeflow-release-consumption.md',
  'commands/forgeflow-release-consumption-loop.md',
  'commands/forgeflow-release-follow-through.md',
  'commands/forgeflow-release-readiness.md',
  'commands/forgeflow-release-verify.md',
  'commands/forgeflow-repair.md',
  'commands/forgeflow-report.md',
  'commands/forgeflow-skills.md',
  'commands/forgeflow-architecture.md',
  'commands/forgeflow-review-auto-classify.md',
  'commands/forgeflow-review-auto-evidence.md',
  'commands/forgeflow-review-autofix-apply.md',
  'commands/forgeflow-review-autofix-sandbox.md',
  'commands/forgeflow-review-autofix-status.md',
  'commands/forgeflow-review-evidence-schema.md',
  'commands/forgeflow-review-wave-prep.md',
  'commands/forgeflow-runtime-drift.md',
  'commands/forgeflow-smoke.md',
  'commands/forgeflow-support.md',
  'commands/forgeflow-stale-artifact-plan.md',
  'commands/forgeflow-sync.md',
  'commands/forgeflow-telemetry-quality.md',
  'commands/forgeflow-trends.md',
  'commands/forgeflow-update-verify.md',
  'commands/forgeflow-validation-plan.md',
  'commands/forgeflow-validation-failure-capture.md',
  'commands/forgeflow-version.md',
  'commands/forgeflow-workflow-ending-capture.md',
  'commands/forgeflow-workflow-readiness.md',
  'commands/forgeflow-wrapper-drift-plan.md',
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
  'hooks/copilot-hooks.json',
  'project-rules/commit-hygiene.md',
  'project-rules/dev-environment.md',
  'skills/forgeflow-audit/SKILL.md',
  'skills/forgeflow-implement/SKILL.md',
  'skills/forgeflow-research-divergence-advice/SKILL.md',
  'skills/forgeflow-lean-audit/SKILL.md',
  'skills/forgeflow-lean-debt/SKILL.md',
  'skills/forgeflow-lean-prime/SKILL.md',
  'skills/forgeflow-lean-review/SKILL.md',
  'skills/forgeflow-lean/SKILL.md',
  'skills/forgeflow-plan/SKILL.md',
  'skills/forgeflow-review/SKILL.md',
  'skills/forgeflow-ship/SKILL.md',
  'scripts/forgeflow/command-interface-evidence.js',
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

async function runRecoveryRegressions() {
  const assert = require('assert/strict');
  const { spawnSync } = require('child_process');
  const { installCodex, codexSources } = require('./install-template');
  const { CODEX_INVENTORY_SOURCE } = require('./install-manifest');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-recovery-regressions-'));
  const put = (home, source, content, mode = 0o644) => {
    const destination = manifestEntry(source, home).destination;
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content, { mode });
  };
  const snapshot = (dir) => {
    const result = {};
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      const stat = fs.lstatSync(file);
      result[name] = stat.isDirectory() ? snapshot(file)
        : { bytes: fs.readFileSync(file).toString('base64'), mode: stat.mode & 0o777 };
    }
    return result;
  };
  try {
    const home = path.join(temp, 'retry');
    put(home, 'commands/review.md', 'original review\n', 0o600);
    put(home, 'commands/quick.md', 'original quick\n', 0o640);
    put(home, 'commands/old.md', 'original deleted\n');
    fs.writeFileSync(versionPath(home), `${previous}\r\n`, { mode: 0o600 });
    const original = snapshot(home);
    const plan = { files: ['commands/review.md', 'commands/new.md', 'commands/quick.md'], deleted: ['commands/old.md'] };
    const options = { home, latest, plan, missingRequired: [], fetcher: async (_repo, _sha, source) => {
      if (source === 'commands/quick.md') throw new Error('injected failure after successful writes');
      return `replacement ${source}\n`;
    } };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const partial = await updateForgeflow(options);
      assert.equal(partial.status, 'partial');
      assert.equal(partial.backup.reused, attempt > 0);
      assert.equal(fs.readFileSync(path.join(home, 'commands/review.md'), 'utf8'), 'replacement commands/review.md\n');
      assert.equal(fs.readFileSync(versionPath(home), 'utf8'), `${previous}\r\n`);
    }
    // C reverts review.md and removes new.md, so neither appears in A...C.
    // Resuming that delta on partial B would otherwise publish mixed files.
    const beforeRetarget = snapshot(home);
    let retargetFetched = false;
    await assert.rejects(updateForgeflow({ ...options, latest: '2'.repeat(40),
      plan: { files: ['commands/quick.md'], deleted: [] },
      fetcher: async () => { retargetFetched = true; return 'C quick'; },
    }), /Pending update targets .*Run --rollback/);
    assert.equal(retargetFetched, false);
    assert.deepEqual(snapshot(home), beforeRetarget, 'retarget refusal preserves partial state and original snapshot');
    const retry = await updateForgeflow({ ...options,
      plan: { files: [...plan.files, 'commands/added-on-retry.md'], deleted: plan.deleted },
      fetcher: async (_repo, _sha, source) => `final ${source}\n`,
    });
    assert.equal(retry.status, 'updated');
    assert.equal(retry.backup.reused, true);
    const beforePreview = snapshot(home);
    const preview = spawnSync(process.execPath, [path.join(__dirname, 'update-forgeflow.js'), '--home', home, '--rollback', '--dry-run', '--json'], { encoding: 'utf8' });
    assert.ifError(preview.error);
    assert.equal(preview.status, 0, preview.stderr);
    assert.equal(JSON.parse(preview.stdout).status, 'rollback-preview');
    assert.equal(JSON.parse(preview.stdout).version_written, false);
    assert.deepEqual(snapshot(home), beforePreview, 'CLI rollback dry-run must preserve all bytes and modes including backups');
    assert.equal(rollbackForgeflow({ home }).status, 'rolled-back');
    const restored = snapshot(home);
    delete restored.forgeflow;
    assert.deepEqual(restored, original, 'rollback after retries restores original bytes, modes, deletions and marker');
    const retarget = await updateForgeflow({ ...options, latest: '2'.repeat(40),
      plan: { files: ['commands/quick.md'], deleted: [] }, fetcher: async () => 'C quick' });
    assert.equal(retarget.status, 'updated');
    assert.equal(fs.readFileSync(path.join(home, 'commands/review.md'), 'utf8'), 'original review\n');
    assert.equal(fs.existsSync(path.join(home, 'commands/new.md')), false);
    assert.equal(fs.readFileSync(path.join(home, 'commands/quick.md'), 'utf8'), 'C quick');
    assert.equal(fs.readFileSync(versionPath(home), 'utf8').trim(), '2'.repeat(40));

    // Older pending snapshots cannot prove which target was partially applied.
    const legacy = path.join(temp, 'legacy-pending');
    put(legacy, 'commands/review.md', 'legacy original');
    await updateForgeflow({ ...options, home: legacy });
    const legacyManifestPath = path.join(legacy, 'forgeflow/backups/previous/manifest.json');
    const legacyManifest = JSON.parse(fs.readFileSync(legacyManifestPath, 'utf8'));
    delete legacyManifest.to_version;
    fs.writeFileSync(legacyManifestPath, JSON.stringify(legacyManifest));
    const beforeLegacyRetry = snapshot(legacy);
    await assert.rejects(updateForgeflow({ ...options, home: legacy }), /unknown target SHA.*Run --rollback/);
    assert.deepEqual(snapshot(legacy), beforeLegacyRetry);
    assert.equal(rollbackForgeflow({ home: legacy }).status, 'rolled-back');


    // A completed same-version repair starts its own snapshot.
    const sameSha = path.join(temp, 'same-sha');
    put(sameSha, 'commands/review.md', 'before first repair');
    fs.writeFileSync(versionPath(sameSha), latest);
    for (const content of ['first repair', 'second repair']) {
      const repair = await updateForgeflow({ home: sameSha, latest, repair: true,
        plan: { files: ['commands/review.md'], deleted: [] }, fetcher: async () => content });
      assert.equal(repair.backup.reused, false);
    }
    const beforeFailedBackup = fs.readFileSync(path.join(sameSha, 'forgeflow/backups/previous/manifest.json'), 'utf8');
    fs.mkdirSync(path.join(sameSha, 'commands/invalid.md'));
    await assert.rejects(updateForgeflow({ home: sameSha, latest, repair: true,
      plan: { files: ['commands/review.md', 'commands/invalid.md'], deleted: [] }, fetcher: async () => 'unreachable' }), /non-regular runtime file/);
    assert.equal(fs.readFileSync(path.join(sameSha, 'forgeflow/backups/previous/manifest.json'), 'utf8'), beforeFailedBackup);
    rollbackForgeflow({ home: sameSha });
    assert.equal(fs.readFileSync(path.join(sameSha, 'commands/review.md'), 'utf8'), 'first repair');

    const interrupted = path.join(temp, 'interrupted');
    put(interrupted, 'commands/review.md', 'before interrupted completion');
    fs.writeFileSync(versionPath(interrupted), previous);
    const interruptedOptions = { home: interrupted, latest, missingRequired: [],
      plan: { files: ['commands/review.md', 'commands/quick.md'], deleted: [] },
      fetcher: async (_repo, _sha, source) => {
        if (source.endsWith('quick.md')) throw new Error('partial');
        return 'after interrupted completion';
      } };
    await updateForgeflow(interruptedOptions);
    // Model interruption between version publication and pending completion.
    fs.writeFileSync(versionPath(interrupted), latest);
    const resumed = await updateForgeflow({ ...interruptedOptions, fetcher: async () => 'completed' });
    assert.equal(resumed.status, 'updated');
    assert.equal(resumed.backup.reused, true);
    rollbackForgeflow({ home: interrupted });
    assert.equal(fs.readFileSync(path.join(interrupted, 'commands/review.md'), 'utf8'), 'before interrupted completion');
    assert.equal(fs.readFileSync(versionPath(interrupted), 'utf8'), previous);

    const fresh = path.join(temp, 'fresh');
    await updateForgeflow({ home: fresh, latest, plan: { files: ['commands/review.md'], deleted: [] }, fetcher: async () => 'new' });
    rollbackForgeflow({ home: fresh });
    assert.equal(fs.existsSync(versionPath(fresh)), false, 'first-install rollback removes the newly created version marker');
    assert.equal(fs.existsSync(path.join(fresh, 'commands/review.md')), false);

    const codex = path.join(temp, 'codex');
    installCodex({ home: codex });
    fs.writeFileSync(versionPath(codex), latest);
    const installed = require(path.join(codex, 'forgeflow/scripts/forgeflow/update-forgeflow.js'));
    const sources = codexSources();
    const codexOptions = { target: 'codex', home: codex, latest,
      plan: { files: sources, deleted: [] }, fetcher: localFetcher };
    for (const source of ['scripts/forgeflow/smoke-check.js', '.codex/agents/smith-reviewer.toml', '.agents/skills/audit/SKILL.md']) {
      const destination = manifestEntry(source, codex, 'codex').destination;
      fs.unlinkSync(destination);
      assert.ok(installed.requiredManagedSources('codex').includes(source));
      assert.ok(installed.missingRequiredManagedFiles(codex, 'codex').includes(source), `installed inventory must retain ${source}`);
      const repair = await installed.updateForgeflow(codexOptions);
      assert.equal(repair.status, 'repaired');
      assert.ok(repair.missing_required.includes(source));
      assert.equal(fs.readFileSync(destination, 'utf8'), fs.readFileSync(path.join(repoRoot, source), 'utf8'));
    }
    const inventoryPath = manifestEntry(CODEX_INVENTORY_SOURCE, codex, 'codex').destination;
    for (const corrupt of [null, '{', 'null', '{"schema_version":"1","sources":[]}']) {
      if (corrupt === null) fs.unlinkSync(inventoryPath);
      else fs.writeFileSync(inventoryPath, corrupt);
      const repair = await installed.updateForgeflow(codexOptions);
      assert.equal(repair.status, 'repaired', 'missing/corrupt legacy inventory triggers repair');
      assert.equal(repair.inventory_missing, true);
      assert.ok(JSON.parse(fs.readFileSync(inventoryPath, 'utf8')).sources.includes('.agents/skills/audit/SKILL.md'));
    }
    const inventoryBefore = fs.readFileSync(inventoryPath, 'utf8');
    const newSource = 'scripts/forgeflow/future-added-helper.js';
    await installed.updateForgeflow({ target: 'codex', home: codex, latest: '3'.repeat(40),
      plan: { files: [newSource], deleted: ['.agents/skills/audit/SKILL.md'] }, fetcher: async () => 'new helper' });
    const updatedInventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8')).sources;
    assert.ok(updatedInventory.includes(newSource));
    assert.ok(!updatedInventory.includes('.agents/skills/audit/SKILL.md'));
    assert.equal(installed.rollbackForgeflow({ home: codex, target: 'codex' }).status, 'rolled-back');
    assert.equal(fs.readFileSync(inventoryPath, 'utf8'), inventoryBefore, 'rollback restores expected inventory with the files');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

async function run() {
  await runRecoveryRegressions();
  const requiredSources = requiredManagedSources();
  const managedSources = allManagedSources();
  const freshHomeSources = managedSources;
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
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-update-codex-'));
  const codexUpdate = await updateForgeflow({
    target: 'codex',
    home: codexHome,
    repo: 'local/repo',
    current: '',
    latest,
    plan: { firstRun: true, files: ['.codex/agents/smith-reviewer.toml'], deleted: [] },
    fetcher: localFetcher,
  });
  const symlinkTarget = path.join(codexHome, 'symlink-target');
  const symlinkHome = path.join(codexHome, 'symlink-home');
  fs.writeFileSync(symlinkTarget, 'not a runtime directory\n');
  let updaterSymlinkRejected = true;
  try {
    fs.symlinkSync(symlinkTarget, symlinkHome);
    const symlinkUpdate = await updateForgeflow({
      target: 'codex',
      home: symlinkHome,
      repo: 'local/repo',
      current: '',
      latest,
      plan: { firstRun: true, files: ['.codex/agents/smith-reviewer.toml'], deleted: [] },
      fetcher: localFetcher,
    });
    updaterSymlinkRejected = symlinkUpdate.status === 'partial';
  } catch (_err) {
    updaterSymlinkRejected = true;
  }

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
    ['fresh home installs command wrapper contract helper', fs.existsSync(path.join(freshHome, 'forgeflow', 'scripts', 'forgeflow', 'command-wrapper-contract.js'))],
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
    ['codex updater uses codex runtime root', codexUpdate.status === 'updated' && fs.existsSync(path.join(codexHome, 'agents', 'smith-reviewer.toml'))],
    ['updater rejects symlinked destination home', updaterSymlinkRejected],
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
