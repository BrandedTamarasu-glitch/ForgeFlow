#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { classifyReviewAuto } = require('./classify-review-auto');
const {
  isPathInside,
  safeReadTextFile,
  writeFileSafe,
  writeJsonSafe,
} = require('./file-safety');

function usage() {
  console.error('Usage: run-review-autofix-sandbox.js --proposal <json> [--root <dir>] [--project-dir <dir>] [--json]');
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

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function readProposal(file) {
  const content = safeReadTextFile(file, path.dirname(file)).content;
  const proposal = JSON.parse(content);
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
    throw new Error('Proposal JSON must be an object');
  }
  return proposal;
}

function normalizeRelPath(file) {
  const rel = String(file || '').replace(/\\/g, '/');
  if (!rel) throw new Error('Proposal operation is missing file');
  if (path.isAbsolute(rel)) throw new Error(`Refusing absolute proposal path: ${rel}`);
  const segments = rel.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error(`Refusing unsafe proposal path: ${rel}`);
  }
  return rel;
}

function assertRegularInside(file, root, label) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink()) throw new Error(`Refusing ${label} symlink: ${file}`);
  if (!stat.isFile()) throw new Error(`Refusing ${label} non-file: ${file}`);
  const realRoot = fs.realpathSync(root);
  const realFile = fs.realpathSync(file);
  if (!isPathInside(realRoot, realFile)) {
    throw new Error(`Refusing ${label} outside allowed root: ${file}`);
  }
}

function proposalId(proposal, item) {
  return String(proposal.id || item.id || 'proposal')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'proposal';
}

function timestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[:]/g, '');
}

function copySandbox(root) {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-review-autofix-'));
  fs.cpSync(root, sandbox, {
    recursive: true,
    dereference: false,
    filter: (source) => {
      const rel = path.relative(root, source).replace(/\\/g, '/');
      return rel !== '.git'
        && !rel.startsWith('.git/')
        && rel !== 'node_modules'
        && !rel.startsWith('node_modules/')
        && rel !== '.forgeflow'
        && !rel.startsWith('.forgeflow/');
    },
  });
  return sandbox;
}

function applyOperation(root, operation) {
  const op = String(operation.op || operation.type || '').trim();
  const rel = normalizeRelPath(operation.file || operation.path || operation.target_file);
  const file = path.join(root, rel);
  if (!fs.existsSync(file) && op !== 'write') {
    throw new Error(`Proposal target does not exist in sandbox: ${rel}`);
  }
  if (fs.existsSync(file)) assertRegularInside(file, root, 'sandbox target');

  if (op === 'replace') {
    const search = String(operation.search ?? '');
    if (!search) throw new Error(`Replace operation for ${rel} is missing search text`);
    const prior = safeReadTextFile(file, root).content;
    const count = prior.split(search).length - 1;
    if (count !== 1) throw new Error(`Replace operation for ${rel} matched ${count} time(s), expected 1`);
    writeFileSafe(file, prior.replace(search, String(operation.replace ?? '')));
    return rel;
  }

  if (op === 'write') {
    const parent = path.dirname(file);
    if (!isPathInside(root, parent)) throw new Error(`Refusing write outside sandbox: ${rel}`);
    if (fs.existsSync(file)) assertRegularInside(file, root, 'sandbox target');
    writeFileSafe(file, String(operation.content ?? ''));
    return rel;
  }

  throw new Error(`Unsupported proposal operation: ${op || '(missing)'}`);
}

function runValidation(sandbox, validation) {
  const command = String(validation.command || '').trim();
  if (!command) throw new Error('Validation entry is missing command');
  const args = Array.isArray(validation.args) ? validation.args.map((arg) => String(arg)) : [];
  if (/[\\/]/.test(command) && !path.isAbsolute(command)) {
    throw new Error(`Validation command must be a binary name or absolute path: ${command}`);
  }
  const result = spawnSync(command, args, {
    cwd: sandbox,
    encoding: 'utf8',
    shell: false,
    timeout: Number(validation.timeout_ms || 30000),
    maxBuffer: 1024 * 1024,
  });
  return {
    command,
    args,
    status: result.status === 0 ? 'pass' : 'fail',
    exit_code: result.status === null ? 1 : result.status,
    stdout: String(result.stdout || '').slice(0, 8000),
    stderr: String(result.stderr || result.error?.message || '').slice(0, 8000),
  };
}

function diffFile(root, sandbox, rel) {
  const before = path.join(root, rel);
  const after = path.join(sandbox, rel);
  const diff = spawnSync('git', ['diff', '--no-index', '--', before, after], {
    encoding: 'utf8',
    shell: false,
    maxBuffer: 1024 * 1024,
  });
  if (diff.status === 0) return '';
  if (diff.status === 1) return diff.stdout || '';
  return `diff unavailable for ${rel}: ${diff.stderr || diff.error?.message || 'unknown error'}\n`;
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Review-Auto Sandbox Proposal',
    '',
    `Status: ${result.status}`,
    `Finding: ${result.finding.id}`,
    `Class: ${result.finding.class}`,
    `Sandbox: ${result.sandbox}`,
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
  lines.push('', '## Artifacts', '');
  lines.push(`- JSON: ${result.artifacts.json}`);
  lines.push(`- Diff: ${result.artifacts.diff}`);
  lines.push('');
  return lines.join('\n');
}

function assertProjectOut(file, projectDir, label) {
  const resolved = path.resolve(file);
  if (!isPathInside(path.resolve(projectDir), resolved)) {
    throw new Error(`${label} must stay inside --project-dir`);
  }
  return resolved;
}

function runReviewAutofixSandbox(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const proposalFile = path.resolve(opts.proposal);
  const proposal = readProposal(proposalFile);
  const finding = proposal.finding || proposal;
  const classification = classifyReviewAuto([finding]);
  const item = classification.items[0];
  if (!item || !item.proposal_allowed || item.bucket !== 'safe') {
    throw new Error(`Proposal finding is not eligible for sandbox planning: ${item ? item.reason : 'missing finding'}`);
  }
  if (!Array.isArray(proposal.operations) || proposal.operations.length === 0) {
    throw new Error('Proposal must include operations[]');
  }

  for (const operation of proposal.operations) {
    const rel = normalizeRelPath(operation.file || operation.path || operation.target_file);
    const source = path.join(root, rel);
    if (fs.existsSync(source)) assertRegularInside(source, root, 'source target');
  }

  const sandbox = copySandbox(root);
  const changed = [...new Set(proposal.operations.map((operation) => applyOperation(sandbox, operation)))].sort();
  const validation = (Array.isArray(proposal.validations) ? proposal.validations : []).map((entry) => runValidation(sandbox, entry));
  const status = validation.some((entry) => entry.status !== 'pass') ? 'validation-failed' : 'proposed';
  const id = proposalId(proposal, item);
  const outDir = assertProjectOut(path.join(projectDir, 'review-auto', 'proposals', `${id}-${timestamp()}`), projectDir, 'proposal output');
  const diff = changed.map((rel) => diffFile(root, sandbox, rel)).join('\n');
  const result = {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    status,
    root,
    project_dir: projectDir,
    proposal_file: proposalFile,
    sandbox,
    finding: {
      id: item.id,
      class: item.class,
      file: item.file,
      files: item.files,
      policy: item.policy,
    },
    changed_files: changed,
    validation,
    artifacts: {
      json: path.join(outDir, 'proposal.json'),
      md: path.join(outDir, 'proposal.md'),
      diff: path.join(outDir, 'proposal.diff'),
    },
    boundary: 'Sandbox proposal runner does not mutate the source checkout, apply real fixes, commit, push, or dispatch workers.',
  };
  writeJsonSafe(result.artifacts.json, result);
  writeFileSafe(result.artifacts.md, renderMarkdown(result));
  writeFileSafe(result.artifacts.diff, diff || '');
  return result;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = runReviewAutofixSandbox(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  if (result.status !== 'proposed') process.exit(1);
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
  parseArgs,
  renderMarkdown,
  runReviewAutofixSandbox,
};
