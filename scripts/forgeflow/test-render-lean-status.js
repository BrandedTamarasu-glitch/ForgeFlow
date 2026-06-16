#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildLeanStatus, effectivePolicy, parseArgs, renderMarkdown } = require('./render-lean-status');

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-status-'));
  fs.mkdirSync(path.join(root, 'scripts', 'forgeflow'), { recursive: true });
  fs.mkdirSync(path.join(root, 'commands'), { recursive: true });
  for (const helper of ['render-lean-decision.js', 'render-lean-mode.js', 'render-lean-report.js', 'render-lean-review.js']) {
    const file = path.join(root, 'scripts', 'forgeflow', helper);
    fs.writeFileSync(file, '#!/usr/bin/env node\n');
    fs.chmodSync(file, 0o755);
  }
  fs.writeFileSync(path.join(root, 'commands', 'consult.md'), 'render-lean-decision.js LEAN_DECISION_PATH\n');
  fs.writeFileSync(path.join(root, 'commands', 'implement.md'), 'render-lean-decision.js record-implementation-notes.js --lean-decision\n');
  fs.writeFileSync(path.join(root, 'commands', 'review.md'), 'render-lean-review.js Lean Review Advisory\n');
  fs.writeFileSync(path.join(root, 'commands', 'ship.md'), 'Lean readiness advisory LEAN_DECISION_JSON_PATH\n');
  return root;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function seedReady(projectDir) {
  writeJson(path.join(projectDir, 'context', 'lean-policy.json'), { profile: 'strict', enabled: true });
  writeJson(path.join(projectDir, 'context', 'lean-decision.json'), { status: 'ready' });
  writeJson(path.join(projectDir, 'context', 'lean-report.json'), {
    status: 'ready',
    lean_decision: 'continue-dogfood',
    signals: { telemetry: { status: 'ready' } },
  });
  writeJson(path.join(projectDir, 'context', 'latest', 'latest-insights-report.json'), { status: 'injected' });
  writeJson(path.join(projectDir, 'context', 'latest', 'user-profile-report.json'), { check: { status: 'pass' } });
  writeJson(path.join(projectDir, 'context', 'project-operating-model.json'), { status: 'ready' });
}

const root = makeRoot();
const projectDir = path.join(root, '.forgeflow', 'Demo');
seedReady(projectDir);
const active = buildLeanStatus({ root, projectDir });
const markdown = renderMarkdown(active);

const blockedRoot = makeRoot();
const blockedProject = path.join(blockedRoot, '.forgeflow', 'Demo');
writeJson(path.join(blockedProject, 'context', 'lean-policy.json'), { profile: 'balanced', enabled: true });
const blocked = buildLeanStatus({ root: blockedRoot, projectDir: blockedProject });

const offRoot = makeRoot();
const offProject = path.join(offRoot, '.forgeflow', 'Demo');
writeJson(path.join(offProject, 'context', 'lean-policy.json'), { profile: 'off', enabled: false });
const off = buildLeanStatus({ root: offRoot, projectDir: offProject });

const liteRoot = makeRoot();
const liteProject = path.join(liteRoot, '.forgeflow', 'Demo');
writeJson(path.join(liteProject, 'context', 'lean-policy.json'), { profile: 'lite', enabled: true });
const lite = buildLeanStatus({ root: liteRoot, projectDir: liteProject });

const missingRoot = makeRoot();
fs.unlinkSync(path.join(missingRoot, 'scripts', 'forgeflow', 'render-lean-review.js'));
const missing = buildLeanStatus({ root: missingRoot, projectDir: path.join(missingRoot, '.forgeflow', 'Demo') });
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--json']);

const checks = [
  ['active when all gates pass', active.status === 'active' && active.injection_eligible && active.next === '/review'],
  ['active uses persisted policy', active.lean_mode === 'strict' && active.sources.policy.status === 'present'],
  ['renders markdown gates', markdown.includes('Context injection eligible: yes') && markdown.includes('lean_report_ready: pass')],
  ['blocked reports missing decision next action', blocked.status === 'blocked' && blocked.gates.lean_decision_present === false && blocked.next.includes('/forgeflow-lean-decision')],
  ['off reports re-enable action', off.status === 'off' && off.enabled === false && off.next.includes('/forgeflow-lean-mode --profile balanced --write')],
  ['lite policy is recognized', lite.lean_mode === 'lite' && lite.enabled === true],
  ['missing helper recommends repair', missing.status === 'attention' && missing.missing_helpers.includes('leanReview') && missing.next === '/update-forgeflow --repair'],
  ['invalid profile falls back to balanced but invalid source blocks', effectivePolicy({ status: 'invalid', value: { profile: 'bogus' } }).profile === 'balanced' && effectivePolicy({ status: 'invalid', value: { profile: 'bogus' } }).valid === false],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.json],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error(`FAIL: ${name}`);
  process.exit(1);
}

console.log('lean status: ok');
