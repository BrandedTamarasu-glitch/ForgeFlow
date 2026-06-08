#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { isPathInside, safeReadTextFile } = require('./file-safety');
const { defaultProjectDir } = require('./run-review-autofix-sandbox');

function usage() {
  console.error('Usage: show-review-autofix-status.js [--root <dir>] [--project-dir <dir>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = {
    root: process.cwd(),
    projectDir: '',
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
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
  return opts;
}

function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function parseTime(value, fallbackMs = 0) {
  const ms = Date.parse(String(value || ''));
  if (Number.isFinite(ms)) return ms;
  return fallbackMs;
}

function relPath(file, projectDir) {
  return path.relative(projectDir, file).replace(/\\/g, '/');
}

function safeProjectDir(projectDir) {
  const resolved = path.resolve(projectDir);
  if (!fs.existsSync(resolved)) return resolved;
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error(`Refusing symlinked project directory: ${projectDir}`);
  if (!stat.isDirectory()) throw new Error(`Project directory is not a directory: ${projectDir}`);
  return resolved;
}

function collectJsonFiles(dir, projectDir, invalid) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  const root = path.resolve(projectDir);
  const resolvedDir = path.resolve(dir);
  if (!isPathInside(root, resolvedDir)) {
    invalid.push({ file: resolvedDir, reason: 'outside-project-dir' });
    return files;
  }
  const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
  for (const entry of entries) {
    const file = path.join(resolvedDir, entry.name);
    if (!isPathInside(root, file)) {
      invalid.push({ file, reason: 'outside-project-dir' });
      continue;
    }
    if (entry.isSymbolicLink()) {
      invalid.push({ file, reason: 'symlink-skipped' });
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...collectJsonFiles(file, root, invalid));
      continue;
    }
    if (!entry.isFile()) {
      invalid.push({ file, reason: 'non-regular-skipped' });
      continue;
    }
    if (entry.name.endsWith('.json')) files.push(file);
  }
  return files;
}

function readJsonArtifact(file, projectDir, kind, invalid) {
  try {
    const read = safeReadTextFile(file, projectDir);
    const parsed = JSON.parse(read.content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('artifact must be a JSON object');
    }
    return {
      kind,
      file,
      rel: relPath(file, projectDir),
      status: String(parsed.status || 'unknown'),
      generated_at: String(parsed.generated_at || parsed.ts || ''),
      time_ms: parseTime(parsed.generated_at || parsed.ts, read.stat.mtimeMs),
      id: String(parsed.id || parsed.finding?.id || path.basename(file, '.json')),
      parsed,
    };
  } catch (err) {
    invalid.push({ file, reason: err.message });
    return null;
  }
}

function readHistory(file, projectDir, invalid) {
  if (!fs.existsSync(file)) return [];
  try {
    const read = safeReadTextFile(file, projectDir);
    return read.content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line, index) => {
        try {
          const parsed = JSON.parse(line);
          return {
            index,
            file,
            rel: relPath(file, projectDir),
            status: String(parsed.status || 'unknown'),
            generated_at: String(parsed.ts || parsed.generated_at || ''),
            time_ms: parseTime(parsed.ts || parsed.generated_at, read.stat.mtimeMs + index),
            proposal_file: String(parsed.proposal_file || ''),
            changed_files: Array.isArray(parsed.changed_files) ? parsed.changed_files.map(String) : [],
          };
        } catch (err) {
          invalid.push({ file, reason: `invalid history line ${index + 1}: ${err.message}` });
          return null;
        }
      })
      .filter(Boolean);
  } catch (err) {
    invalid.push({ file, reason: err.message });
    return [];
  }
}

function latest(items) {
  return [...items].sort((a, b) => b.time_ms - a.time_ms || a.rel.localeCompare(b.rel))[0] || null;
}

function summarizeArtifact(item) {
  if (!item) return null;
  return {
    kind: item.kind,
    status: item.status,
    path: item.file,
    rel: item.rel,
    id: item.id,
    generated_at: item.generated_at,
  };
}

function countStatuses(items) {
  const counts = {};
  for (const item of items) counts[item.status] = (counts[item.status] || 0) + 1;
  return counts;
}

function nextAction({ proposalInputs, sandboxProposals, applyArtifacts, history }) {
  const input = latest(proposalInputs);
  const proposal = latest(sandboxProposals);
  const apply = latest(applyArtifacts);
  const historyItem = latest(history);

  if (apply && (!proposal || apply.time_ms >= proposal.time_ms)) {
    if (apply.status === 'applied') {
      return {
        status: 'ready',
        next: '/review',
        next_reason: 'Latest apply evidence is successful. Run review before considering the fix complete.',
      };
    }
    return {
      status: 'attention',
      next: `Inspect ${apply.rel}`,
      next_reason: 'Latest apply evidence did not finish cleanly. Review the recorded validation output before retrying.',
    };
  }

  if (proposal) {
    if (proposal.status === 'proposed') {
      return {
        status: 'ready',
        next: `/forgeflow-review-autofix-apply --proposal ${proposal.file}`,
        next_reason: 'A validated sandbox proposal is available and has not been superseded by apply evidence.',
      };
    }
    return {
      status: 'attention',
      next: `Inspect ${proposal.rel}`,
      next_reason: 'Latest sandbox proposal is not applyable. Fix the proposal input or validation issue, then rerun the sandbox.',
    };
  }

  if (input) {
    return {
      status: 'ready',
      next: `/forgeflow-review-autofix-sandbox --proposal ${input.file}`,
      next_reason: 'A deterministic proposal input exists but no sandbox proposal artifact has been produced yet.',
    };
  }

  if (historyItem) {
    return {
      status: 'attention',
      next: `Inspect ${historyItem.rel}`,
      next_reason: 'Apply history exists but matching apply artifacts were not found.',
    };
  }

  return {
    status: 'empty',
    next: '/forgeflow-review-auto-evidence --findings <json>',
    next_reason: 'No review-auto proposal artifacts are present for this project.',
  };
}

function showReviewAutofixStatus(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = safeProjectDir(opts.projectDir || defaultProjectDir(root));
  const reviewDir = path.join(projectDir, 'review-auto');
  const invalid = [];
  const proposalInputs = collectJsonFiles(path.join(reviewDir, 'proposal-inputs'), projectDir, invalid)
    .map((file) => readJsonArtifact(file, projectDir, 'proposal-input', invalid))
    .filter(Boolean);
  const sandboxProposals = collectJsonFiles(path.join(reviewDir, 'proposals'), projectDir, invalid)
    .filter((file) => path.basename(file) === 'proposal.json')
    .map((file) => readJsonArtifact(file, projectDir, 'sandbox-proposal', invalid))
    .filter(Boolean);
  const applyArtifacts = collectJsonFiles(path.join(reviewDir, 'applied'), projectDir, invalid)
    .filter((file) => path.basename(file) === 'apply.json')
    .map((file) => readJsonArtifact(file, projectDir, 'apply', invalid))
    .filter(Boolean);
  const history = readHistory(path.join(reviewDir, 'apply-history.jsonl'), projectDir, invalid);
  const action = nextAction({ proposalInputs, sandboxProposals, applyArtifacts, history });
  const status = invalid.length > 0 && action.status !== 'attention' ? 'attention' : action.status;
  return {
    schema_version: '1',
    generated_at: isoNow(),
    status,
    root,
    project_dir: projectDir,
    review_auto_dir: reviewDir,
    counts: {
      proposal_inputs: proposalInputs.length,
      sandbox_proposals: sandboxProposals.length,
      apply_artifacts: applyArtifacts.length,
      apply_history_entries: history.length,
      invalid_artifacts: invalid.length,
      sandbox_statuses: countStatuses(sandboxProposals),
      apply_statuses: countStatuses(applyArtifacts),
    },
    latest: {
      proposal_input: summarizeArtifact(latest(proposalInputs)),
      sandbox_proposal: summarizeArtifact(latest(sandboxProposals)),
      apply: summarizeArtifact(latest(applyArtifacts)),
      apply_history: history.length > 0 ? {
        status: latest(history).status,
        path: latest(history).file,
        rel: latest(history).rel,
        generated_at: latest(history).generated_at,
        proposal_file: latest(history).proposal_file,
        changed_files: latest(history).changed_files,
      } : null,
    },
    invalid_artifacts: invalid.map((item) => ({
      path: item.file,
      rel: isPathInside(projectDir, item.file) ? relPath(item.file, projectDir) : item.file,
      reason: item.reason,
    })),
    next: action.next,
    next_reason: action.next_reason,
    boundary: 'Review-auto status is read-only. It does not edit files, generate proposals, apply proposals, run validation, commit, push, call GitHub, dispatch workers, or claim review approval.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Review-Auto Status',
    '',
    `Status: ${result.status}`,
    `Project: ${result.project_dir}`,
    '',
    result.boundary,
    '',
    '## Counts',
    '',
    `- Proposal inputs: ${result.counts.proposal_inputs}`,
    `- Sandbox proposals: ${result.counts.sandbox_proposals}`,
    `- Apply artifacts: ${result.counts.apply_artifacts}`,
    `- Apply history entries: ${result.counts.apply_history_entries}`,
    `- Invalid artifacts: ${result.counts.invalid_artifacts}`,
    '',
    '## Latest',
    '',
  ];
  for (const [label, item] of Object.entries(result.latest)) {
    if (!item) {
      lines.push(`- ${label}: none`);
    } else {
      lines.push(`- ${label}: ${item.status} ${item.rel || item.proposal_file || ''}`.trim());
    }
  }
  if (result.invalid_artifacts.length > 0) {
    lines.push('', '## Invalid Artifacts', '');
    for (const item of result.invalid_artifacts.slice(0, 10)) lines.push(`- ${item.rel}: ${item.reason}`);
  }
  lines.push('', '## Next', '', result.next, '', result.next_reason, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = showReviewAutofixStatus(opts);
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
  collectJsonFiles,
  nextAction,
  parseArgs,
  renderMarkdown,
  showReviewAutofixStatus,
};
