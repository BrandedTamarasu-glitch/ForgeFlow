#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { installClaude, installCodex } = require('./install-template');
const { manifestEntry, CODEX_INVENTORY_SOURCE } = require('./install-manifest');
const { rollbackForgeflow, missingRequiredManagedFiles } = require('./update-forgeflow');
const { renderEntrypoints, replaceBlock, workflowBlock, WORKFLOWS, CODEX_SKILLS } = require('./render-capability-entrypoints');

const root = path.resolve(__dirname, '../..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-capability-packaging-'));
const caller = path.join(temporary, 'unrelated-project');
fs.mkdirSync(caller);
const guide = fs.readFileSync(path.join(root, 'forgeflow-patterns/capability-selection.md'), 'utf8');
function run(script, args, input) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: caller, input, encoding: 'utf8', timeout: 10000 });
  assert.ifError(result.error);
  return result;
}
try {
  assert.equal(renderEntrypoints({ root }).status, 'pass', 'committed entry points must match generator');
  const base = '---\nname: example\ndescription: example\n---\n\nKeep this unrelated instruction.\n';
  const once = replaceBlock(base, workflowBlock('plan'), 'example');
  assert.equal(replaceBlock(once, workflowBlock('plan'), 'example'), once, 'generation must be idempotent');
  assert.ok(replaceBlock(once, workflowBlock('implement'), 'example').endsWith('Keep this unrelated instruction.\n'));
  assert.throws(() => replaceBlock(`${base}\n<!-- forgeflow-capability-selection:start -->`, workflowBlock('plan'), 'example'), /Invalid capability markers/);

  const brokenRoot = path.join(temporary, 'generation');
  for (const entry of renderEntrypoints({ root }).entries) {
    const file = path.join(brokenRoot, entry.file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.copyFileSync(path.join(root, entry.file), file);
  }
  const brokenSkill = path.join(brokenRoot, '.agents/skills/forgeflow-capabilities/SKILL.md');
  fs.writeFileSync(brokenSkill, 'stale wrapper\n');
  assert.equal(renderEntrypoints({ root: brokenRoot }).status, 'drift');
  renderEntrypoints({ root: brokenRoot, write: true });
  assert.equal(renderEntrypoints({ root: brokenRoot }).status, 'pass');

  for (const target of ['claude', 'codex']) {
    const home = path.join(temporary, target);
    const install = target === 'claude' ? installClaude : installCodex;
    const installed = install({ home });
    if (target === 'codex') {
      assert.ok(installed.skill_names.includes('forgeflow-capabilities'));
      assert.ok(installed.canonical_entrypoints.includes('forgeflow-capabilities'));
    }
    assert.deepEqual(missingRequiredManagedFiles(home, target), [], `${target} missing installed files`);
    const entry = source => manifestEntry(source, home, target).destination;
    const selector = entry('scripts/forgeflow/select-capabilities.js');
    const pattern = entry('forgeflow-patterns/capability-selection.md');
    const procedure = entry('forgeflow-patterns/capability-change-propagation.md');
    const releaseProcedure = entry('forgeflow-patterns/capability-release-qualification.md');
    assert.equal(fs.readFileSync(releaseProcedure, 'utf8'), fs.readFileSync(path.join(root, 'forgeflow-patterns/capability-release-qualification.md'), 'utf8'));
    const releaseSelection = run(selector, ['--stdin'], JSON.stringify({ task: 'Verify the deployed artifact', phase: 'ship' }));
    assert.equal(releaseSelection.status, 0, releaseSelection.stderr);
    const releaseDecision = JSON.parse(releaseSelection.stdout).decisions.find(item => item.id === 'release-qualification');
    assert.equal(releaseDecision.decision, 'selected');
    assert.equal(releaseDecision.availability, 'evaluation');
    assert.equal(releaseDecision.executable, false);
    const providerProcedure = entry('forgeflow-patterns/capability-provider-compatibility.md');
    assert.equal(fs.readFileSync(providerProcedure, 'utf8'), fs.readFileSync(path.join(root, 'forgeflow-patterns/capability-provider-compatibility.md'), 'utf8'));
    const providerSelection = run(selector, ['--stdin'], JSON.stringify({ task: 'Fix external API response parsing', phase: 'implement' }));
    assert.equal(providerSelection.status, 0, providerSelection.stderr);
    const providerDecision = JSON.parse(providerSelection.stdout).decisions.find(item => item.id === 'provider-compatibility');
    assert.equal(providerDecision.decision, 'selected');
    assert.equal(providerDecision.availability, 'evaluation');
    assert.equal(providerDecision.executable, false);
    const calibrationProcedure = entry('forgeflow-patterns/capability-review-calibration.md');
    assert.equal(fs.readFileSync(calibrationProcedure, 'utf8'), fs.readFileSync(path.join(root, 'forgeflow-patterns/capability-review-calibration.md'), 'utf8'));
    const scoreReview = require(entry('scripts/forgeflow/score-review-calibration.js')).scoreReview;
    assert.equal(scoreReview({ observation: 'fixture', run_status: 'completed', expected: [{ id: 'missing', severity: 'high' }], findings: [] }).missed_defects, 1);
    const recoveryProcedure = entry('forgeflow-patterns/capability-persistence-recovery.md');
    assert.equal(fs.readFileSync(recoveryProcedure, 'utf8'), fs.readFileSync(path.join(root, 'forgeflow-patterns/capability-persistence-recovery.md'), 'utf8'));
    const recoverySelection = run(selector, ['--stdin'], JSON.stringify({ task: 'Fix storage recovery after interrupted saves', phase: 'implement' }));
    assert.equal(recoverySelection.status, 0, recoverySelection.stderr);
    const recoveryDecision = JSON.parse(recoverySelection.stdout).decisions.find(item => item.id === 'persistence-recovery');
    assert.equal(recoveryDecision.decision, 'selected');
    assert.equal(recoveryDecision.availability, 'evaluation');
    assert.equal(recoveryDecision.executable, false);
    const visualProcedure = entry('forgeflow-patterns/capability-visual-acceptance.md');
    assert.equal(fs.readFileSync(visualProcedure, 'utf8'), fs.readFileSync(path.join(root, 'forgeflow-patterns/capability-visual-acceptance.md'), 'utf8'));
    assert.equal(fs.readFileSync(procedure, 'utf8'), fs.readFileSync(path.join(root, 'forgeflow-patterns/capability-change-propagation.md'), 'utf8'));
    assert.ok(fs.existsSync(entry('scripts/forgeflow/check-change-propagation.js')));
    const wrapperSource = target === 'codex' ? '.agents/skills/forgeflow-capabilities/SKILL.md' : 'skills/forgeflow-capabilities/SKILL.md';
    const wrapper = entry(wrapperSource);
    assert.ok(fs.existsSync(wrapper), `${target} skill discovery file missing`);
    const workflowSources = target === 'claude'
      ? WORKFLOWS.map(phase => `commands/${phase}.md`)
      : Object.keys(CODEX_SKILLS).map(name => `.agents/skills/${name}/SKILL.md`);
    for (const source of workflowSources) assert.ok(fs.readFileSync(entry(source), 'utf8').includes('select-capabilities.js --guide'), `${target}: ${source} missing entry integration`);

    const guideResult = run(selector, ['--guide']);
    assert.equal(guideResult.status, 0, guideResult.stderr);
    assert.equal(guideResult.stdout, guide, `${target} must resolve canonical guide from unrelated cwd`);
    const selection = run(selector, ['--stdin'], JSON.stringify({ task: 'Fix currency rounding', phase: 'plan' }));
    assert.equal(selection.status, 0, selection.stderr);
    const parsed = JSON.parse(selection.stdout);
    assert.deepEqual(parsed.selected, ['money-calendar-correctness']);
    assert.ok(parsed.decisions.every(item => !item.executable), 'packaging cannot make planned procedures executable');
    assert.deepEqual(fs.readdirSync(caller), [], 'stdin selection and guide lookup must not write project state');
    const propagationRoot = path.join(temporary, `propagation-${target}`);
    fs.mkdirSync(propagationRoot);
    fs.writeFileSync(path.join(propagationRoot, 'source.txt'), 'current');
    fs.writeFileSync(path.join(propagationRoot, 'consumer.txt'), 'current');
    const impactFile = path.join(propagationRoot, 'impact.json');
    fs.writeFileSync(impactFile, JSON.stringify({ schema_version: '1', sources: [{ path: 'source.txt', sha256: crypto.createHash('sha256').update('current').digest('hex') }], consumers: [{ path: 'consumer.txt', sources: ['source.txt'], command: null, checks: [{ contains: 'current' }] }] }));
    const propagation = run(entry('scripts/forgeflow/check-change-propagation.js'), ['--root', propagationRoot, '--input', impactFile]);
    assert.equal(propagation.status, 0, propagation.stderr);
    assert.equal(JSON.parse(propagation.stdout).status, 'current');
    const oversized = run(selector, ['--stdin'], ' '.repeat(100001));
    assert.equal(oversized.status, 1);
    assert.match(oversized.stderr, /too large/);
    if (target === 'codex') {
      const inventory = JSON.parse(fs.readFileSync(entry(CODEX_INVENTORY_SOURCE), 'utf8'));
      assert.ok(inventory.sources.includes(wrapperSource));
      assert.ok(inventory.sources.includes('forgeflow-patterns/capability-selection.md'));
    }

    // A simulated older local installation is updated, then restored exactly.
    const originals = new Map();
    for (const file of [selector, pattern, procedure, visualProcedure, recoveryProcedure, calibrationProcedure, providerProcedure, releaseProcedure, entry('scripts/forgeflow/score-review-calibration.js'), wrapper]) {
      const suffix = file.endsWith('.js') ? '\n// previous local fixture version\n' : '\nPrevious local fixture version.\n';
      fs.appendFileSync(file, suffix);
      originals.set(file, fs.readFileSync(file));
    }
    install({ home });
    assert.equal(fs.readFileSync(pattern, 'utf8'), guide);
    assert.deepEqual(install({ home }).copied, [], 'unchanged reinstall must preserve rollback snapshot');
    const rollback = rollbackForgeflow({ home, target });
    assert.equal(rollback.status, 'rolled-back', JSON.stringify(rollback.failed));
    for (const [file, before] of originals) assert.ok(fs.readFileSync(file).equals(before), `${target} did not restore ${path.basename(file)}`);
    fs.unlinkSync(pattern);
    const missing = run(selector, ['--guide']);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /guide is unavailable/);
    console.log(`${target} capability install/update/rollback: ok`);
  }

  const claudePlugin = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin/plugin.json'), 'utf8'));
  assert.ok(fs.existsSync(path.join(root, claudePlugin.components.skills, 'forgeflow-capabilities/SKILL.md')));
  const codexPlugin = JSON.parse(fs.readFileSync(path.join(root, '.codex-plugin/plugin.json'), 'utf8'));
  assert.equal(codexPlugin.components.skills, '.openclaw/skills/');
  assert.ok(!fs.existsSync(path.join(root, codexPlugin.components.skills, 'forgeflow-capabilities/SKILL.md')), 'lean-only plugin must not be advertised as full capability installation');
  console.log('capability discovery declarations and generated entrypoints: ok');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
