#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  codexDestination,
  codexSources,
  installTemplate,
  isRegularSourceFile,
} = require('./install-template');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-template-install-'));
const claudeHome = path.join(root, 'claude');
const codexHome = path.join(root, 'codex');
const dryClaudeHome = path.join(root, 'dry-claude');
const dryCodexHome = path.join(root, 'dry-codex');

const result = installTemplate({ target: 'both', claudeHome, codexHome });
const dryRun = installTemplate({
  target: 'both',
  claudeHome: dryClaudeHome,
  codexHome: dryCodexHome,
  dryRun: true,
});

const codexAgent = path.join(codexHome, 'agents', 'smith-reviewer.toml');
const codexSkill = path.join(codexHome, 'skills', 'forgeflow-review', 'SKILL.md');
const codexMap = path.join(codexHome, 'forgeflow', 'agent-canonical-map.json');
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

const checks = [
  ['both targets installed', result.results.length === 2],
  ['claude command installed', fs.existsSync(claudeCommand)],
  ['claude helper installed', fs.existsSync(claudeHelper)],
  ['codex agent installed', fs.existsSync(codexAgent)],
  ['codex skill installed', fs.existsSync(codexSkill)],
  ['codex map installed', fs.existsSync(codexMap)],
  ['codex sources include agents', codexSources().includes('.codex/agents/smith-reviewer.toml')],
  ['codex sources include skills', codexSources().includes('.agents/skills/forgeflow-review/SKILL.md')],
  ['codex destination maps agent home', codexDestination('.codex/agents/smith-reviewer.toml', '/tmp/codex') === '/tmp/codex/agents/smith-reviewer.toml'],
  ['regular source accepted', isRegularSourceFile(regularSource) === true],
  ['symlink source rejected', !symlinkCreated || isRegularSourceFile(symlinkSource) === false],
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
