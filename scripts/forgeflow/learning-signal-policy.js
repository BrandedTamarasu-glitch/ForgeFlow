#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { safeReadTextFile, writeFileSafe } = require('./file-safety');

const DEFAULT_POLICY = {
  schema_version: '1',
  aging_unreinforced_days: 30,
  stale_unreinforced_days: 90,
  aging_penalty: 15,
  stale_penalty: 30,
  missing_penalty: 20,
  reinforcement_records: 3,
  boundary: 'Learning-signal policy only tunes advisory trust decay. It does not promote guidance, approve work, or override current evidence.',
};

function policyPath(projectDir) {
  return path.join(projectDir, 'learning-signal-policy.json');
}

function assertForgeflowProjectDir(projectDir) {
  const resolved = path.resolve(projectDir || '');
  const segments = resolved.split(path.sep).filter(Boolean);
  const markerIndex = segments.indexOf('.forgeflow');
  if (markerIndex < 0 || markerIndex >= segments.length - 1) {
    throw new Error('--project-dir must be a .forgeflow/<project> directory or child path');
  }
  return resolved;
}

function normalizePolicy(value = {}) {
  const policy = { ...DEFAULT_POLICY, ...(value || {}) };
  for (const key of ['aging_unreinforced_days', 'stale_unreinforced_days', 'aging_penalty', 'stale_penalty', 'missing_penalty', 'reinforcement_records']) {
    const number = Number(policy[key]);
    policy[key] = Number.isFinite(number) && number >= 0 ? Math.round(number) : DEFAULT_POLICY[key];
  }
  if (policy.stale_unreinforced_days < policy.aging_unreinforced_days) {
    policy.stale_unreinforced_days = policy.aging_unreinforced_days;
  }
  policy.schema_version = '1';
  policy.boundary = DEFAULT_POLICY.boundary;
  return policy;
}

function readLearningSignalPolicy(projectDir) {
  const safeProjectDir = assertForgeflowProjectDir(projectDir);
  const file = policyPath(safeProjectDir);
  if (!fs.existsSync(file)) return { policy: DEFAULT_POLICY, file, status: 'default' };
  try {
    return {
      policy: normalizePolicy(JSON.parse(safeReadTextFile(file, safeProjectDir).content)),
      file,
      status: 'custom',
    };
  } catch (err) {
    return { policy: DEFAULT_POLICY, file, status: 'invalid', error: err.message };
  }
}

function writeLearningSignalPolicy(projectDir, policy = DEFAULT_POLICY) {
  const safeProjectDir = assertForgeflowProjectDir(projectDir);
  const file = policyPath(safeProjectDir);
  const normalized = normalizePolicy(policy);
  writeFileSafe(file, `${JSON.stringify(normalized, null, 2)}\n`);
  return { policy: normalized, file, status: 'written' };
}

function compareLearningSignalPolicy(projectDir, proposedFile) {
  const current = readLearningSignalPolicy(projectDir);
  const safeProjectDir = assertForgeflowProjectDir(projectDir);
  const proposedPath = path.resolve(proposedFile);
  const proposed = normalizePolicy(JSON.parse(safeReadTextFile(proposedPath, path.dirname(proposedPath)).content));
  const fields = ['aging_unreinforced_days', 'stale_unreinforced_days', 'aging_penalty', 'stale_penalty', 'missing_penalty', 'reinforcement_records'];
  const changes = fields
    .filter((field) => current.policy[field] !== proposed[field])
    .map((field) => ({
      field,
      current: current.policy[field],
      proposed: proposed[field],
      delta: proposed[field] - current.policy[field],
      impact: field.endsWith('_days')
        ? (proposed[field] < current.policy[field] ? 'decays-sooner' : 'decays-later')
        : (proposed[field] > current.policy[field] ? 'stronger-penalty' : 'weaker-penalty'),
    }));
  return {
    schema_version: '1',
    status: changes.length ? 'changed' : 'unchanged',
    project_dir: safeProjectDir,
    current_status: current.status,
    current_file: current.file,
    proposed_file: proposedPath,
    changes,
    current: current.policy,
    proposed,
    boundary: 'Learning policy comparison is read-only. It previews advisory policy deltas only; it does not write files, promote guidance, approve work, or override evidence.',
  };
}

function usage() {
  console.error('Usage: learning-signal-policy.js --project-dir <dir> [--seed] [--compare <json>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { projectDir: '', seed: false, compare: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--seed') {
      opts.seed = true;
    } else if (arg === '--compare') {
      opts.compare = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!opts.projectDir) throw new Error('Missing --project-dir');
  return opts;
}

function renderMarkdown(result) {
  if (result.changes) return renderComparisonMarkdown(result);
  const policy = result.policy;
  return [
    '# Forgeflow Learning Signal Policy',
    '',
    `Status: ${result.status}`,
    `File: ${result.file}`,
    '',
    policy.boundary,
    '',
    `- Aging unreinforced days: ${policy.aging_unreinforced_days}`,
    `- Stale unreinforced days: ${policy.stale_unreinforced_days}`,
    `- Aging penalty: ${policy.aging_penalty}`,
    `- Stale penalty: ${policy.stale_penalty}`,
    `- Missing penalty: ${policy.missing_penalty}`,
    `- Reinforcement records: ${policy.reinforcement_records}`,
    '',
  ].join('\n');
}

function renderComparisonMarkdown(result) {
  const lines = [
    '# Forgeflow Learning Signal Policy Comparison',
    '',
    `Status: ${result.status}`,
    `Current: ${result.current_file} (${result.current_status})`,
    `Proposed: ${result.proposed_file}`,
    '',
    result.boundary,
    '',
    '## Changes',
    '',
  ];
  if (result.changes.length === 0) lines.push('- None.');
  else for (const change of result.changes) {
    lines.push(`- ${change.field}: ${change.current} -> ${change.proposed} (${change.impact})`);
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  let result;
  if (opts.compare) result = compareLearningSignalPolicy(opts.projectDir, opts.compare);
  else result = opts.seed
    ? writeLearningSignalPolicy(opts.projectDir)
    : readLearningSignalPolicy(opts.projectDir);
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
  DEFAULT_POLICY,
  compareLearningSignalPolicy,
  normalizePolicy,
  policyPath,
  readLearningSignalPolicy,
  renderComparisonMarkdown,
  renderMarkdown,
  writeLearningSignalPolicy,
};
