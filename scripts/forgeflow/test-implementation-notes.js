#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { recordImplementationNotes } = require('./record-implementation-notes');

const repoRoot = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const files = {
  ensure: read('scripts/forgeflow/ensure-forgeflow-state.sh'),
  indexMemory: read('scripts/forgeflow/index-memory.js'),
  contextPack: read('scripts/forgeflow/build-context-pack.js'),
  consult: read('commands/consult.md'),
  implement: read('commands/implement.md'),
  review: read('commands/review.md'),
  ship: read('commands/ship.md'),
  recorder: read('scripts/forgeflow/record-implementation-notes.js'),
  installManifest: read('scripts/forgeflow/install-manifest.js'),
  smith: read('agents/smith-implement.md'),
  warden: read('agents/warden-implement.md'),
  lumen: read('agents/lumen-implement.md'),
  compass: read('agents/compass-implement.md'),
  atlas: read('agents/atlas-implement.md'),
  arbiterImplement: read('agents/arbiter-implement.md'),
  arbiterConsult: read('agents/arbiter-consult.md'),
  atlasPresent: read('agents/atlas-present.md'),
  skillConsult: read('.agents/skills/forgeflow-consult/SKILL.md'),
  skillImplement: read('.agents/skills/forgeflow-implement/SKILL.md'),
  docs: read('docs/wiki/Implementation-Notes.md'),
  home: read('docs/wiki/Home.md'),
  index: read('docs/index.html'),
  privacy: read('docs/wiki/Local-Data-And-Privacy.md'),
  releaseCheck: read('commands/forgeflow-release-check.md'),
};

const categories = ['decision', 'spec-gap', 'tradeoff', 'deviation', 'follow-up', 'validation'];
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-implementation-notes-'));
const projectDir = path.join(tmpDir, '.forgeflow', 'Demo');
const inputPath = path.join(tmpDir, 'notes.json');
fs.writeFileSync(inputPath, JSON.stringify([
  {
    agent: 'Atlas',
    category: 'decision',
    note: 'Record implementation notes as Markdown',
    why: 'The spec allowed HTML or Markdown',
  },
  {
    agent: 'Compass',
    category: 'validation',
    note: 'Manual verification remains required for final handoff',
  },
], null, 2));
const recordResult = recordImplementationNotes({ projectDir, input: inputPath });
const notesContent = fs.readFileSync(path.join(projectDir, 'implementation-notes.md'), 'utf8');
const cliResult = spawnSync(process.execPath, [
  path.join(repoRoot, 'scripts/forgeflow/record-implementation-notes.js'),
  '--project-dir',
  projectDir,
  '--agent',
  'Atlas',
  '--category',
  'follow-up',
  '--note',
  'Review notes before ship',
  '--json',
], { encoding: 'utf8' });
const notesAfterCli = fs.readFileSync(path.join(projectDir, 'implementation-notes.md'), 'utf8');
const directProjectDir = path.join(tmpDir, '.forgeflow', 'Direct');
const directResult = spawnSync(path.join(repoRoot, 'scripts/forgeflow/record-implementation-notes.js'), [
  '--project-dir',
  directProjectDir,
  '--agent',
  'Atlas',
  '--category',
  'tradeoff',
  '--note',
  'Direct helper execution is supported',
  '--json',
], { encoding: 'utf8' });
const directNotesPath = path.join(directProjectDir, 'implementation-notes.md');
const directNotesContent = fs.existsSync(directNotesPath) ? fs.readFileSync(directNotesPath, 'utf8') : '';
const shipSummaryPath = path.join(tmpDir, 'ship-summary.json');
const shipHtmlPath = path.join(tmpDir, 'ship.html');
fs.writeFileSync(shipSummaryPath, JSON.stringify({
  title: 'Implementation Notes Ship Test',
  branch: 'feature/notes',
  baseBranch: 'main',
  generatedAt: '2026-05-18T00:00:00Z',
  summary: 'Tests implementation notes rendering.',
  impact: 'Implementation notes are visible in ship output.',
  files: [],
  tests: [],
  reviewGate: 'passed',
  reviewGateNote: 'Review passed.',
  capabilities: [],
  risksMitigated: [],
  implementation_notes: {
    decisions: ['Markdown is canonical.'],
    spec_gaps: ['Ownership was clarified during implementation.'],
    tradeoffs: [],
    deviations: [],
    follow_ups: ['Review notes before ship.'],
    validation_notes: ['Direct helper execution is tested.'],
  },
  notes: [],
}, null, 2));
const renderShipResult = spawnSync(process.execPath, [
  path.join(repoRoot, 'scripts/forgeflow/render-ship-presentation.js'),
  shipSummaryPath,
  shipHtmlPath,
], { encoding: 'utf8' });
const shipHtml = fs.existsSync(shipHtmlPath) ? fs.readFileSync(shipHtmlPath, 'utf8') : '';
const shipRepo = path.join(tmpDir, 'ship-repo');
fs.mkdirSync(shipRepo, { recursive: true });
spawnSync('git', ['init', '-b', 'main'], { cwd: shipRepo, encoding: 'utf8' });
spawnSync('git', ['config', 'user.email', 'forgeflow@example.com'], { cwd: shipRepo, encoding: 'utf8' });
spawnSync('git', ['config', 'user.name', 'Forgeflow Test'], { cwd: shipRepo, encoding: 'utf8' });
fs.writeFileSync(path.join(shipRepo, 'README.md'), '# Demo\n');
spawnSync('git', ['add', 'README.md'], { cwd: shipRepo, encoding: 'utf8' });
spawnSync('git', ['commit', '-m', 'initial'], { cwd: shipRepo, encoding: 'utf8' });
fs.writeFileSync(path.join(shipRepo, 'README.md'), '# Demo\n\nUpdated.\n');
spawnSync('git', ['add', 'README.md'], { cwd: shipRepo, encoding: 'utf8' });
spawnSync('git', ['commit', '-m', 'update readme'], { cwd: shipRepo, encoding: 'utf8' });
const shipNotesDir = path.join(shipRepo, '.forgeflow', 'ship-repo');
fs.mkdirSync(shipNotesDir, { recursive: true });
fs.writeFileSync(path.join(shipNotesDir, 'implementation-notes.md'), [
  '# Implementation Notes',
  '',
  '## Decisions',
  '',
  '- 2026-05-18T00:00:00Z | Atlas | decision | Markdown stays canonical Why: user asked for html or markdown',
  '',
  '## Spec Gaps',
  '',
  '- 2026-05-18T00:00:00Z | Arbiter | spec-gap | Ship helper needed a summary bridge',
  '',
  '## Tradeoffs',
  '',
  '## Deviations',
  '',
  '## Follow-ups',
  '',
  '## Validation Notes',
  '',
  '- Manual validation note without pipe metadata',
  '',
].join('\n'));
const shipPrepareResult = spawnSync(path.join(repoRoot, 'scripts/forgeflow/ship-prepare.sh'), ['Implementation notes ship prep'], {
  cwd: shipRepo,
  encoding: 'utf8',
});
const preparedSummaryPath = path.join(shipNotesDir, 'ship', 'ship-summary.json');
const preparedHtmlPath = path.join(shipNotesDir, 'ship', 'ship-presentation.html');
const preparedCheckPath = path.join(shipNotesDir, 'ship', 'implementation-notes-check.json');
const preparedLearningsPath = path.join(shipNotesDir, 'ship', 'project-learnings-rollup.json');
const preparedBodyPath = path.join(shipNotesDir, 'ship', 'pr-body.md');
const preparedSummary = fs.existsSync(preparedSummaryPath)
  ? JSON.parse(fs.readFileSync(preparedSummaryPath, 'utf8'))
  : {};
const preparedHtml = fs.existsSync(preparedHtmlPath) ? fs.readFileSync(preparedHtmlPath, 'utf8') : '';
const preparedCheck = fs.existsSync(preparedCheckPath)
  ? JSON.parse(fs.readFileSync(preparedCheckPath, 'utf8'))
  : {};
const preparedLearnings = fs.existsSync(preparedLearningsPath)
  ? JSON.parse(fs.readFileSync(preparedLearningsPath, 'utf8'))
  : {};
const preparedBody = fs.existsSync(preparedBodyPath) ? fs.readFileSync(preparedBodyPath, 'utf8') : '';

const checks = [
  ['state seeds notes', files.ensure.includes('implementation-notes.md') && files.ensure.includes('## Spec Gaps')],
  ['state seeds project learnings', files.ensure.includes('project-learnings.md') && files.ensure.includes('## Recommended Approach For Next Work')],
  ['memory index includes notes', files.indexMemory.includes("'implementation-notes.md'")],
  ['memory index includes project learnings', files.indexMemory.includes("'project-learnings.md'")],
  ['context pack includes notes', files.contextPack.includes("'implementation-notes.md'")],
  ['context pack includes project learnings', files.contextPack.includes("'project-learnings.md'")],
  ['consult loads notes path', files.consult.includes('NOTES_PATH="${FORGEFLOW_DIR}/implementation-notes.md"')],
  ['consult loads project learnings path', files.consult.includes('PROJECT_LEARNINGS_PATH="${FORGEFLOW_DIR}/project-learnings.md"')],
  ['consult carries lean decision into brief', files.consult.includes('LEAN_DECISION_PATH="${FORGEFLOW_DIR}/context/lean-decision.md"') && files.consult.includes('render-lean-decision.js') && files.consult.includes('## Lean Decision')],
  ['implement initializes notes', files.implement.includes('NOTES_PATH="${FORGEFLOW_DIR}/implementation-notes.md"') && files.implement.includes('cat > "$NOTES_PATH"')],
  ['implement consumes project learnings as guidance', files.implement.includes('PROJECT_LEARNINGS_PATH="${FORGEFLOW_DIR}/project-learnings.md"') && files.implement.includes('guidance only')],
  ['implement carries lean decision into prompts', files.implement.includes('LEAN_DECISION_PATH="${FORGEFLOW_DIR}/context/lean-decision.md"') && files.implement.includes('render-lean-decision.js') && files.implement.includes('Do Not Simplify') && files.implement.includes('known ceiling and upgrade trigger')],
  ['implement routes candidates to atlas', files.implement.includes('Implementation note consolidation checkpoint') && files.implement.includes('record-implementation-notes.js')],
  ['implement refreshes project learnings after notes', files.implement.includes('show-project-learnings.js --project-dir') && files.implement.includes('PROJECT_LEARNINGS_PATH')],
  ['review consumes notes as context', files.review.includes('NOTES_PATH="${FORGEFLOW_DIR}/implementation-notes.md"') && files.review.includes('not proof')],
  ['review consumes project learnings as guidance', files.review.includes('PROJECT_LEARNINGS_PATH="${FORGEFLOW_DIR}/project-learnings.md"') && files.review.includes('project_learnings_content')],
  ['ship summarizes notes', files.ship.includes('"implementation_notes"') && files.ship.includes('do not dump raw notes')],
  ['ship refreshes project learnings', files.ship.includes('show-project-learnings.js') && files.ship.includes('PROJECT_LEARNINGS_PATH="${FORGEFLOW_DIR}/project-learnings.md"')],
  ['recorder helper exists', files.recorder.includes('recordImplementationNotes') && files.recorder.includes('VALID_CATEGORIES')],
  ['recorder installed as runtime helper', files.installManifest.includes('scripts/forgeflow/record-implementation-notes.js')],
  ['recorder appends candidates', recordResult.entries === 2 && notesContent.includes('Record implementation notes as Markdown') && notesContent.includes('Manual verification remains required')],
  ['recorder cli appends candidate', cliResult.status === 0 && notesAfterCli.includes('Review notes before ship')],
  ['recorder executable directly', directResult.status === 0 && directNotesContent.includes('Direct helper execution is supported')],
  ['ship renderer includes implementation notes', renderShipResult.status === 0 && shipHtml.includes('Implementation Notes') && shipHtml.includes('Spec Gaps') && shipHtml.includes('Ownership was clarified')],
  ['ship prepare emits canonical notes schema', shipPrepareResult.status === 0 && preparedSummary.implementation_notes && !preparedSummary.implementationNotes],
  ['ship prepare summarizes log entries', preparedSummary.implementation_notes?.decisions?.[0] === 'Markdown stays canonical - user asked for html or markdown'],
  ['ship prepare renders notes html', preparedHtml.includes('Implementation Notes') && preparedHtml.includes('Ship helper needed a summary bridge')],
  ['ship prepare writes notes check', preparedCheck.status === 'pass' && preparedCheck.ship_summary === preparedSummaryPath],
  ['ship prepare body includes notes check', preparedBody.includes('## Implementation Notes Check') && preparedBody.includes('implementation-notes-check.json')],
  ['ship prepare refreshes project learnings', preparedLearnings.out === path.join(shipNotesDir, 'project-learnings.md')],
  ['ship prepare body includes project learnings', preparedBody.includes('## Project Learnings') && preparedBody.includes('project-learnings-rollup.json')],
  ['atlas present schema includes notes', files.atlasPresent.includes('"implementation_notes"')],
  ['arbiter consult brief requires notes', files.arbiterConsult.includes('## Implementation Notes Requirements')],
  ['arbiter implement verifies notes', files.arbiterImplement.includes('## Implementation Notes') && files.arbiterImplement.includes('Redaction check')],
  ['atlas owns serialization', files.atlas.includes('Maintain implementation notes') && files.atlas.includes('serialize note candidates')],
  ['atlas refreshes project learnings', files.atlas.includes('Refresh project learnings') && files.atlas.includes('rollup-project-learnings.js')],
  ['codex skills mention lean decision', files.skillConsult.includes('render-lean-decision.js') && files.skillConsult.includes('Lean Decision') && files.skillImplement.includes('render-lean-decision.js') && files.skillImplement.includes('known ceiling and upgrade trigger')],
  ['implementers emit candidates', ['smith', 'warden', 'lumen', 'compass'].every((name) => files[name].includes('Implementation Notes Candidates'))],
  ['docs page exists', files.docs.includes('# Implementation Notes') && files.docs.includes('.forgeflow/<project-name>/implementation-notes.md')],
  ['docs linked from home', files.home.includes('[Implementation Notes](Implementation-Notes)')],
  ['docs linked from index', files.index.includes('./wiki/Implementation-Notes.md')],
  ['privacy docs mention notes', files.privacy.includes('implementation notes')],
  ['release check runs notes test', files.releaseCheck.includes('test-implementation-notes.js')],
  ...categories.map((category) => [`category ${category}`, Object.values(files).some((content) => content.includes(category))]),
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

console.log('implementation notes: ok');
