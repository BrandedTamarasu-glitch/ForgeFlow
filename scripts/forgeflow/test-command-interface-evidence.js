#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildCommandInterfaceEvidence,
  parseArgs,
  readObservations,
  renderMarkdown,
  runCommandInterfaceEvidence,
  validateInput,
} = require('./command-interface-evidence');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-command-interface-evidence-'));
const inputDir = path.join(root, 'inputs');
fs.mkdirSync(inputDir, { recursive: true });

function observation(id, workItemId, outcome = 'success') {
  return {
    id,
    work_item_id: workItemId,
    command_chain: ['forgeflow-health', 'forgeflow-smoke'],
    outcome,
    command_calls: 2,
    decision_output_bytes: 400,
  };
}

function writeInput(name, value) {
  const file = path.join(inputDir, name);
  fs.writeFileSync(file, JSON.stringify(value), 'utf8');
  return file;
}

function rejected(action) {
  try {
    action();
    return false;
  } catch (_err) {
    return true;
  }
}

const minimum = buildCommandInterfaceEvidence([observation('one', 'work-one')]);
const repeat = buildCommandInterfaceEvidence([
  observation('one', 'work-one'),
  observation('two', 'work-two'),
  observation('three', 'work-two'),
]);
const failed = buildCommandInterfaceEvidence([
  observation('one', 'work-one'),
  observation('two', 'work-two', 'failure'),
]);
const validInput = writeInput('valid.json', { schema_version: '1', observations: [observation('one', 'work-one')] });
const loaded = readObservations(validInput, root);
const reportProject = path.join(root, '.forgeflow', 'demo-project');
const report = runCommandInterfaceEvidence({ root, input: validInput, projectDir: reportProject, writeReport: true });
const reportText = fs.readFileSync(report.report.markdown, 'utf8');
const noWrite = runCommandInterfaceEvidence({ root, input: validInput });
const deterministicA = JSON.stringify(buildCommandInterfaceEvidence(loaded));
const deterministicB = JSON.stringify(buildCommandInterfaceEvidence(loaded));

const malformed = rejected(() => validateInput({ schema_version: '1', observations: [{ id: 'one' }] }));
const unknownField = rejected(() => validateInput({ schema_version: '1', observations: [{ ...observation('one', 'work-one'), argv: 'do not accept' }] }));
const secretValue = rejected(() => validateInput({ schema_version: '1', observations: [{ ...observation('one', 'work-one'), work_item_id: 'token=supersecretvalue' }] }));
const rawLikeField = rejected(() => validateInput({ schema_version: '1', observations: [{ ...observation('one', 'work-one'), stdout: 'raw diagnostic' }] }));
const invalidBounds = rejected(() => validateInput({ schema_version: '1', observations: [{ ...observation('one', 'work-one'), command_calls: 101 }] }));
const invalidEnum = rejected(() => validateInput({ schema_version: '1', observations: [{ ...observation('one', 'work-one'), outcome: 'maybe' }] }));
const duplicateIds = rejected(() => validateInput({ schema_version: '1', observations: [observation('one', 'work-one'), observation('one', 'work-two')] }));
const outside = rejected(() => readObservations(path.join(os.tmpdir(), 'outside-command-interface-evidence.json'), root));
const unsafeProject = rejected(() => runCommandInterfaceEvidence({ root, input: validInput, projectDir: path.join(root, 'elsewhere'), writeReport: true }));
const invalidWriteArgs = rejected(() => parseArgs(['--input', validInput, '--project-dir', reportProject]));
const rendered = renderMarkdown(repeat);
const sharedPair = buildCommandInterfaceEvidence([
  { ...observation('pair-one', 'work-one'), command_chain: ['forgeflow-health', 'forgeflow-smoke', 'forgeflow-report'] },
  { ...observation('pair-two', 'work-two'), command_chain: ['forgeflow-health', 'forgeflow-smoke', 'forgeflow-trends'] },
  { ...observation('pair-three', 'work-three'), command_chain: ['forgeflow-health', 'forgeflow-smoke', 'forgeflow-status'] },
]);

const checks = [
  ['minimum observation is insufficient evidence', minimum.status === 'insufficient-evidence' && minimum.findings[0].status === 'insufficient-evidence'],
  ['repeat pattern needs human review and comparison', repeat.status === 'candidate-for-human-review' && repeat.findings[0].comparison_required === true],
  ['poor outcome does not recommend wrapping', failed.status === 'do-not-wrap' && failed.findings[0].comparison_required === false],
  ['reads only explicit versioned input', loaded.length === 1 && loaded[0].id === 'one'],
  ['rejects malformed observation', malformed],
  ['rejects unknown fields', unknownField && rawLikeField],
  ['rejects sensitive-looking content without report leakage', secretValue && !reportText.includes('supersecretvalue')],
  ['rejects invalid bounds and enum', invalidBounds && invalidEnum],
  ['rejects duplicate ids', duplicateIds],
  ['rejects out-of-boundary input', outside],
  ['does not write by default', !Object.hasOwn(noWrite, 'report')],
  ['writes only confined aggregate reports', fs.existsSync(report.report.json) && report.report.json.startsWith(`${reportProject}${path.sep}`) && reportText.includes('Status: insufficient-evidence')],
  ['rejects unsafe report directory and incomplete write intent', unsafeProject && invalidWriteArgs],
  ['output is deterministic and never claims savings or wrapper creation', deterministicA === deterministicB && !rendered.match(/saves?\s+\d|lower\s+(token|call)|better success|wrapper\s+(was|is)\s+created/i)],
  ['result declares raw evidence unread', repeat.raw_evidence_read === false && repeat.boundary.includes('does not collect history')],
  ['shared contiguous pair can reach human review without treating full chains as equal', sharedPair.subchain_findings.some((item) => item.chain_kind === 'contiguous-pair' && item.status === 'candidate-for-human-review')],
  ['markdown explains shared pairs separately', renderMarkdown(sharedPair).includes('## Shared Contiguous-Pair Findings') && renderMarkdown(sharedPair).includes('shared contiguous pair')],
];

let failedChecks = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failedChecks += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failedChecks > 0) process.exit(1);
console.log('command interface evidence: ok');
