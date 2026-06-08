#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  appendFileSafe,
  isPathInside,
  safeReadTextFile,
  writeFileSafe,
  writeJsonSafe,
} = require('./file-safety');
const {
  assertRegularInside,
  defaultProjectDir,
  normalizeRelPath,
  readProposal,
  runValidation,
  timestamp,
} = require('./run-review-autofix-sandbox');

function usage() {
  console.error('Usage: apply-review-autofix-proposal.js --proposal <proposal.json> [--root <dir>] [--project-dir <dir>] [--allow-dirty] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = {
    proposal: '',
    root: process.cwd(),
    projectDir: '',
    allowDirty: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--proposal') {
      opts.proposal = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--allow-dirty') {
      opts.allowDirty = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!opts.proposal) throw new Error('Missing --proposal');
  return opts;
}

function git(args, cwd) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', shell: false });
}

function trackedWorktreeDirty(root) {
  const inside = git(['rev-parse', '--is-inside-work-tree'], root);
  if (inside.status !== 0 || inside.stdout.trim() !== 'true') return false;
  const status = git(['status', '--porcelain', '--untracked-files=no'], root);
  if (status.status !== 0) throw new Error(`Unable to inspect git status: ${status.stderr || 'unknown error'}`);
  return status.stdout.trim().length > 0;
}

function proposalId(artifact) {
  return String(artifact.finding?.id || artifact.id || 'proposal')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'proposal';
}

function assertProjectOut(file, projectDir, label) {
  const resolved = path.resolve(file);
  if (!isPathInside(path.resolve(projectDir), resolved)) {
    throw new Error(`${label} must stay inside --project-dir`);
  }
  return resolved;
}

function validateArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object') throw new Error('Proposal artifact must be an object');
  if (artifact.status !== 'proposed') throw new Error(`Proposal artifact is not applyable: status ${artifact.status || '(missing)'}`);
  if (!artifact.finding?.policy?.proposal_allowed) throw new Error('Proposal artifact is missing proposal-allowed policy evidence');
  if (!Array.isArray(artifact.operations) || artifact.operations.length !== 1) {
    throw new Error('Apply v1 requires exactly one proposal operation');
  }
  const operation = artifact.operations[0];
  if (String(operation.op || operation.type || '') !== 'replace') {
    throw new Error('Apply v1 only supports deterministic replace operations');
  }
  return operation;
}

function applyReplace(root, operation) {
  const rel = normalizeRelPath(operation.file || operation.path || operation.target_file);
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) throw new Error(`Proposal target does not exist: ${rel}`);
  assertRegularInside(file, root, 'source target');
  const prior = safeReadTextFile(file, root).content;
  const search = String(operation.search ?? '');
  if (!search) throw new Error(`Replace operation for ${rel} is missing search text`);
  const count = prior.split(search).length - 1;
  if (count !== 1) throw new Error(`Replace operation for ${rel} matched ${count} time(s), expected 1`);
  writeFileSafe(file, prior.replace(search, String(operation.replace ?? '')));
  return { file: rel, prior };
}

function restore(root, originals) {
  for (const original of originals.reverse()) {
    writeFileSafe(path.join(root, original.file), original.prior);
  }
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Review-Auto Proposal Apply',
    '',
    `Status: ${result.status}`,
    `Proposal: ${result.proposal_file}`,
    '',
    result.boundary,
    '',
    '## Changed Files',
    '',
  ];
  for (const file of result.changed_files) lines.push(`- ${file}`);
  if (result.changed_files.length === 0) lines.push('- None.');
  lines.push('', '## Validation', '');
  for (const check of result.validation) {
    lines.push(`- ${check.status}: ${check.command} ${check.args.join(' ')}`.trim());
  }
  if (result.validation.length === 0) lines.push('- None declared.');
  lines.push('');
  return lines.join('\n');
}

function applyReviewAutofixProposal(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  if (!opts.allowDirty && trackedWorktreeDirty(root)) {
    throw new Error('Refusing to apply proposal with tracked worktree changes');
  }
  const proposalFile = path.resolve(opts.proposal);
  const artifact = readProposal(proposalFile);
  const operation = validateArtifact(artifact);
  const outDir = assertProjectOut(
    path.join(projectDir, 'review-auto', 'applied', `${proposalId(artifact)}-${timestamp()}`),
    projectDir,
    'apply output',
  );
  const originals = [];
  let validation = [];
  let status = 'applied';
  try {
    originals.push(applyReplace(root, operation));
    validation = (Array.isArray(artifact.validations_requested) ? artifact.validations_requested : []).map((entry) => runValidation(root, entry));
    if (validation.some((entry) => entry.status !== 'pass')) {
      status = 'validation-failed-rolled-back';
      restore(root, originals);
    }
  } catch (err) {
    restore(root, originals);
    throw err;
  }
  const result = {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    status,
    root,
    project_dir: projectDir,
    proposal_file: proposalFile,
    changed_files: status === 'applied' ? originals.map((item) => item.file) : [],
    validation,
    artifacts: {
      json: path.join(outDir, 'apply.json'),
      md: path.join(outDir, 'apply.md'),
      history: path.join(projectDir, 'review-auto', 'apply-history.jsonl'),
    },
    boundary: 'Apply is local and explicit. It does not commit, push, publish, call GitHub, dispatch workers, or apply more than one proposal.',
  };
  writeJsonSafe(result.artifacts.json, result);
  writeFileSafe(result.artifacts.md, renderMarkdown(result));
  appendFileSafe(result.artifacts.history, `${JSON.stringify({
    ts: result.generated_at,
    status: result.status,
    proposal_file: result.proposal_file,
    changed_files: result.changed_files,
  })}\n`);
  return result;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = applyReviewAutofixProposal(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  if (result.status !== 'applied') process.exit(1);
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
  applyReviewAutofixProposal,
  parseArgs,
  renderMarkdown,
  trackedWorktreeDirty,
};
