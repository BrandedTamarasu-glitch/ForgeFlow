#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { assertSafeDirectory, isPathInside, safeReadTextFile, writeFileSafe } = require('./file-safety');
const { containsSensitiveContent } = require('./privacy-boundary');

const SCHEMA_VERSION = '1';
const MAX_INPUT_BYTES = 256 * 1024;
const MAX_OBSERVATIONS = 200;
const ID_RE = /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/;
const MAX_ID_LENGTH = 64;
const TOP_LEVEL_FIELDS = new Set(['schema_version', 'observations']);
const OBSERVATION_FIELDS = new Set(['id', 'work_item_id', 'command_chain', 'outcome', 'command_calls', 'decision_output_bytes']);
const OUTCOMES = new Set(['success', 'failure', 'partial', 'cancelled']);

function usage() {
  console.error('Usage: command-interface-evidence.js --input <sanitized.json> [--root <repo>] [--json] [--project-dir <dir> --write-report]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), input: '', projectDir: '', writeReport: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--input') {
      opts.input = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--write-report') {
      opts.writeReport = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!opts.input) throw new Error('Missing required --input');
  if (opts.writeReport !== Boolean(opts.projectDir)) {
    throw new Error('--write-report requires --project-dir, and --project-dir is only accepted with --write-report');
  }
  return opts;
}

function safeError(message) {
  const err = new Error(message);
  err.safe = true;
  return err;
}

function validateId(value, label) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH && ID_RE.test(value)
    ? ''
    : `Invalid ${label}`;
}

function validateFields(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Expected an object';
  return Object.keys(value).every((key) => fields.has(key)) ? '' : 'Input contains unsupported fields';
}

function validateObservation(observation, seenIds) {
  const fieldError = validateFields(observation, OBSERVATION_FIELDS);
  if (fieldError) return fieldError;
  if (containsSensitiveContent(JSON.stringify(observation))) return 'Input contains sensitive-looking content';
  const idError = validateId(observation.id, 'observation id');
  if (idError) return idError;
  if (seenIds.has(observation.id)) return 'Duplicate observation id';
  const workItemError = validateId(observation.work_item_id, 'work item id');
  if (workItemError) return workItemError;
  if (!Array.isArray(observation.command_chain) || observation.command_chain.length < 2 || observation.command_chain.length > 12) {
    return 'Invalid command chain length';
  }
  if (observation.command_chain.some((command) => validateId(command, 'command id'))) return 'Invalid command id';
  if (!OUTCOMES.has(observation.outcome)) return 'Invalid outcome';
  if (!Number.isInteger(observation.command_calls) || observation.command_calls < 1 || observation.command_calls > 100) {
    return 'Invalid command calls';
  }
  if (!Number.isInteger(observation.decision_output_bytes) || observation.decision_output_bytes < 0 || observation.decision_output_bytes > 262144) {
    return 'Invalid decision output bytes';
  }
  seenIds.add(observation.id);
  return '';
}

function validateInput(input) {
  const fieldError = validateFields(input, TOP_LEVEL_FIELDS);
  if (fieldError) throw safeError(fieldError);
  if (input.schema_version !== SCHEMA_VERSION) throw safeError('Unsupported schema version');
  if (!Array.isArray(input.observations) || input.observations.length > MAX_OBSERVATIONS) throw safeError('Invalid observation count');
  const seenIds = new Set();
  for (const observation of input.observations) {
    const error = validateObservation(observation, seenIds);
    if (error) throw safeError(error);
  }
  return input.observations.map((observation) => ({
    id: observation.id,
    work_item_id: observation.work_item_id,
    command_chain: [...observation.command_chain],
    outcome: observation.outcome,
    command_calls: observation.command_calls,
    decision_output_bytes: observation.decision_output_bytes,
  }));
}

function readObservations(inputPath, root) {
  const resolvedRoot = path.resolve(root);
  const resolvedInput = path.resolve(inputPath);
  if (!isPathInside(resolvedRoot, resolvedInput)) throw safeError('Input must remain inside --root');
  let source;
  try {
    const read = safeReadTextFile(resolvedInput, resolvedRoot);
    if (read.stat.size > MAX_INPUT_BYTES) throw safeError('Input exceeds maximum size');
    source = read.content;
  } catch (err) {
    if (err.safe) throw err;
    throw safeError('Unable to read input');
  }
  let input;
  try {
    input = JSON.parse(source);
  } catch (_err) {
    throw safeError('Input must be valid JSON');
  }
  return validateInput(input);
}

function countBy(items, getter) {
  const counts = {};
  for (const item of items) {
    const key = getter(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

function chainStatus(observations) {
  const workItemCount = new Set(observations.map((item) => item.work_item_id)).size;
  const outcomes = countBy(observations, (item) => item.outcome);
  const allSuccessful = (outcomes.success || 0) === observations.length;
  if (!allSuccessful) {
    return {
      status: 'do-not-wrap',
      reason: 'At least one observation did not complete successfully, so this pattern is not stable enough to compare.',
      comparison_required: false,
    };
  }
  if (observations.length >= 3 && workItemCount >= 2) {
    return {
      status: 'candidate-for-human-review',
      reason: 'Repeated successful observations meet the review threshold. A paired comparison is still required before any wrapper decision.',
      comparison_required: true,
    };
  }
  if (observations.length >= 2) {
    return {
      status: 'observe',
      reason: 'The pattern repeats, but needs at least three observations across two work items before human review.',
      comparison_required: false,
    };
  }
  return {
    status: 'insufficient-evidence',
    reason: 'One observation cannot establish a repeatable command pattern.',
    comparison_required: false,
  };
}

function summarizeNumbers(observations, field) {
  const values = observations.map((item) => item[field]);
  const total = values.reduce((sum, value) => sum + value, 0);
  return { total, min: values.length ? Math.min(...values) : 0, max: values.length ? Math.max(...values) : 0 };
}

function buildCommandInterfaceEvidence(observations) {
  const groups = new Map();
  for (const observation of observations) {
    const key = observation.command_chain.join(' > ');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(observation);
  }
  const findings = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chain, group]) => {
      const verdict = chainStatus(group);
      return {
        chain: chain.split(' > '),
        observation_count: group.length,
        distinct_work_item_count: new Set(group.map((item) => item.work_item_id)).size,
        outcomes: countBy(group, (item) => item.outcome),
        command_calls: summarizeNumbers(group, 'command_calls'),
        decision_output_bytes: summarizeNumbers(group, 'decision_output_bytes'),
        ...verdict,
      };
    });
  const subchains = new Map();
  for (const observation of observations) {
    for (let index = 0; index < observation.command_chain.length - 1; index += 1) {
      const chain = observation.command_chain.slice(index, index + 2);
      const key = chain.join(' > ');
      if (!subchains.has(key)) subchains.set(key, []);
      subchains.get(key).push(observation);
    }
  }
  const subchainFindings = [...subchains.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chain, group]) => ({
      chain: chain.split(' > '), chain_kind: 'contiguous-pair', observation_count: group.length,
      distinct_work_item_count: new Set(group.map((item) => item.work_item_id)).size,
      outcomes: countBy(group, (item) => item.outcome), command_calls: summarizeNumbers(group, 'command_calls'),
      decision_output_bytes: summarizeNumbers(group, 'decision_output_bytes'), ...chainStatus(group),
    }));
  const statuses = [...findings, ...subchainFindings].map((finding) => finding.status);
  const status = statuses.includes('candidate-for-human-review') ? 'candidate-for-human-review'
    : statuses.includes('observe') ? 'observe'
      : statuses.includes('do-not-wrap') ? 'do-not-wrap'
        : 'insufficient-evidence';
  const next = status === 'candidate-for-human-review'
    ? 'run-a-paired-baseline-versus-wrapper-comparison'
    : 'collect-sanitized-command-chain-observations';
  const nextReason = status === 'candidate-for-human-review'
    ? 'The repeat-pattern threshold is met, but V1 cannot establish benefit or approve a wrapper.'
    : 'More explicit sanitized observations are needed before a paired comparison is appropriate.';
  return {
    schema_version: SCHEMA_VERSION,
    status,
    summary: observations.length === 0
      ? 'No sanitized observations were supplied; no command pattern can be assessed.'
      : `${observations.length} sanitized observations produced ${findings.length} command-chain finding${findings.length === 1 ? '' : 's'}.`,
    observation_count: observations.length,
    finding_count: findings.length,
    findings,
    subchain_findings: subchainFindings,
    next,
    next_reason: nextReason,
    raw_evidence_read: false,
    boundary: 'This read-only audit uses only explicitly supplied sanitized identifiers, outcomes, and counts. It does not collect history, read or link raw evidence, measure savings, create wrappers, edit commands, run subprocesses, use the network, or change configuration.',
  };
}

function reportDirectory(root, projectDir) {
  const expectedParent = path.join(path.resolve(root), '.forgeflow');
  const resolvedProject = path.resolve(projectDir);
  if (path.dirname(resolvedProject) !== expectedParent || !ID_RE.test(path.basename(resolvedProject))) {
    throw safeError('Project directory must be a direct .forgeflow project directory inside --root');
  }
  return path.join(resolvedProject, 'context', 'command-interface-evidence');
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Command Interface Evidence',
    '',
    `Status: ${result.status}`,
    `Summary: ${result.summary}`,
    '',
    '## Full Workflow Findings',
    '',
  ];
  if (result.findings.length === 0) lines.push('- No findings.');
  for (const finding of result.findings) {
    lines.push(`- ${finding.chain.join(' > ')}: ${finding.status}`);
    lines.push(`  - Observations: ${finding.observation_count}; work items: ${finding.distinct_work_item_count}`);
    lines.push(`  - Outcomes: ${Object.entries(finding.outcomes).map(([name, count]) => `${name} ${count}`).join(', ')}`);
    lines.push(`  - Calls observed: ${finding.command_calls.total}; decision-output bytes observed: ${finding.decision_output_bytes.total}`);
    lines.push(`  - Why: ${finding.reason}`);
  }
  lines.push('', '## Shared Contiguous-Pair Findings', '');
  if (!result.subchain_findings || result.subchain_findings.length === 0) lines.push('- None.');
  for (const finding of result.subchain_findings || []) {
    lines.push(`- ${finding.chain.join(' > ')}: ${finding.status} (shared contiguous pair)`);
    lines.push(`  - Observations: ${finding.observation_count}; work items: ${finding.distinct_work_item_count}`);
    lines.push(`  - Why: ${finding.reason}`);
  }
  lines.push('', `Next: ${result.next}`, `Why: ${result.next_reason}`, '', result.boundary, '');
  return lines.join('\n');
}

function writeReport(result, root, projectDir) {
  const dir = reportDirectory(root, projectDir);
  assertSafeDirectory(path.dirname(dir));
  const jsonPath = path.join(dir, 'command-interface-evidence.json');
  const markdownPath = path.join(dir, 'command-interface-evidence.md');
  writeFileSafe(jsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  writeFileSafe(markdownPath, renderMarkdown(result), 'utf8');
  return { json: jsonPath, markdown: markdownPath };
}

function runCommandInterfaceEvidence(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const observations = opts.observations || readObservations(opts.input, root);
  const result = buildCommandInterfaceEvidence(observations);
  if (opts.writeReport) result.report = writeReport(result, root, opts.projectDir);
  return result;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = runCommandInterfaceEvidence(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(1);
  }
}

module.exports = {
  buildCommandInterfaceEvidence,
  parseArgs,
  readObservations,
  renderMarkdown,
  runCommandInterfaceEvidence,
  validateInput,
  writeReport,
};
