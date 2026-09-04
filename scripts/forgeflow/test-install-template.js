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
const codexResult = result.results.find((item) => item.target === 'codex');
const dryRun = installTemplate({
  target: 'both',
  claudeHome: dryClaudeHome,
  codexHome: dryCodexHome,
  dryRun: true,
});

const codexAgent = path.join(codexHome, 'agents', 'smith-reviewer.toml');
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
  ['codex agent installed', fs.existsSync(codexAgent)],
  ['codex skill installed', fs.existsSync(codexSkill)],
  ['codex map installed', fs.existsSync(codexMap)],
  ['codex runtime helper installed', fs.existsSync(codexHelper)],
  ['codex shell helper is executable', (fs.statSync(codexShellHelper).mode & 0o111) !== 0],
  ['codex template installed', fs.existsSync(codexTemplate)],
  ['codex pattern installed', fs.existsSync(codexPattern)],
  ['codex sources include agents', codexSources().includes('.codex/agents/smith-reviewer.toml')],
  ['codex sources include skills', codexSources().includes('.agents/skills/forgeflow-review/SKILL.md')],
  ['codex sources include runtime helpers', codexSources().includes('scripts/forgeflow/health-check.js')],
  ['codex destination maps agent home', codexDestination('.codex/agents/smith-reviewer.toml', '/tmp/codex') === '/tmp/codex/agents/smith-reviewer.toml'],
  ['codex destination maps runtime root', codexDestination('scripts/forgeflow/health-check.js', '/tmp/codex') === '/tmp/codex/forgeflow/scripts/forgeflow/health-check.js'],
  ['codex inventory reports full skill set', codexResult.skill_names.includes('research') && codexResult.skill_names.includes('forge-review') && codexResult.skill_names.includes('create-agent')],
  ['codex inventory reports agent fleet', codexResult.agent_names.includes('smith-reviewer') && codexResult.agent_names.includes('warden-auditor')],
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
