#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  parseArgs,
  publicSafeSummary,
  renderMarkdown,
  rollupAgentFeedback,
} = require('./rollup-agent-feedback');

const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-agent-feedback-rollup-'));
fs.writeFileSync(path.join(projectDir, 'agent-feedback.jsonl'), [
  JSON.stringify({ schema_version: '1', agent: 'smith_reviewer', signal: 'useful', summary: 'Explained query risk clearly', confidence: 'high', evidence_count: 2 }),
  JSON.stringify({ schema_version: '1', agent: 'smith_reviewer', signal: 'incorrect', summary: 'Flagged a safe query as unsafe', confidence: 'high', evidence_count: 2 }),
  JSON.stringify({ schema_version: '1', agent: 'warden_reviewer', signal: 'unclear', summary: 'Asked for proof without naming the boundary', confidence: 'medium', evidence_count: 1 }),
  JSON.stringify({ schema_version: '1', agent: 'atlas_reviewer', signal: 'ignored', summary: 'Checked /home/corye/.ssh/config during review', confidence: 'medium', evidence_count: 2 }),
  '{bad',
  JSON.stringify({ schema_version: '1', agent: 'warden_reviewer', signal: 'incorrect', summary: 'Review https://example.internal/team', confidence: 'high', evidence_count: 2 }),
].join('\n'));

const result = rollupAgentFeedback({ projectDir });
const markdown = renderMarkdown(result);
const customOut = path.join(projectDir, 'context', 'custom-feedback.json');
const custom = rollupAgentFeedback(parseArgs([
  '--project-dir',
  projectDir,
  '--out',
  customOut,
  '--json',
]));
const missing = rollupAgentFeedback({ projectDir: path.join(projectDir, 'missing') });
const emptyDir = path.join(projectDir, 'empty');
fs.mkdirSync(emptyDir, { recursive: true });
fs.writeFileSync(path.join(emptyDir, 'agent-feedback.jsonl'), '\n');
const empty = rollupAgentFeedback({ projectDir: emptyDir });
const invalidDir = path.join(projectDir, 'invalid');
fs.mkdirSync(invalidDir, { recursive: true });
fs.writeFileSync(path.join(invalidDir, 'agent-feedback.jsonl'), '{bad\n');
const invalid = rollupAgentFeedback({ projectDir: invalidDir });

const checks = [
  ['schema version', result.schema_version === '1'],
  ['writes artifacts', fs.existsSync(result.artifacts.json) && fs.existsSync(result.artifacts.markdown)],
  ['counts valid records', result.status === 'present' && result.records === 4],
  ['counts signals', result.by_signal.useful === 1 && result.by_signal.incorrect === 1 && result.by_signal.unclear === 1 && result.by_signal.ignored === 1],
  ['counts agents', result.by_agent.smith_reviewer === 2 && result.by_agent.warden_reviewer === 1],
  ['counts quality', result.promotable === 3 && result.corrective === 3 && result.agents.smith_reviewer.corrective === 1],
  ['skips invalid and private lines', result.skipped_lines === 2 && result.skipped_reasons.some((item) => item.reason === 'malformed-json') && result.skipped_reasons.some((item) => item.reason === 'privacy-boundary')],
  ['latest examples are safe', result.latest_examples.length === 4 && result.latest_examples.some((item) => item.summary.includes('redacted feedback summary')) && !JSON.stringify(result).includes('example.internal') && !JSON.stringify(result).includes('/home/corye/.ssh/config')],
  ['public safe summary redacts heuristic misses', publicSafeSummary('path=/home/corye/.ssh/config').includes('redacted feedback summary') && publicSafeSummary('Checked /home/corye/.ssh/config').includes('redacted feedback summary')],
  ['status paths covered', missing.status === 'missing' && empty.status === 'empty' && invalid.status === 'invalid'],
  ['markdown renders advisory rollup', markdown.includes('# Forgeflow Agent Feedback Rollup') && markdown.includes('Advisory only') && markdown.includes('smith_reviewer') && markdown.includes('Skipped lines: 2') && !markdown.includes('example.internal')],
  ['custom output works', custom.artifacts.json === customOut && custom.artifacts.markdown === customOut.replace(/\.json$/, '.md') && fs.existsSync(custom.artifacts.json)],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('agent feedback rollup: ok');
