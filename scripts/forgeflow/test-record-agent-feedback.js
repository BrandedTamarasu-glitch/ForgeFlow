#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  normalizeFeedback,
  parseArgs,
  promotionCategory,
  recordAgentFeedback,
  rollupFeedback,
} = require('./record-agent-feedback');

const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-agent-feedback-'));
const result = recordAgentFeedback({
  projectDir,
  agent: 'smith_reviewer',
  signal: 'incorrect',
  summary: 'Flagged a safe query as unsafe',
  correction: 'The query used parameter binding',
  confidence: 'high',
  evidenceCount: 2,
  workItem: 'auth-review',
  promote: true,
});
const second = recordAgentFeedback({
  projectDir,
  agent: 'warden_reviewer',
  signal: 'useful',
  summary: 'Caught missing permission check',
  confidence: 'medium',
  evidenceCount: 1,
});
const cliOut = path.join(projectDir, 'cli');
fs.mkdirSync(cliOut, { recursive: true });
let cli = { status: 0 };
let cliJson = {};
try {
  cliJson = recordAgentFeedback(parseArgs([
    '--project-dir',
    cliOut,
    '--agent',
    'lumen_reviewer',
    '--signal',
    'unclear',
    '--summary',
    'Suggested UI copy without enough context',
    '--confidence',
    'medium',
    '--evidence-count',
    '2',
    '--json',
  ]));
} catch (err) {
  cli = { status: 1, stderr: err.message };
}
const invalid = (() => {
  try {
    normalizeFeedback({ agent: 'smith', signal: 'bad', summary: 'x' });
    return false;
  } catch (_err) {
    return true;
  }
})();
let sensitive = { status: 0, stderr: '' };
try {
  recordAgentFeedback({
    projectDir,
    agent: 'smith_reviewer',
    signal: 'incorrect',
    summary: 'token=SHOULD_NOT_RECORD',
  });
} catch (err) {
  sensitive = { status: 1, stderr: err.message };
}
let lowPromotion = { status: 0, stderr: '' };
try {
  recordAgentFeedback({
    projectDir: path.join(projectDir, 'low-promotion'),
    agent: 'smith_reviewer',
    signal: 'incorrect',
    summary: 'Needs more proof before promotion',
    evidenceCount: 1,
    promote: true,
  });
} catch (err) {
  lowPromotion = { status: 1, stderr: err.message };
}
const lowPromotionFile = path.join(projectDir, 'low-promotion', 'agent-feedback.jsonl');
const promotedPlainDir = path.join(projectDir, 'promoted-plain');
let promotedPlain = { status: 0, stdout: '' };
try {
  const promoted = recordAgentFeedback({
    projectDir: promotedPlainDir,
    agent: 'smith_reviewer',
    signal: 'incorrect',
    summary: 'Flagged a safe query as unsafe',
    correction: 'The query used parameter binding',
    confidence: 'high',
    evidenceCount: 2,
    promote: true,
  });
  promotedPlain = { status: 0, stdout: `Project learning promoted to ${promoted.promoted.file}` };
} catch (err) {
  promotedPlain = { status: 1, stderr: err.message, stdout: '' };
}
function rejectedFeedback(summary) {
  try {
    recordAgentFeedback({
      projectDir,
      agent: 'warden_reviewer',
      signal: 'incorrect',
      summary,
    });
    return { status: 0, stderr: '' };
  } catch (err) {
    return { status: 1, stderr: err.message };
  }
}
const privateUrl = rejectedFeedback('The internal dashboard URL is https://example.internal/team');
const barePrivateHost = rejectedFeedback('Review example.internal/team before approving');
const fileLink = rejectedFeedback('Open [local file](file:///etc/passwd) before review');
const sourceSnippet = rejectedFeedback('Suggested changing const query = sql`select * from users`');
const inlineSnippet = rejectedFeedback('The reviewer cited `updateUser()` directly');
const settingsBlob = rejectedFeedback('statusLine: node /private/hook.js');
const quotedSettingsBlob = rejectedFeedback("'statusLine': node /private/hook.js");
const promotedCandidates = fs.readFileSync(path.join(projectDir, 'project-learning-candidates.jsonl'), 'utf8');
const rollup = rollupFeedback([result.record, second.record]);

const checks = [
  ['writes feedback', fs.existsSync(result.file) && fs.readFileSync(result.file, 'utf8').includes('smith_reviewer')],
  ['rollup counts signals', result.rollup.by_signal.incorrect === 1 && second.rollup.records === 2],
  ['promotes supported feedback', result.promoted && promotedCandidates.includes('Agent guidance needed correction')],
  ['promotion category', promotionCategory('useful') === 'stable-decision' && promotionCategory('ignored') === 'repeated-follow-up'],
  ['cli writes json', cli.status === 0 && cliJson.record.signal === 'unclear'],
  ['invalid signal rejected', invalid],
  ['sensitive summary rejected', sensitive.status === 1 && sensitive.stderr.includes('privacy boundary')],
  ['low evidence promotion rejected', lowPromotion.status === 1 && lowPromotion.stderr.includes('promotion requires')],
  ['failed promotion does not write feedback', !fs.existsSync(lowPromotionFile)],
  ['plain promotion output names learning file', promotedPlain.status === 0 && promotedPlain.stdout.includes('Project learning promoted to')],
  ['private url rejected', privateUrl.status === 1 && privateUrl.stderr.includes('privacy boundary')],
  ['bare private host rejected', barePrivateHost.status === 1 && barePrivateHost.stderr.includes('privacy boundary')],
  ['file link rejected', fileLink.status === 1 && fileLink.stderr.includes('privacy boundary')],
  ['source snippet rejected', sourceSnippet.status === 1 && sourceSnippet.stderr.includes('privacy boundary')],
  ['inline snippet rejected', inlineSnippet.status === 1 && inlineSnippet.stderr.includes('privacy boundary')],
  ['settings blob rejected', settingsBlob.status === 1 && settingsBlob.stderr.includes('privacy boundary')],
  ['quoted settings blob rejected', quotedSettingsBlob.status === 1 && quotedSettingsBlob.stderr.includes('privacy boundary')],
  ['manual rollup counts promotable', rollup.promotable === 1],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('agent feedback: ok');
