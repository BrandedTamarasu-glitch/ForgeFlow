#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { checkImplementationNotes, looksLikeRawLog } = require('./check-implementation-notes');

const repoRoot = path.resolve(__dirname, '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-check-notes-'));

function project(name) {
  const dir = path.join(tmp, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeNotes(projectDir, content) {
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'implementation-notes.md'), content);
}

function writeShipSummary(projectDir, value) {
  const shipDir = path.join(projectDir, 'ship');
  fs.mkdirSync(shipDir, { recursive: true });
  fs.writeFileSync(path.join(shipDir, 'ship-summary.json'), JSON.stringify(value, null, 2));
}

const good = project('good');
writeNotes(good, [
  '# Implementation Notes',
  '',
  '## Decisions',
  '',
  '- 2026-05-18T00:00:00Z | Atlas | decision | Markdown stays canonical',
  '',
  '## Spec Gaps',
  '',
  '- Ship summary needed a notes bridge',
  '',
  '## Tradeoffs',
  '',
  '## Deviations',
  '',
  '## Follow-ups',
  '',
  '## Validation Notes',
  '',
  '- Direct helper execution tested',
  '',
].join('\n'));
writeShipSummary(good, {
  implementation_notes: {
    decisions: ['Markdown stays canonical'],
    spec_gaps: ['Ship summary needed a notes bridge'],
    tradeoffs: [],
    deviations: [],
    follow_ups: [],
    validation_notes: ['Direct helper execution tested'],
  },
});

const empty = project('empty');
writeNotes(empty, [
  '# Implementation Notes',
  '',
  '## Decisions',
  '',
  '## Spec Gaps',
  '',
  '## Tradeoffs',
  '',
  '## Deviations',
  '',
  '## Follow-ups',
  '',
  '## Validation Notes',
  '',
].join('\n'));

const sensitive = project('sensitive');
writeNotes(sensitive, [
  '# Implementation Notes',
  '',
  '## Decisions',
  '',
  '- API key issue found: api_key=SHOULD_NOT_PRINT',
  '',
  '## Spec Gaps',
  '',
  '## Tradeoffs',
  '',
  '## Deviations',
  '',
  '## Follow-ups',
  '',
  '## Validation Notes',
  '',
].join('\n'));

const rawShip = project('raw-ship');
writeNotes(rawShip, fs.readFileSync(path.join(good, 'implementation-notes.md'), 'utf8'));
writeShipSummary(rawShip, {
  implementation_notes: {
    decisions: ['2026-05-18T00:00:00Z | Atlas | decision | Raw metadata should not ship'],
    spec_gaps: [],
    tradeoffs: [],
    deviations: [],
    follow_ups: [],
    validation_notes: [],
  },
});

const missingShipNotes = project('missing-ship-notes');
writeNotes(missingShipNotes, fs.readFileSync(path.join(good, 'implementation-notes.md'), 'utf8'));
writeShipSummary(missingShipNotes, { generated_at: '2026-05-18T00:00:00Z' });

const privateUrls = project('private-urls');
writeNotes(privateUrls, [
  '# Implementation Notes',
  '',
  '## Decisions',
  '',
  '- Reviewed https://confluence.company.internal/project-notes',
  '',
  '## Spec Gaps',
  '',
  '- Repo mirror lives at ssh://git@internal.git.local/repo',
  '',
  '## Tradeoffs',
  '',
  '- Fallback clone URL is git@intranet.git.local:team/repo.git',
  '',
  '## Deviations',
  '',
  '## Follow-ups',
  '',
  '## Validation Notes',
  '',
].join('\n'));

const goodResult = checkImplementationNotes({ projectDir: good });
const emptyResult = checkImplementationNotes({ projectDir: empty });
const missingResult = checkImplementationNotes({ projectDir: project('missing') });
const sensitiveResult = checkImplementationNotes({ projectDir: sensitive });
const rawShipResult = checkImplementationNotes({ projectDir: rawShip });
const missingShipNotesResult = checkImplementationNotes({ projectDir: missingShipNotes });
const privateUrlResult = checkImplementationNotes({ projectDir: privateUrls });
const strictMissingResult = spawnSync(path.join(repoRoot, 'scripts/forgeflow/check-implementation-notes.js'), [
  '--project-dir',
  project('strict-missing'),
  '--strict',
  '--json',
], { encoding: 'utf8' });
const sensitiveCli = spawnSync(path.join(repoRoot, 'scripts/forgeflow/check-implementation-notes.js'), [
  '--project-dir',
  sensitive,
  '--json',
], { encoding: 'utf8' });
const missingArgCli = spawnSync(path.join(repoRoot, 'scripts/forgeflow/check-implementation-notes.js'), [
  '--project-dir',
], { encoding: 'utf8' });
const nextFlagArgCli = spawnSync(path.join(repoRoot, 'scripts/forgeflow/check-implementation-notes.js'), [
  '--file',
  '--json',
], { encoding: 'utf8' });

const checks = [
  ['good notes pass', goodResult.status === 'pass'],
  ['empty notes warn', emptyResult.status === 'warn' && emptyResult.issues.some((item) => item.code === 'notes-empty')],
  ['missing notes warn', missingResult.status === 'warn' && missingResult.issues.some((item) => item.code === 'notes-missing')],
  ['strict missing fails', strictMissingResult.status === 1],
  ['sensitive notes fail', sensitiveResult.status === 'fail' && sensitiveResult.issues.some((item) => item.code === 'sensitive-content')],
  ['private urls fail', privateUrlResult.status === 'fail' && privateUrlResult.issues.filter((item) => item.code === 'sensitive-content').length === 3],
  ['sensitive output redacted', !sensitiveCli.stdout.includes('SHOULD_NOT_PRINT') && !sensitiveCli.stderr.includes('SHOULD_NOT_PRINT')],
  ['raw ship summary warns', rawShipResult.status === 'warn' && rawShipResult.issues.some((item) => item.code === 'ship-summary-raw-log')],
  ['missing ship summary notes warn', missingShipNotesResult.status === 'warn' && missingShipNotesResult.issues.some((item) => item.code === 'ship-summary-notes-missing')],
  ['raw log detector', looksLikeRawLog('2026-05-18T00:00:00Z | Atlas | decision | Raw metadata')],
  ['missing option value exits usage', missingArgCli.status === 2 && missingArgCli.stderr.includes('Missing value for --project-dir')],
  ['next flag is not option value', nextFlagArgCli.status === 2 && nextFlagArgCli.stderr.includes('Missing value for --file')],
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

console.log('implementation notes check: ok');
