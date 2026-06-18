#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-host-install-'));

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

function copyTree(source, dest) {
  const full = path.join(root, source);
  if (!fs.existsSync(full)) return;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const from = path.join(full, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copyTree(path.relative(root, from), to);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

function simulatePlugin(pluginFile, hostName) {
  const plugin = readJson(pluginFile);
  const dest = path.join(temp, hostName);
  for (const [key, value] of Object.entries(plugin.components || {})) {
    if (typeof value === 'string') copyTree(value.replace(/\/$/, ''), path.join(dest, key));
  }
  if (plugin.commands) copyTree(plugin.commands.replace(/\/$/, ''), path.join(dest, 'commands'));
  if (plugin.skills) copyTree(plugin.skills.replace(/\/$/, ''), path.join(dest, 'skills'));
  if (typeof plugin.hooks === 'string') {
    const source = path.join(root, plugin.hooks);
    const target = path.join(dest, plugin.hooks);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  } else if (plugin.hooks && typeof plugin.hooks === 'object') {
    fs.mkdirSync(path.join(dest, 'hooks'), { recursive: true });
    fs.writeFileSync(path.join(dest, 'hooks', 'inline-hooks.json'), `${JSON.stringify(plugin.hooks, null, 2)}\n`);
  }
  return dest;
}

const claude = simulatePlugin('.claude-plugin/plugin.json', 'claude');
const codex = simulatePlugin('.codex-plugin/plugin.json', 'codex');
const copilot = simulatePlugin('.github/plugin/plugin.json', 'copilot');

const checks = [
  ['claude commands copied', fs.existsSync(path.join(claude, 'commands', 'forgeflow-lean-prime.md'))],
  ['claude hooks copied', fs.existsSync(path.join(claude, 'hooks', 'forgeflow-lean-activate.js'))],
  ['codex skills copied', fs.existsSync(path.join(codex, 'skills', 'forgeflow-lean', 'SKILL.md'))],
  ['copilot commands copied', fs.existsSync(path.join(copilot, 'commands', 'forgeflow-lean-skills.md'))],
  ['copilot skills copied', fs.existsSync(path.join(copilot, 'skills', 'forgeflow-lean-prime', 'SKILL.md'))],
  ['copilot hook manifest copied', fs.existsSync(path.join(copilot, 'hooks', 'copilot-hooks.json'))],
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
console.log('lean host install smoke: ok');
