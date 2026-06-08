#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { classifyReviewAuto } = require('./classify-review-auto');
const { isPathInside, safeReadTextFile, writeJsonSafe } = require('./file-safety');
const { defaultProjectDir, normalizeRelPath, timestamp } = require('./run-review-autofix-sandbox');

const EXECUTORS = {
  'docs-reference': {
    class: 'docs-drift',
    description: 'Exact replacement for stale documentation or reference text.',
  },
  'command-wrapper-parity': {
    class: 'command-wrapper-argument-parity',
    description: 'Exact replacement for command-wrapper argument parity drift.',
  },
  'manifest-runtime-helper-parity': {
    class: 'manifest-runtime-helper-parity',
    description: 'Exact replacement for managed runtime helper inventory drift.',
  },
  'fixture-expectation-update': {
    class: 'fixture-expectation-drift',
    description: 'Exact replacement for an explicit fixture expectation drift.',
  },
};

function usage() {
  console.error('Usage: build-review-autofix-proposal.js --executor <name> --finding <json> --file <path> --search <text> --replace <text> [--root <dir>] [--project-dir <dir>] [--out <json>] [--validation-command <cmd> --validation-arg <arg>...] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = {
    executor: '',
    finding: '',
    file: '',
    search: '',
    replace: '',
    root: process.cwd(),
    projectDir: '',
    out: '',
    validationCommand: '',
    validationArgs: [],
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--executor') {
      opts.executor = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--finding') {
      opts.finding = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--file') {
      opts.file = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--search') {
      opts.search = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--replace') {
      opts.replace = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--out') {
      opts.out = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--validation-command') {
      opts.validationCommand = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--validation-arg') {
      opts.validationArgs.push(requireValue(argv, arg, i));
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
  if (!opts.executor) throw new Error('Missing --executor');
  if (!opts.finding) throw new Error('Missing --finding');
  if (!opts.file) throw new Error('Missing --file');
  if (!opts.search) throw new Error('Missing --search');
  return opts;
}

function readFinding(file) {
  const parsed = JSON.parse(safeReadTextFile(file, path.dirname(file)).content);
  if (Array.isArray(parsed)) return parsed[0] || {};
  if (Array.isArray(parsed.findings)) return parsed.findings[0] || {};
  return parsed;
}

function proposalId(executor, finding) {
  return String(finding.id || `${executor}-proposal`)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `${executor}-proposal`;
}

function assertOut(file, projectDir) {
  const resolved = path.resolve(file);
  if (!isPathInside(path.resolve(projectDir), resolved)) {
    throw new Error('--out must stay inside --project-dir');
  }
  return resolved;
}

function buildReviewAutofixProposal(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const executor = String(opts.executor || '');
  const executorSpec = EXECUTORS[executor];
  if (!executorSpec) throw new Error(`Unsupported executor: ${executor}`);
  const rel = normalizeRelPath(opts.file);
  const search = String(opts.search || '');
  if (!search) throw new Error('Missing search text');
  const finding = {
    ...readFinding(path.resolve(opts.finding)),
    class: executorSpec.class,
    file: rel,
    files: [rel],
  };
  const classification = classifyReviewAuto([finding]);
  const item = classification.items[0];
  if (!item || !item.proposal_allowed) {
    throw new Error(`Finding is not eligible for deterministic proposal: ${item ? item.reason : 'missing finding'}`);
  }
  const validations = opts.validationCommand
    ? [{ command: String(opts.validationCommand), args: (opts.validationArgs || []).map(String) }]
    : [];
  const proposal = {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    id: proposalId(executor, finding),
    executor,
    executor_description: executorSpec.description,
    finding,
    operations: [
      {
        op: 'replace',
        file: rel,
        search,
        replace: String(opts.replace ?? ''),
      },
    ],
    validations,
    boundary: 'Deterministic proposal only. It does not edit files, run validation, apply changes, commit, push, or call GitHub.',
  };
  const out = assertOut(
    opts.out || path.join(projectDir, 'review-auto', 'proposal-inputs', `${proposal.id}-${timestamp()}.json`),
    projectDir,
  );
  if (opts.write !== false) writeJsonSafe(out, proposal);
  return { ...proposal, out };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildReviewAutofixProposal(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : `Proposal written to ${result.out}\n`);
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
  EXECUTORS,
  buildReviewAutofixProposal,
  parseArgs,
};
