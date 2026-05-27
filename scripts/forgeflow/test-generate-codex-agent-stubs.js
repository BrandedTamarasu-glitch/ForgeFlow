#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildStub, MISSING_SUMMARY_GUIDANCE, selectedMarkdown } = require('./generate-codex-agent-stubs');

const repoRoot = path.resolve(__dirname, '..', '..');
const map = JSON.parse(fs.readFileSync(path.join(repoRoot, 'fixtures/prompt-parity/source-map.json'), 'utf8'));
const agent = '.codex/agents/sample-reviewer.toml';
const markdown = fs.readFileSync(path.join(repoRoot, map.agents[agent].canonical), 'utf8');
const selected = selectedMarkdown(markdown, map.agents[agent].sections);
const stub = buildStub(agent, map.agents[agent]);
const fallbackStub = buildStub('.codex/agents/fallback-reviewer.toml', {
  canonical: map.agents[agent].canonical,
  sections: [],
});

const checks = [
  ['role selected', selected.includes('<role>')],
  ['review section selected', selected.includes('## Mode: Review')],
  ['manual summary included', stub.includes('Review concrete correctness and accessibility evidence.')],
  ['canonical source included', stub.includes('canonical_source = "fixtures/prompt-parity/sample-agent.md"')],
  ['instructions included', stub.includes('Canonical excerpts for manual review')],
  ['fallback guidance is deterministic', fallbackStub.includes(MISSING_SUMMARY_GUIDANCE)],
  ['fallback has no vague todo', !fallbackStub.includes('TODO: Add a manually curated Codex summary')],
];

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-agent-stub-'));
const outFile = path.join(tmpDir, 'sample-reviewer.toml');
const result = spawnSync(path.join(repoRoot, 'scripts/forgeflow/generate-codex-agent-stubs.js'), [
  '--map',
  path.join(repoRoot, 'fixtures/prompt-parity/source-map.json'),
  '--agent',
  agent,
  '--out',
  outFile,
], { encoding: 'utf8' });

checks.push(['cli exit', result.status === 0]);
checks.push(['cli wrote file', fs.existsSync(outFile) && fs.readFileSync(outFile, 'utf8').includes('sample_reviewer')]);

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length > 0) {
  console.error(`codex agent stub test failed: ${failed.join(', ')}`);
  process.exit(1);
}

console.log('codex agent stub: ok');
