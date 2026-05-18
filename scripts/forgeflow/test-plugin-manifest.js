#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const {
  RUNTIME_HELPERS,
  destinationFor,
  isManagedSource,
} = require('./install-manifest');

const repoRoot = path.resolve(__dirname, '..', '..');
const plugin = JSON.parse(fs.readFileSync(path.join(repoRoot, '.claude-plugin', 'plugin.json'), 'utf8'));
const marketplace = JSON.parse(fs.readFileSync(path.join(repoRoot, '.claude-plugin', 'marketplace.json'), 'utf8'));
const entry = marketplace.plugins.find((item) => item.name === plugin.name);

const requiredDestinations = {
  'agents/*.md': '~/.claude/agents/',
  'agents/_shared/*.md': '~/.claude/agents/_shared/',
  'commands/*.md': '~/.claude/commands/',
  'commands/*/*.md': '~/.claude/commands/',
  'hooks/*.js': '~/.claude/hooks/',
  'templates/*': '~/.claude/templates/',
  'project-rules/*.md': '~/.claude/project-rules/',
  'forgeflow-patterns/*.md': '~/.claude/forgeflow-patterns/',
  'scripts/forgeflow/*.js': '~/.claude/forgeflow/scripts/forgeflow/',
  'scripts/forgeflow/*.sh': '~/.claude/forgeflow/scripts/forgeflow/',
};

const checks = [
  ['plugin name', plugin.name === 'Forgeflow'],
  ['plugin version present', /^\d+\.\d+\.\d+$/.test(plugin.version)],
  ['marketplace entry present', Boolean(entry)],
  ['marketplace version matches plugin', entry && entry.version === plugin.version],
  ['repository points to ForgeFlow', plugin.repository?.url === 'https://github.com/BrandedTamarasu-glitch/ForgeFlow.git'],
  ['marketplace source repo matches', entry?.source?.repo === 'BrandedTamarasu-glitch/ForgeFlow'],
  ['custom agents preserved', (plugin.install?.preserve || []).includes('~/.claude/agents/custom-*.md')],
  ['test helpers excluded', (plugin.install?.exclude || []).includes('scripts/forgeflow/test-*')],
  ['post-install has version verify', (plugin.install?.['post-install']?.verify || []).includes('/forgeflow-version')],
  ['post-install has health verify', (plugin.install?.['post-install']?.verify || []).includes('/forgeflow-health')],
  ['statusline manual setting documented', plugin.install?.['post-install']?.['manual-settings']?.['statusLine.command']?.includes('forgeflow-statusline.js')],
  ['runtime helper list includes version helper', RUNTIME_HELPERS.includes('scripts/forgeflow/forgeflow-version.js')],
  ['manifest maps version helper to installed helper root', destinationFor('scripts/forgeflow/forgeflow-version.js') === '~/.claude/forgeflow/scripts/forgeflow/forgeflow-version.js'],
  ['test helper not managed', !isManagedSource('scripts/forgeflow/test-plugin-manifest.js')],
];

for (const [glob, dest] of Object.entries(requiredDestinations)) {
  checks.push([`destination ${glob}`, plugin.install?.destinations?.[glob] === dest]);
}

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

if (failed > 0) process.exit(1);
console.log('plugin manifest: ok');
