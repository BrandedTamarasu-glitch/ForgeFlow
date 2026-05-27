#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseArgs: parseCheckArgs } = require('./check-user-profile');
const { parseArgs: parseRecordArgs } = require('./record-user-profile');
const { parseArgs: parseShowArgs } = require('./show-user-profile');
const {
  checkUserProfile,
  compactUserProfile,
  normalizeEntry,
  profileConflicts,
  profileSuggestions,
  projectProfileFile,
  recordUserProfile,
  showUserProfile,
} = require('./user-profile');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-user-profile-'));
const home = path.join(tmp, 'home');
const root = path.join(tmp, 'repo');
const projectDir = path.join(root, '.forgeflow', 'Demo');
fs.mkdirSync(projectDir, { recursive: true });

const globalResult = recordUserProfile({
  home,
  projectDir,
  scope: 'global',
  category: 'autonomy',
  preference: 'User prefers autonomous safe-slice execution.',
  evidence: 'Explicit instruction to automate unless serious issue appears.',
  confidence: 'high',
  evidenceCount: 3,
  source: 'explicit-user-instruction',
  appliesTo: 'plan,implement,review,next-step',
  agentGuidance: 'Continue through safe slices; pause for failed validation, high risk, product judgment, or escalation.',
});
const projectResult = recordUserProfile({
  home,
  projectDir,
  scope: 'project',
  category: 'ui',
  preference: 'Project screens should feel quiet, dense, and operational.',
  evidence: 'Accepted dashboard-like Forgeflow docs and rejected vague marketing framing.',
  confidence: 'medium',
  evidenceCount: 2,
  source: 'accepted-workflow',
  appliesTo: 'plan,implement,review,ui',
  agentGuidance: 'Prefer compact operational UI over decorative landing-page treatment.',
});
const check = checkUserProfile({ home, projectDir });
const shown = showUserProfile({ home, projectDir });
const compact = compactUserProfile({ home, projectDir }, 1200);
const out = path.join(projectDir, 'context', 'user-profile.md');
const shownWithOut = showUserProfile({ home, projectDir, out });
const globalRecords = fs.readFileSync(globalResult.file, 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
const projectRecords = fs.readFileSync(projectResult.file, 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));

function runRecord(argv) {
  try {
    const opts = parseRecordArgs(argv);
    recordUserProfile(opts);
    return { status: 0, stderr: '' };
  } catch (err) {
    return { status: 1, stderr: err.message };
  }
}

const invalidCategory = runRecord([
  '--home',
  home,
  '--project-dir',
  projectDir,
  '--scope',
  'global',
  '--category',
  'taste',
  '--preference',
  'Should fail',
]);
const invalidAppliesTo = runRecord([
  '--home',
  home,
  '--project-dir',
  projectDir,
  '--scope',
  'global',
  '--category',
  'communication',
  '--preference',
  'Should fail',
  '--applies-to',
  'telepathy',
]);
const supersededWithoutReplacement = runRecord([
  '--home',
  home,
  '--project-dir',
  projectDir,
  '--scope',
  'global',
  '--category',
  'workflow',
  '--preference',
  'Should fail',
  '--status',
  'superseded',
]);
const sensitive = runRecord([
  '--home',
  home,
  '--project-dir',
  projectDir,
  '--scope',
  'global',
  '--category',
  'communication',
  '--preference',
  'token: SHOULD_NOT_WRITE should fail',
]);
const placeholder = runRecord([
  '--home',
  home,
  '--project-dir',
  projectDir,
  '--scope',
  'global',
  '--category',
  'communication',
  '--preference',
  '<replace with the user preference>',
]);
const emptyHome = path.join(tmp, 'empty-home');
const emptyProjectDir = path.join(tmp, 'empty-project', '.forgeflow', 'Empty');
fs.mkdirSync(emptyProjectDir, { recursive: true });
const emptyCheck = checkUserProfile({ home: emptyHome, projectDir: emptyProjectDir });
const emptyCompact = compactUserProfile({ home: emptyHome, projectDir: emptyProjectDir });
const misScopedHome = path.join(tmp, 'mis-scoped-home');
const misScopedProjectDir = path.join(tmp, 'mis-scoped-project', '.forgeflow', 'MisScoped');
fs.mkdirSync(misScopedProjectDir, { recursive: true });
recordUserProfile({
  home: misScopedHome,
  projectDir: misScopedProjectDir,
  scope: 'global',
  category: 'ui',
  preference: 'Should not be injected from global scope.',
});
const misScopedCheck = checkUserProfile({ home: misScopedHome, projectDir: misScopedProjectDir });
const misScopedCompact = compactUserProfile({ home: misScopedHome, projectDir: misScopedProjectDir });
const conflictHome = path.join(tmp, 'conflict-home');
const conflictProjectDir = path.join(tmp, 'conflict-project', '.forgeflow', 'Conflict');
fs.mkdirSync(conflictProjectDir, { recursive: true });
recordUserProfile({
  home: conflictHome,
  projectDir: conflictProjectDir,
  scope: 'global',
  category: 'communication',
  preference: 'Use very short progress updates.',
  confidence: 'high',
});
recordUserProfile({
  home: conflictHome,
  projectDir: conflictProjectDir,
  scope: 'global',
  category: 'communication',
  preference: 'Use detailed progress updates.',
  confidence: 'low',
});
const conflictCheck = checkUserProfile({ home: conflictHome, projectDir: conflictProjectDir });
const lowConflictHome = path.join(tmp, 'low-conflict-home');
const lowConflictProjectDir = path.join(tmp, 'low-conflict-project', '.forgeflow', 'LowConflict');
fs.mkdirSync(lowConflictProjectDir, { recursive: true });
recordUserProfile({
  home: lowConflictHome,
  projectDir: lowConflictProjectDir,
  scope: 'project',
  category: 'workflow',
  preference: 'Prefer strict phase gates.',
  confidence: 'low',
});
recordUserProfile({
  home: lowConflictHome,
  projectDir: lowConflictProjectDir,
  scope: 'project',
  category: 'workflow',
  preference: 'Prefer loose phase gates.',
  confidence: 'low',
});
const lowConflictCheck = checkUserProfile({ home: lowConflictHome, projectDir: lowConflictProjectDir });
const badHome = path.join(tmp, 'bad-home');
fs.mkdirSync(path.join(badHome, 'forgeflow'), { recursive: true });
fs.writeFileSync(path.join(badHome, 'forgeflow', 'user-operating-profile.jsonl'), '{"scope":"global","category":"bad","preference":"Invalid"}\n');
const badCheck = checkUserProfile({ home: badHome, projectDir: emptyProjectDir });
const futureSchemaHome = path.join(tmp, 'future-schema-home');
fs.mkdirSync(path.join(futureSchemaHome, 'forgeflow'), { recursive: true });
fs.writeFileSync(path.join(futureSchemaHome, 'forgeflow', 'user-operating-profile.jsonl'), '{"schema_version":"2","scope":"global","category":"communication","preference":"Future record"}\n');
const futureSchemaCheck = checkUserProfile({ home: futureSchemaHome, projectDir: emptyProjectDir });
const symlinkProjectDir = path.join(tmp, 'symlink-project');
fs.mkdirSync(symlinkProjectDir, { recursive: true });
const outside = path.join(tmp, 'outside-profile.jsonl');
const symlinkProfile = projectProfileFile(symlinkProjectDir);
fs.writeFileSync(outside, 'do not append\n');
let symlinkBlocked = true;
try {
  fs.symlinkSync(outside, symlinkProfile);
  recordUserProfile({
    home,
    projectDir: symlinkProjectDir,
    scope: 'project',
    category: 'ui',
    preference: 'Should not append through symlink.',
  });
  symlinkBlocked = false;
} catch (err) {
  symlinkBlocked = err.message.includes('symlinked file');
}

const checks = [
  ['records global profile', globalResult.file.endsWith(path.join('forgeflow', 'user-operating-profile.jsonl')) && globalRecords.length === 1],
  ['records project profile', projectResult.file.endsWith(path.join('.forgeflow', 'Demo', 'project-experience-profile.jsonl')) && projectRecords.length === 1],
  ['normalizes entry metadata', globalRecords[0].schema_version === '1' && globalRecords[0].confidence === 'high' && globalRecords[0].evidence_count === 3 && globalRecords[0].applies_to.includes('implement')],
  ['project category preserved', projectRecords[0].category === 'ui' && projectRecords[0].source === 'accepted-workflow'],
  ['check passes active records', check.status === 'pass' && check.records.global === 1 && check.records.project === 1 && check.records.active === 2 && check.records.usable === 2],
  ['show renders both sections', shown.markdown.includes('## User Operating Preferences') && shown.markdown.includes('User prefers autonomous safe-slice execution') && shown.markdown.includes('## Project Experience Preferences') && shown.markdown.includes('quiet, dense, and operational')],
  ['show renders role use', shown.markdown.includes('## Role Use') && shown.markdown.includes('Atlas:') && shown.markdown.includes('Warden:')],
  ['show can write artifact', shownWithOut.markdown.includes('Forgeflow User Profile') && fs.existsSync(out)],
  ['compact profile injects when safe', compact.injected === true && compact.markdown.includes('This profile is advisory') && compact.result.check.status === 'pass'],
  ['empty profile warns', emptyCheck.status === 'warn' && emptyCheck.records.usable === 0 && emptyCheck.issues.some((item) => item.code === 'profile-empty')],
  ['empty compact blocks injection', emptyCompact.injected === false && emptyCompact.markdown.includes('returned WARN')],
  ['mis-scoped profile warns without injection', misScopedCheck.status === 'warn' && misScopedCheck.records.active === 1 && misScopedCheck.records.usable === 0 && misScopedCompact.injected === false && !misScopedCompact.markdown.includes('Should not be injected')],
  ['profile suggestions are advisory', profileSuggestions([]).some((item) => item.type === 'ask-user' && item.command_template.includes('forgeflow-profile') && item.command_template.includes('<replace'))],
  ['mis-scoped profile suggests move', misScopedCheck.suggestions.some((item) => item.type === 'move-to-project' && item.follow_up.includes('superseded'))],
  ['profile conflict review warns', conflictCheck.status === 'warn' && conflictCheck.conflicts.length === 1 && conflictCheck.issues.some((item) => item.code === 'profile-potential-conflict') && profileConflicts(conflictCheck.conflicts).length === 0],
  ['profile conflict includes next action', conflictCheck.conflicts[0].command === 'forgeflow-profile --check' && conflictCheck.conflicts[0].follow_up.includes('superseded')],
  ['low confidence conflicts warn', lowConflictCheck.status === 'warn' && lowConflictCheck.conflicts.length === 1],
  ['invalid category fails', invalidCategory.status === 1 && invalidCategory.stderr.includes('Invalid user profile category')],
  ['invalid applies-to fails', invalidAppliesTo.status === 1 && invalidAppliesTo.stderr.includes('applies_to')],
  ['superseded replacement required', supersededWithoutReplacement.status === 1 && supersededWithoutReplacement.stderr.includes('superseded_by')],
  ['sensitive entry fails', sensitive.status === 1 && sensitive.stderr.includes('sensitive content')],
  ['sensitive entry not written', !fs.readFileSync(globalResult.file, 'utf8').includes('SHOULD_NOT_WRITE')],
  ['placeholder entry fails', placeholder.status === 1 && placeholder.stderr.includes('placeholder')],
  ['bad profile check fails', badCheck.status === 'fail' && badCheck.issues.some((item) => item.code === 'profile-entry-invalid')],
  ['bad compact blocks injection', compactUserProfile({ home: badHome, projectDir: emptyProjectDir }).injected === false],
  ['future schema check fails', futureSchemaCheck.status === 'fail' && futureSchemaCheck.issues.some((item) => item.message.includes('schema_version'))],
  ['symlink project profile destination blocked', symlinkBlocked && fs.readFileSync(outside, 'utf8') === 'do not append\n'],
  ['normalize defaults are stable', normalizeEntry({ scope: 'global', category: 'communication', preference: 'Keep updates concise.' }).applies_to.includes('implement')],
  ['question phrasing is allowed', normalizeEntry({ scope: 'global', category: 'validation', preference: 'Ask what validation proof the user expects before a slice is complete.' }).category === 'validation'],
  ['replace phrase is allowed when specific', normalizeEntry({ scope: 'global', category: 'docs', preference: 'When drafting handoffs, replace with the exact ticket summary from the active task.' }).category === 'docs'],
  ['record args parse', parseRecordArgs(['--scope', 'global', '--category', 'communication', '--preference', 'Keep updates concise.', '--json']).json === true],
  ['check args parse', parseCheckArgs(['--home', home, '--project-dir', projectDir, '--json']).projectDir === projectDir],
  ['show args parse', parseShowArgs(['--home', home, '--project-dir', projectDir, '--out', out, '--json']).out === out],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

if (failed > 0) process.exit(1);
console.log('user profile: ok');
