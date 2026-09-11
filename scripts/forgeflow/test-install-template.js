#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { inspectRtk, setupRtk } = require('./rtk-setup');
const {
  codexDestination,
  codexSources,
  installTemplate,
  isRegularSourceFile,
  parseArgs,
} = require('./install-template');

function rtkRunner(initial, installStatus = 0) {
  let state = initial;
  const calls = [];
  const run = (command, args, options) => {
    calls.push({ command, args, options });
    if (command === 'cargo') {
      if (installStatus === 0) state = 'ready';
      return { status: installStatus, stdout: '', stderr: '' };
    }
    if (state === 'missing') return { status: null, error: { code: 'ENOENT' } };
    if (state === 'timeout') return { status: null, error: { code: 'ETIMEDOUT' } };
    if (args[0] === '--version') return { status: 0, stdout: 'rtk 0.48.0\n' };
    return { status: state === 'wrong' ? 2 : 0, stdout: 'private savings history' };
  };
  return { run, calls };
}

const readyRtk = rtkRunner('ready');
assert.strictEqual(setupRtk({ install: true, run: readyRtk.run }).status, 'ready');
assert.deepStrictEqual(readyRtk.calls.map((call) => call.args), [['--version'], ['gain']]);
assert(readyRtk.calls.every((call) => call.options.timeout === 5000));
const missingRtk = rtkRunner('missing');
assert.strictEqual(setupRtk({ run: missingRtk.run }).status, 'missing');
assert(!missingRtk.calls.some((call) => call.command === 'cargo'), 'ordinary setup must not install RTK');
const previewRtk = rtkRunner('missing');
const rtkPlan = setupRtk({ install: true, dryRun: true, run: previewRtk.run });
assert.strictEqual(rtkPlan.status, 'planned');
assert(!previewRtk.calls.some((call) => call.command === 'cargo'), 'dry run must not install RTK');
const installRtk = rtkRunner('missing');
const installedRtk = setupRtk({ install: true, run: installRtk.run });
assert.strictEqual(installedRtk.status, 'ready');
assert.strictEqual(installedRtk.installed, true);
assert.deepStrictEqual(installRtk.calls.find((call) => call.command === 'cargo').args, rtkPlan.command.slice(1));
assert(rtkPlan.command.includes('https://github.com/rtk-ai/rtk') && rtkPlan.command.includes('--locked'));
const wrongRtk = rtkRunner('wrong');
assert.strictEqual(setupRtk({ install: true, run: wrongRtk.run }).status, 'unverified');
assert(!wrongRtk.calls.some((call) => call.command === 'cargo'), 'unverified binaries must not be overwritten');
assert.strictEqual(inspectRtk({ run: rtkRunner('timeout').run }).status, 'unverified');
assert.strictEqual(setupRtk({ install: true, run: rtkRunner('missing', 1).run }).status, 'failed');
const offPathCalls = [];
const offPath = setupRtk({ install: true, run: (command, args) => {
  offPathCalls.push(command);
  if (command === 'rtk') return { error: { code: 'ENOENT' } };
  return { status: 0, stdout: args[0] === '--version' ? 'rtk 0.48.0' : '' };
} });
assert.strictEqual(offPath.status, 'path-required');
assert(!offPathCalls.includes('cargo'), 'an existing Cargo installation needs PATH guidance, not reinstallation');
const unverifiableInstall = setupRtk({ install: true, run: (command) => command === 'cargo'
  ? { status: 0 } : { error: { code: 'ENOENT' } } });
assert.strictEqual(unverifiableInstall.status, 'failed', 'Cargo success alone cannot claim a working RTK');
assert.strictEqual(inspectRtk({ run: () => ({ status: 0, stdout: 'Some Other Tool 1.2.3' }) }).status, 'unverified');
assert(!JSON.stringify(installedRtk).includes('private savings history'));
assert.strictEqual(parseArgs(['--target', 'codex', '--install-rtk', '--dry-run']).installRtk, true);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-template-install-'));
const claudeHome = path.join(root, 'claude');
const codexHome = path.join(root, 'codex');
const dryClaudeHome = path.join(root, 'dry-claude');
const dryCodexHome = path.join(root, 'dry-codex');

const result = installTemplate({ target: 'both', claudeHome, codexHome });
const codexResult = result.results.find((item) => item.target === 'codex');
const dryRun = installTemplate({
  target: 'both',
  claudeHome: dryClaudeHome,
  codexHome: dryCodexHome,
  dryRun: true,
  installRtk: true,
  rtkRun: rtkRunner('missing').run,
});
assert.strictEqual(dryRun.rtk.status, 'planned');
const incompleteRtk = installTemplate({ target: 'codex', codexHome: dryCodexHome, dryRun: true, installRtk: true, rtkRun: rtkRunner('wrong').run });
assert.strictEqual(incompleteRtk.status, 'attention');

const codexAgent = path.join(codexHome, 'agents', 'builder-reviewer.toml');
const codexSkill = path.join(codexHome, 'skills', 'forgeflow-review', 'SKILL.md');
const codexMap = path.join(codexHome, 'forgeflow', 'agent-canonical-map.json');
const codexHelper = path.join(codexHome, 'forgeflow', 'scripts', 'forgeflow', 'health-check.js');
const codexShellHelper = path.join(codexHome, 'forgeflow', 'scripts', 'forgeflow', 'ensure-forgeflow-state.sh');
const codexTemplate = path.join(codexHome, 'forgeflow', 'templates', 'ship-presentation.html');
const codexPattern = path.join(codexHome, 'forgeflow', 'forgeflow-patterns', 'recurring-blockers.md');
const claudeCommand = path.join(claudeHome, 'commands', 'review.md');
const claudeHelper = path.join(claudeHome, 'forgeflow', 'scripts', 'forgeflow', 'health-check.js');
const regularSource = path.join(root, 'regular.txt');
const symlinkSource = path.join(root, 'symlink.txt');
fs.writeFileSync(regularSource, 'regular\n');
let symlinkCreated = false;
try {
  fs.symlinkSync(regularSource, symlinkSource);
  symlinkCreated = true;
} catch (_err) {
  symlinkCreated = false;
}
const symlinkHome = path.join(root, 'symlink-home');
let destinationSymlinkRejected = false;
if (symlinkCreated) {
  fs.symlinkSync(regularSource, symlinkHome);
  try {
    installTemplate({ target: 'codex', codexHome: symlinkHome });
  } catch (err) {
    destinationSymlinkRejected = String(err.message).includes('symlinked runtime destination');
  }
}

const checks = [
  ['both targets installed', result.results.length === 2],
  ['claude command installed', fs.existsSync(claudeCommand)],
  ['claude helper installed', fs.existsSync(claudeHelper)],
  ['both runtimes include the dashboard and its auth helper', [claudeHome, codexHome].every(home =>
    ['services/dashboard/server.js', 'services/dashboard/public/ember.js', 'services/dashboard/public/ember.css',
      'services/dashboard/package.json', 'services/dashboard/public/dashboard.js', 'services/dashboard/public/dashboard.css',
      'services/agent-chat/server.js', 'services/agent-chat/client.js', 'services/agent-chat/package.json', 'services/agent-chat/session-auth.js', 'scripts/forgeflow/open-session-dashboard.js']
      .every(file => fs.existsSync(path.join(home, 'forgeflow', file))))],

  ['codex agent installed', fs.existsSync(codexAgent)],
  ['codex skill installed', fs.existsSync(codexSkill)],
  ['codex map installed', fs.existsSync(codexMap)],
  ['codex runtime helper installed', fs.existsSync(codexHelper)],
  ['both runtimes include RTK setup', [claudeHome, codexHome].every((home) => fs.existsSync(path.join(home, 'forgeflow/scripts/forgeflow/rtk-setup.js')))],
  ['codex shell helper is executable', (fs.statSync(codexShellHelper).mode & 0o111) !== 0],
  ['codex template installed', fs.existsSync(codexTemplate)],
  ['codex pattern installed', fs.existsSync(codexPattern)],
  ['codex sources include agents', codexSources().includes('.codex/agents/builder-reviewer.toml')],
  ['codex sources include skills', codexSources().includes('.agents/skills/forgeflow-review/SKILL.md')],
  ['codex sources include runtime helpers', codexSources().includes('scripts/forgeflow/health-check.js')],
  ['codex destination maps agent home', codexDestination('.codex/agents/builder-reviewer.toml', '/tmp/codex') === '/tmp/codex/agents/builder-reviewer.toml'],
  ['codex destination maps runtime root', codexDestination('scripts/forgeflow/health-check.js', '/tmp/codex') === '/tmp/codex/forgeflow/scripts/forgeflow/health-check.js'],
  ['codex inventory reports full skill set', codexResult.skill_names.includes('research') && codexResult.skill_names.includes('forge-review') && codexResult.skill_names.includes('create-agent')],
  ['codex inventory reports agent fleet', codexResult.agent_names.includes('builder-reviewer') && codexResult.agent_names.includes('guardian-auditor')],
  ['codex inventory reports canonical entrypoints', codexResult.canonical_entrypoints.includes('consult') && codexResult.canonical_entrypoints.includes('forge-review')],
  ['regular source accepted', isRegularSourceFile(regularSource) === true],
  ['symlink source rejected', !symlinkCreated || isRegularSourceFile(symlinkSource) === false],
  ['symlink destination rejected', !symlinkCreated || destinationSymlinkRejected],
  ['dry run reports dry mode', dryRun.dry_run === true],
  ['dry run avoids writes', !fs.existsSync(dryClaudeHome) && !fs.existsSync(dryCodexHome)],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

if (failed > 0) process.exit(1);
console.log('install template: ok');
