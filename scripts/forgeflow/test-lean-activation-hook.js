#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-hook-'));
const stateDir = path.join(temp, 'state');
process.env.FORGEFLOW_LEAN_STATE_DIR = stateDir;
const hook = require('../../hooks/forgeflow-lean-activate');

hook.writeState('lite', 'test');
const state = JSON.parse(fs.readFileSync(path.join(stateDir, 'lean-active.json'), 'utf8'));
hook.clearState();
const cleared = !fs.existsSync(path.join(stateDir, 'lean-active.json'));
delete process.env.FORGEFLOW_LEAN_STATE_DIR;

const checks = [
  ['session writes state', state.profile === 'lite'],
  ['normal mode clears state', cleared],
  ['prompt parser supports shorthand', hook.profileFromPrompt('@lean strict') === 'strict'],
  ['prompt parser supports command flag', hook.profileFromPrompt('/forgeflow-lean-mode --profile ultra') === 'ultra'],
  ['prompt parser supports off phrase', hook.profileFromPrompt('normal mode') === 'off'],
  ['hook event parser supports snake case', hook.hookEventName({ hook_event_name: 'SessionStart' }) === 'SessionStart'],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('lean activation hook: ok');
