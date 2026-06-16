#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  configDir,
  normalizeProfile,
  resolveLeanProfile,
  userLeanConfigPath,
  writeUserLeanConfig,
} = require('./lean-config');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-config-'));
const projectDir = path.join(root, '.forgeflow', 'Demo');
const home = path.join(root, 'home');
const env = { XDG_CONFIG_HOME: path.join(root, 'xdg') };
fs.mkdirSync(path.join(projectDir, 'context'), { recursive: true });

const requested = resolveLeanProfile({ root, projectDir, profile: 'ultra', env, homedir: home });
const noConfig = resolveLeanProfile({ root, projectDir, env, homedir: home });
writeUserLeanConfig('strict', { env, homedir: home });
const fromUser = resolveLeanProfile({ root, projectDir, env, homedir: home });
process.env.FORGEFLOW_LEAN_DEFAULT_MODE = 'lite';
const fromEnv = resolveLeanProfile({ root, projectDir, homedir: home });
delete process.env.FORGEFLOW_LEAN_DEFAULT_MODE;
fs.writeFileSync(path.join(projectDir, 'context', 'lean-policy.json'), JSON.stringify({ profile: 'balanced' }, null, 2));
const fromProject = resolveLeanProfile({ root, projectDir, env, homedir: home });
fs.writeFileSync(path.join(projectDir, 'context', 'lean-policy.json'), JSON.stringify({ profile: 'wat' }, null, 2));
const invalidProject = resolveLeanProfile({ root, projectDir, env, homedir: home });

const checks = [
  ['normalizes valid profile', normalizeProfile(' Lite ') === 'lite'],
  ['config dir uses xdg', configDir(env, 'linux', home) === path.join(root, 'xdg', 'forgeflow')],
  ['user path ends in lean json', userLeanConfigPath({ env, homedir: home }).endsWith(path.join('forgeflow', 'lean.json'))],
  ['requested wins', requested.profile === 'ultra' && requested.source === 'requested'],
  ['default before config is balanced', noConfig.profile === 'balanced' && noConfig.source === 'default'],
  ['user config resolves', fromUser.profile === 'strict' && fromUser.source === 'user-config'],
  ['env beats user config', fromEnv.profile === 'lite' && fromEnv.source === 'FORGEFLOW_LEAN_DEFAULT_MODE'],
  ['project beats user config', fromProject.profile === 'balanced' && fromProject.source === 'project-policy'],
  ['invalid project policy falls back safely', invalidProject.profile === 'balanced' && invalidProject.source === 'invalid-project-policy'],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('lean config: ok');
