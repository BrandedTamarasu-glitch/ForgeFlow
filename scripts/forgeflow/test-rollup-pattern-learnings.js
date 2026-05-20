#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  rollupPatternLearnings,
  renderMarkdown,
  scoreKnownPattern,
} = require('./rollup-pattern-learnings');

const repoRoot = path.resolve(__dirname, '..', '..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-pattern-learnings-'));
const patternsDir = path.join(root, 'forgeflow-patterns');
const alphaDir = path.join(root, 'alpha', '.forgeflow', 'Alpha');
const betaDir = path.join(root, 'beta', '.forgeflow', 'Beta');
fs.mkdirSync(patternsDir, { recursive: true });
fs.mkdirSync(alphaDir, { recursive: true });
fs.mkdirSync(betaDir, { recursive: true });
fs.writeFileSync(path.join(patternsDir, 'recurring-blockers.md'), [
  '# Recurring Blocker Classes',
  '',
  '## 1. Type Safety & Schema Mismatches',
  '',
  '**Seen in:**',
  '- `seed`',
  '',
  '## 2. Unimplemented / Promised-But-Missing Features',
  '',
].join('\n'));
fs.writeFileSync(path.join(alphaDir, 'learnings.jsonl'), [
  JSON.stringify({ date: '2026-05-01', source: 'smith', type: 'quality', learning: 'TypeScript enum schema mismatch between migration and API signature', severity: 'high' }),
  JSON.stringify({ date: '2026-05-02', source: 'warden', type: 'integration', learning: 'External API call lacks retry timeout and hangs during outage', severity: 'high' }),
  JSON.stringify({ date: '2026-05-03', source: 'warden', type: 'integration', learning: 'External API call lacks retry timeout for invoice sync', severity: 'medium' }),
  '',
].join('\n'));
fs.writeFileSync(path.join(betaDir, 'learnings.jsonl'), [
  JSON.stringify({ date: '2026-05-04', source: 'smith', type: 'quality', learning: 'Declared but not wired feature was promised in spec and missing from implementation', severity: 'medium' }),
  JSON.stringify({ date: '2026-05-05', source: 'warden', type: 'integration', learning: 'External API call lacks retry timeout when payment provider stalls', severity: 'high' }),
  '',
].join('\n'));

const dryRun = rollupPatternLearnings({
  root,
  patternsDir,
  period: 'all',
  minProjects: 2,
  minOccurrences: 3,
  dryRun: true,
  now: new Date('2026-05-20T00:00:00Z'),
});
const dryRunLogged = fs.existsSync(path.join(patternsDir, '.learnings-log.jsonl'));
const recorded = rollupPatternLearnings({
  root,
  patternsDir,
  period: 'all',
  minProjects: 2,
  minOccurrences: 3,
  now: new Date('2026-05-20T00:00:00Z'),
});
const markdown = renderMarkdown(recorded);
const cli = spawnSync(process.execPath, [
  path.join(repoRoot, 'scripts/forgeflow/rollup-pattern-learnings.js'),
  '--root',
  root,
  '--patterns-dir',
  patternsDir,
  '--json',
], { encoding: 'utf8' });
const cliJson = cli.status === 0 ? JSON.parse(cli.stdout) : {};
const badPeriod = spawnSync(process.execPath, [
  path.join(repoRoot, 'scripts/forgeflow/rollup-pattern-learnings.js'),
  '--period',
  'quarter',
], { encoding: 'utf8' });

const checks = [
  ['scores known pattern', scoreKnownPattern('schema enum type mismatch in TypeScript signature') === 'Type Safety & Schema Mismatches'],
  ['dry-run does not log', dryRun.dry_run === true && !dryRunLogged],
  ['counts projects and learnings', recorded.projects_scanned === 2 && recorded.learnings_total === 5],
  ['summarizes known updates', recorded.known_pattern_updates.some((item) => item.pattern === 'Type Safety & Schema Mismatches' && item.occurrences === 1)],
  ['surfaces candidates', recorded.candidates.some((item) => item.projects.length === 2 && item.occurrences === 3 && item.title.includes('External'))],
  ['writes learning log', fs.readFileSync(path.join(patternsDir, '.learnings-log.jsonl'), 'utf8').includes('"learnings_total":5')],
  ['renders markdown', markdown.includes('# Forgeflow Learnings - all') && markdown.includes('Candidates for promotion')],
  ['cli json works', cli.status === 0 && cliJson.projects_scanned === 2 && cliJson.candidates.length === 1],
  ['bad period exits usage', badPeriod.status === 2 && badPeriod.stderr.includes('Invalid --period')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log('pattern learnings: ok');
