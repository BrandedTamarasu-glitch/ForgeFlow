#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { correctProjectLearning, parseArgs } = require('./correct-project-learning');
const { recordProjectLearning, projectLearningId } = require('./record-project-learning');
const { buildRollup, resolvedLearningCandidates } = require('./rollup-project-learnings');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-correct-project-learning-'));
const projectDir = path.join(tmp, '.forgeflow', 'Demo');
const candidatesFile = path.join(projectDir, 'project-learning-candidates.jsonl');
const original = {
  category: 'recommended-approach',
  learning: 'Use the old release path.',
  source: 'Atlas',
  evidence: 'Historical release notes',
  confidence: 'medium',
};
recordProjectLearning({ projectDir, inputEntries: [original] });
const originalId = projectLearningId(original);
const initial = fs.readFileSync(candidatesFile, 'utf8');

function attempt(opts) {
  try {
    return { ok: true, result: correctProjectLearning(opts) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

const preview = attempt({ projectDir, id: originalId, replacement: 'Use the current release path.' });
const afterPreview = fs.readFileSync(candidatesFile, 'utf8');
const missing = attempt({ projectDir, id: 'plc_0123456789abcdef', replacement: 'Use the current release path.' });
const malformed = attempt({ projectDir, id: 'old-release-path', replacement: 'Use the current release path.' });
const sensitive = attempt({ projectDir, id: originalId, replacement: 'token: SHOULD_NOT_WRITE' });
const afterSensitive = fs.readFileSync(candidatesFile, 'utf8');
const written = attempt({ projectDir, id: originalId, replacement: 'Use the current release path.', write: true });
const afterWrite = fs.readFileSync(candidatesFile, 'utf8');
const lines = afterWrite.trim().split(/\r?\n/).map((line) => JSON.parse(line));
const resolved = resolvedLearningCandidates(lines);
const rolled = buildRollup({ learningCandidates: lines }, { generatedAt: '2026-09-02T00:00:00Z' });
const repeat = attempt({ projectDir, id: originalId, replacement: 'A second replacement must not write.', write: true });

const symlinkProject = path.join(tmp, '.forgeflow', 'SymlinkDemo');
const outsideFile = path.join(tmp, 'outside-candidates.jsonl');
fs.mkdirSync(symlinkProject, { recursive: true });
fs.writeFileSync(outsideFile, initial);
fs.symlinkSync(outsideFile, path.join(symlinkProject, 'project-learning-candidates.jsonl'));
const symlink = attempt({ projectDir: symlinkProject, id: originalId, replacement: 'Must not write through symlink.', write: true });

let missingArg = '';
try {
  parseArgs(['--id'], { exitOnError: false });
} catch (err) {
  missingArg = err.message;
}

const target = resolved.find((entry) => entry.id === originalId);
const replacement = resolved.find((entry) => entry.learning === 'Use the current release path.');
const checks = [
  ['preview succeeds', preview.ok && preview.result.status === 'preview' && preview.result.writes === 0],
  ['preview is append-only', afterPreview === initial],
  ['preview returns exact target', preview.ok && preview.result.target.id === originalId && preview.result.target.learning === original.learning],
  ['unknown exact id fails safely', !missing.ok && missing.error.includes('was not found')],
  ['malformed id fails safely', !malformed.ok && malformed.error.includes('exact stable id')],
  ['sensitive replacement fails without writing', !sensitive.ok && sensitive.error.includes('sensitive content') && afterSensitive === initial],
  ['write appends exactly two records', written.ok && written.result.status === 'written' && written.result.writes === 2 && lines.length === 3],
  ['write retires only the exact target', target && target.status === 'superseded' && replacement && target.superseded_by === replacement.id],
  ['write creates an active replacement', replacement && replacement.status === 'active' && replacement.id !== originalId],
  ['rollup suppresses retired guidance and keeps replacement', !rolled.recommended_approach_for_next_work.some((item) => item.includes(original.learning)) && rolled.recommended_approach_for_next_work.some((item) => item.includes(replacement.learning))],
  ['repeat correction cannot append again', !repeat.ok && repeat.error.includes('already inactive') && fs.readFileSync(candidatesFile, 'utf8') === afterWrite],
  ['symlink destination is blocked', !symlink.ok && !fs.readFileSync(outsideFile, 'utf8').includes('Must not write through symlink.')],
  ['missing option value reports usage error', missingArg.includes('Missing value for --id')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('project learning correction: ok');
