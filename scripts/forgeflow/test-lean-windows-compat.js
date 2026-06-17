#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-win-'));
const stateDir = path.join(temp, 'state');
fs.mkdirSync(stateDir, { recursive: true });
fs.writeFileSync(path.join(stateDir, 'lean-active.json'), JSON.stringify({ profile: 'strict' }));

const statusline = spawnSync(process.execPath, [path.join(root, 'hooks', 'forgeflow-statusline.js')], {
  cwd: root,
  env: { ...process.env, FORGEFLOW_LEAN_STATE_DIR: stateDir, USERPROFILE: path.join(temp, 'User') },
  input: `${JSON.stringify({
    session_id: 'win-session',
    context_window: { remaining_percentage: 75 },
    model: { display_name: 'Claude' },
    workspace: { current_dir: root },
  })}\n`,
  encoding: 'utf8',
});

const hook = require('../../hooks/forgeflow-lean-activate');
const copilotHooks = JSON.parse(fs.readFileSync(path.join(root, 'hooks', 'copilot-hooks.json'), 'utf8'));
const previousState = process.env.FORGEFLOW_LEAN_STATE_DIR;
process.env.FORGEFLOW_LEAN_STATE_DIR = stateDir;
hook.writeState('lite', 'windows-test');
const state = JSON.parse(fs.readFileSync(path.join(stateDir, 'lean-active.json'), 'utf8'));
if (previousState === undefined) delete process.env.FORGEFLOW_LEAN_STATE_DIR;
else process.env.FORGEFLOW_LEAN_STATE_DIR = previousState;

const checks = [
  ['statusline exits cleanly or sandbox blocks nested spawn', statusline.status === 0 || statusline.error?.code === 'EPERM'],
  ['statusline shows lean badge when spawn is allowed', statusline.error?.code === 'EPERM' || /LEAN:STRICT/.test(statusline.stdout)],
  ['hook state write works with USERPROFILE env present', state.profile === 'lite'],
  ['state path stays in explicit state dir', fs.existsSync(path.join(stateDir, 'lean-active.json'))],
  ['copilot hook manifest has windows command', copilotHooks.hooks.sessionStart[0].powershell.includes('forgeflow-lean-activate.js')],
  ['copilot hook manifest has bash command', copilotHooks.hooks.userPromptSubmitted[0].bash.includes('forgeflow-lean-activate.js')],
];

fs.rmSync(temp, { recursive: true, force: true });

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('lean windows compat: ok');
