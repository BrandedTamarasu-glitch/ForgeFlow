#!/usr/bin/env node
const path = require('path');
const {
  HOST_ADAPTERS,
  buildLeanHostAdapters,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-host-adapters');

const root = path.resolve(__dirname, '..', '..');
const result = buildLeanHostAdapters({ root });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--json']);

const checks = [
  ['host adapter validation passes', result.status === 'pass' && result.summary.adapters === HOST_ADAPTERS.length],
  ['covers plugin and instruction tiers', result.adapters.some((item) => item.tier === 'plugin') && result.adapters.some((item) => item.tier === 'instruction')],
  ['checks opencode adapter', result.adapters.some((item) => item.host === 'OpenCode' && item.status === 'pass')],
  ['renders markdown', markdown.includes('# Forgeflow Lean Host Adapters') && markdown.includes('OpenClaw')],
  ['parses args', opts.root === root && opts.json],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
async function verifyOpenCodeDefaults() {
  const assert = require('assert');
  const fs = require('fs');
  const os = require('os');
  const { pathToFileURL } = require('url');
  const { buildLeanSession } = require('./render-lean-session');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-opencode-defaults-'));
  const names = ['FORGEFLOW_CONFIG_HOME', 'XDG_CONFIG_HOME', 'FORGEFLOW_LEAN_DEFAULT_MODE'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    process.env.FORGEFLOW_CONFIG_HOME = path.join(temp, 'canonical-config');
    process.env.XDG_CONFIG_HOME = path.join(temp, 'other-config');
    delete process.env.FORGEFLOW_LEAN_DEFAULT_MODE;
    const workspace = path.join(temp, 'actual-workspace');
    const nested = path.join(workspace, 'src');
    fs.mkdirSync(nested, { recursive: true });
    const config = path.join(process.env.FORGEFLOW_CONFIG_HOME, 'forgeflow');
    fs.mkdirSync(config, { recursive: true });
    const policy = path.join(workspace, '.forgeflow', path.basename(workspace), 'context', 'lean-policy.json');
    fs.mkdirSync(path.dirname(policy), { recursive: true });
    const plugin = (await import(pathToFileURL(path.join(root, '.opencode/plugins/forgeflow-lean.mjs')).href)).default;
    const hooks = await plugin({ directory: nested, worktree: workspace });
    async function assertProfile(profile) {
      const output = { system: ['original host instructions'] };
      await hooks['experimental.chat.system.transform']({}, output);
      assert.deepStrictEqual(output.system, profile === 'off'
        ? ['original host instructions']
        : ['original host instructions', buildLeanSession({ root: workspace, profile }).instructions]);
    }
    await assertProfile('balanced');
    process.env.FORGEFLOW_LEAN_DEFAULT_MODE = 'off';
    await assertProfile('off');
    delete process.env.FORGEFLOW_LEAN_DEFAULT_MODE;
    fs.writeFileSync(path.join(config, 'lean.json'), JSON.stringify({ profile: 'off' }));
    await assertProfile('off');
    fs.writeFileSync(path.join(config, 'lean.json'), JSON.stringify({ profile: 'balanced' }));
    fs.writeFileSync(policy, JSON.stringify({ profile: 'off' }));
    await assertProfile('off');
    const directoryOnly = await plugin({ directory: workspace });
    const offOutput = { system: [] };
    await directoryOnly['experimental.chat.system.transform']({}, offOutput);
    assert.deepStrictEqual(offOutput.system, []);
    await hooks['command.execute.before']({ command: 'forgeflow-lean-mode', arguments: 'strict' });
    assert.strictEqual(fs.readFileSync(path.join(config, 'lean-active'), 'utf8'), 'strict');
    await assertProfile('strict');
    await hooks['command.execute.before']({ command: 'forgeflow-lean', arguments: 'off' });
    await assertProfile('off');
    fs.unlinkSync(path.join(config, 'lean-active'));
    process.env.FORGEFLOW_LEAN_DEFAULT_MODE = 'off';
    fs.writeFileSync(policy, JSON.stringify({ profile: 'lite' }));
    await assertProfile('lite'); // Canonical project policy precedes environment.
    console.log('lean host adapters: ok');
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
verifyOpenCodeDefaults().catch((error) => { console.error(error); process.exitCode = 1; });
