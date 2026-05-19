#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function changelogCandidates(version) {
  const exact = `docs/changelogs/v${version}.html`;
  const patchZero = version.endsWith('.0')
    ? `docs/changelogs/v${version.replace(/\.0$/, '')}.html`
    : null;
  return patchZero ? [exact, patchZero] : [exact];
}

const plugin = readJson('.claude-plugin/plugin.json');
const marketplace = readJson('.claude-plugin/marketplace.json');
const marketplaceEntry = marketplace.plugins.find((entry) => entry.name === plugin.name);
const releaseProcess = fs.readFileSync(path.join(repoRoot, 'docs/wiki/Release-Process.md'), 'utf8');
const releaseCheck = fs.readFileSync(path.join(repoRoot, 'commands/forgeflow-release-check.md'), 'utf8');
const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
const hostedDocs = fs.readFileSync(path.join(repoRoot, 'docs/index.html'), 'utf8');

const semver = /^\d+\.\d+\.\d+$/;
const changelogs = changelogCandidates(plugin.version);
const matchingChangelog = changelogs.find(fileExists);
const matchingChangelogLink = matchingChangelog && `./${matchingChangelog.replace(/^docs\//, '')}`;

const checks = [
  ['plugin version is semver', semver.test(plugin.version)],
  ['marketplace entry present', Boolean(marketplaceEntry)],
  ['marketplace version matches plugin', marketplaceEntry && marketplaceEntry.version === plugin.version],
  ['marketplace description mentions Claude Code', marketplaceEntry?.description?.includes('Claude Code')],
  ['marketplace description mentions Codex', marketplaceEntry?.description?.includes('Codex')],
  ['matching changelog exists', Boolean(matchingChangelog)],
  ['hosted docs link matching changelog', matchingChangelogLink && hostedDocs.includes(`href="${matchingChangelogLink}"`)],
  ['README links release process', readme.includes('docs/wiki/Release-Process.md')],
  ['README links release gate', readme.includes('docs/wiki/Release-Gate.md')],
  ['README links project learnings', readme.includes('docs/wiki/Project-Learnings.md')],
  ['hosted docs links project learnings', hostedDocs.includes('./wiki/Project-Learnings.md')],
  ['release process mentions plugin manifest', releaseProcess.includes('.claude-plugin/plugin.json')],
  ['release process mentions marketplace manifest', releaseProcess.includes('.claude-plugin/marketplace.json')],
  ['release process mentions changelog path', releaseProcess.includes('docs/changelogs/')],
  ['release process mentions release check command', releaseProcess.includes('/forgeflow-release-check')],
  ['release process mentions public summary rendering', releaseProcess.includes('render-evaluation-report.js --public')],
  ['release check runs version drift test', releaseCheck.includes('node scripts/forgeflow/test-release-version.js')],
  ['release check runs evaluation report test', releaseCheck.includes('node scripts/forgeflow/test-render-evaluation-report.js')],
  ['release check renders public evaluation summary', releaseCheck.includes('render-evaluation-report.js --outcomes fixtures/evaluation/sample-outcomes.jsonl --public')],
  ['release check runs pilot evidence test', releaseCheck.includes('node scripts/forgeflow/test-record-pilot-evidence.js')],
  ['release check runs pilot evidence rollup test', releaseCheck.includes('node scripts/forgeflow/test-rollup-pilot-evidence.js')],
  ['release check runs project learnings rollup test', releaseCheck.includes('node scripts/forgeflow/test-rollup-project-learnings.js')],
  ['release check runs implementation notes test', releaseCheck.includes('node scripts/forgeflow/test-implementation-notes.js')],
  ['release check runs implementation notes quality test', releaseCheck.includes('node scripts/forgeflow/test-check-implementation-notes.js')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

if (failed > 0) {
  console.error(`Expected changelog: ${changelogs.join(' or ')}`);
  process.exit(1);
}

console.log(`release version: ok (${plugin.version}, ${matchingChangelog})`);
