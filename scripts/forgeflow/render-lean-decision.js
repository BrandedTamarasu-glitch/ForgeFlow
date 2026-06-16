#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { safeReadTextFile } = require('./file-safety');

const HARD_BOUNDARIES = [
  'security controls',
  'accessibility basics',
  'trust-boundary input validation',
  'data-loss prevention',
  'explicit user requirements',
  'calibration and physical-world tuning controls',
];

function usage() {
  console.error('Usage: render-lean-decision.js [--root <repo>] [--project-dir <dir>] [--task <text>] [--brief <path>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', task: '', brief: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--task') {
      opts.task = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--brief') {
      opts.brief = path.resolve(requireValue(argv, arg, i));
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

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function readJson(file, root) {
  if (!file || !fs.existsSync(file)) return null;
  return JSON.parse(safeReadTextFile(file, root).content);
}

function readText(file, root) {
  if (!file || !fs.existsSync(file)) return '';
  return safeReadTextFile(file, root).content;
}

function briefText(opts, root) {
  if (opts.task) return opts.task;
  if (opts.brief) return readText(opts.brief, root).slice(0, 12000);
  return '';
}

function packageInfo(root) {
  const pkg = readJson(path.join(root, 'package.json'), root) || {};
  return {
    dependencies: Object.keys(pkg.dependencies || {}),
    dev_dependencies: Object.keys(pkg.devDependencies || {}),
    scripts: Object.keys(pkg.scripts || {}),
  };
}

function includesAny(text, words) {
  const lower = String(text || '').toLowerCase();
  return words.some((word) => lower.includes(word));
}

function reuseCandidates(text, pkg, artifacts) {
  const candidates = [];
  const add = (kind, candidate, reason) => candidates.push({ kind, candidate, reason });
  if (includesAny(text, ['date picker', 'date input', 'calendar'])) add('native', '<input type="date">', 'Browser date input may cover simple date selection without a dependency.');
  if (includesAny(text, ['sort', 'ordering'])) add('stdlib', 'Array.prototype.sort / language sort helper', 'Use runtime-provided sorting before custom sorting code.');
  if (includesAny(text, ['email validation', 'email address'])) add('native', 'confirmation email flow', 'Delivery is the real validation; keep syntax checks intentionally shallow unless stricter validation is required.');
  if (includesAny(text, ['cache', 'memoize'])) add('stdlib', 'language cache/memoization helper', 'Prefer stdlib memoization or existing infrastructure before a custom cache class.');
  if (includesAny(text, ['rate limit', 'throttle'])) add('installed-dependency', 'existing web framework or gateway middleware', 'Prefer platform/framework rate limiting before custom request accounting.');
  if (includesAny(text, ['schema', 'validate', 'validation'])) add('project-pattern', 'existing schema or validation helper', 'Reuse project validation helpers before adding a new validator abstraction.');
  if (pkg.dependencies.length) add('installed-dependency', pkg.dependencies.slice(0, 8).join(', '), 'Check installed dependencies before adding a new package.');
  const hints = artifacts.invocation && Array.isArray(artifacts.invocation.hints) ? artifacts.invocation.hints : [];
  for (const hint of hints.slice(0, 3)) {
    const label = hint.command || hint.suggested_invocation || hint.file || hint.path;
    if (label) add('project-pattern', label, 'Existing invocation hint may show how this project already solves adjacent work.');
  }
  return candidates.slice(0, 8);
}

function forbiddenSimplifications(text) {
  const items = [...HARD_BOUNDARIES];
  if (includesAny(text, ['auth', 'token', 'password', 'permission', 'secret'])) items.push('authentication and authorization behavior');
  if (includesAny(text, ['money', 'payment', 'invoice', 'ledger'])) items.push('money correctness and concurrency');
  if (includesAny(text, ['migration', 'schema', 'database'])) items.push('database integrity and migration safety');
  if (includesAny(text, ['a11y', 'accessibility', 'keyboard', 'screen reader'])) items.push('accessibility acceptance criteria');
  if (includesAny(text, ['sensor', 'clock', 'timer', 'servo', 'pwm', 'adc', 'thermistor', 'temperature', 'hardware', 'robot', 'motor', 'calibration', 'drift', 'tolerance', 'offset'])) items.push('hardware calibration, drift handling, tolerance, and tuning knobs');
  return [...new Set(items)];
}

function validationMinimum(text, artifacts) {
  const commands = [];
  const notes = [];
  if (includesAny(text, ['command', 'wrapper'])) commands.push('node scripts/forgeflow/test-command-wrapper-smoke.js');
  if (includesAny(text, ['docs', 'readme', 'wiki', 'command'])) commands.push('node scripts/forgeflow/test-doc-links.js');
  if (includesAny(text, ['helper', 'script', 'forgeflow'])) commands.push('node scripts/forgeflow/test-runtime-helper-contract.js');
  if (includesAny(text, ['dashboard', 'ui', 'frontend'])) notes.push('Run the smallest UI/server check that proves the visible behavior still works.');
  if (includesAny(text, ['security', 'auth', 'permission', 'token'])) notes.push('Include a negative security or trust-boundary check.');
  const model = artifacts.model || {};
  const norms = []
    .concat(model.validation_norms || [])
    .concat(model.validation_patterns || [])
    .map((item) => (typeof item === 'string' ? item : item.name || item.command || item.summary || ''))
    .filter(Boolean)
    .slice(0, 3);
  return {
    commands: [...new Set(commands)],
    notes: notes.length ? notes : ['Leave one focused runnable check for non-trivial logic.'],
    project_norms: norms,
  };
}

function decisionFor(text, candidates, forbidden) {
  if (!text.trim()) return { status: 'attention', decision: 'needs-task', reason: 'No task or brief text was supplied.' };
  if (includesAny(text, ['optional', 'nice to have', 'future', 'eventually'])) {
    return { status: 'ready', decision: 'skip-or-defer', reason: 'Task language is speculative; defer unless the user confirms current need.' };
  }
  if (candidates.some((item) => ['native', 'stdlib', 'installed-dependency', 'project-pattern'].includes(item.kind))) {
    return { status: 'ready', decision: 'simplify-first', reason: 'At least one reuse or platform candidate should be checked before custom code.' };
  }
  if (forbidden.length > HARD_BOUNDARIES.length) {
    return { status: 'ready', decision: 'minimum-with-safety', reason: 'Use the smallest implementation that preserves the detected high-care boundary.' };
  }
  return { status: 'ready', decision: 'minimum-custom', reason: 'No obvious reuse candidate was detected; write the smallest project-consistent implementation.' };
}

function ceilingFor(decision, text) {
  if (decision === 'skip-or-defer') return { known_ceiling: 'Deferred need may become real after user confirmation or measured usage.', upgrade_trigger: 'User confirms the requirement is current or evidence shows repeated demand.' };
  if (includesAny(text, ['cache', 'memoize'])) return { known_ceiling: 'Simple memoization may not cover TTL, invalidation, cross-process state, or distributed workloads.', upgrade_trigger: 'Add infrastructure when metrics show stale data, capacity pressure, or cross-process coordination needs.' };
  if (includesAny(text, ['rate limit'])) return { known_ceiling: 'Single-process rate limiting may not protect distributed deployments.', upgrade_trigger: 'Move to gateway/shared-store limiting when traffic spans processes or hosts.' };
  if (includesAny(text, ['email validation'])) return { known_ceiling: 'Syntax checks cannot prove mailbox ownership or deliverability.', upgrade_trigger: 'Use confirmation flow or provider verification when ownership matters.' };
  if (includesAny(text, ['sensor', 'clock', 'timer', 'servo', 'pwm', 'adc', 'thermistor', 'temperature', 'hardware', 'robot', 'motor', 'calibration', 'drift', 'tolerance', 'offset'])) return { known_ceiling: 'A minimal hardware path may not match real devices without calibration, drift handling, tolerance, or tuning controls.', upgrade_trigger: 'Add or preserve calibration knobs when real measurements, device variance, timing drift, or field tuning require them.' };
  return { known_ceiling: 'The lean path may need expansion if a second caller, second implementation, or measured operational need appears.', upgrade_trigger: 'Add abstraction only after duplication, performance evidence, or product requirements justify it.' };
}

function buildLeanDecision(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const text = opts.text ?? briefText(opts, root);
  const artifacts = {
    model: opts.model || readJson(path.join(projectDir, 'context', 'project-operating-model.json'), projectDir),
    architecture: opts.architecture || readJson(path.join(projectDir, 'context', 'architecture.json'), projectDir),
    ownership: opts.ownership || readJson(path.join(projectDir, 'context', 'ownership-map.json'), projectDir),
    invocation: opts.invocation || readJson(path.join(projectDir, 'context', 'invocation-hints.json'), projectDir),
  };
  const warnings = [];
  for (const [name, value] of Object.entries(artifacts)) if (!value) warnings.push(`${name}-missing`);
  const pkg = opts.packageInfo || packageInfo(root);
  const reuse = reuseCandidates(text, pkg, artifacts);
  const forbidden = forbiddenSimplifications(text);
  const decision = decisionFor(text, reuse, forbidden);
  const ceiling = ceilingFor(decision.decision, text);
  const validation = validationMinimum(text, artifacts);
  const noteCandidate = decision.status === 'ready' && text.trim()
    ? {
      agent: 'Atlas',
      category: 'tradeoff',
      note: `Lean path selected: ${decision.decision}. Known ceiling: ${ceiling.known_ceiling}`,
      why: `Upgrade trigger: ${ceiling.upgrade_trigger}`,
    }
    : null;
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    status: decision.status,
    root,
    project_dir: projectDir,
    task_present: Boolean(text.trim()),
    decision: decision.decision,
    reason: decision.reason,
    warnings,
    reuse_candidates: reuse,
    do_first: reuse.length ? [`Check ${reuse[0].candidate} before custom code.`] : ['Use the smallest project-consistent implementation.'],
    avoid_first: [
      'new abstractions with one caller',
      'new dependencies before stdlib/native/existing dependency checks',
      'boilerplate for future needs',
    ],
    do_not_simplify: forbidden,
    validation_minimum: validation,
    known_ceiling: ceiling.known_ceiling,
    upgrade_trigger: ceiling.upgrade_trigger,
    implementation_note_candidate: noteCandidate,
    next_command: decision.status === 'attention' ? '/forgeflow-lean-decision --task "<work item>"' : '/consult',
    boundary: 'Lean decision is read-only and advisory. It does not edit files, remove explicit requirements, install dependencies, spawn agents, change review routing, commit, push, or call the network.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Lean Decision',
    '',
    `Status: ${result.status}`,
    `Decision: ${result.decision}`,
    `Reason: ${result.reason}`,
    '',
    result.boundary,
    '',
    '## Do First',
    '',
  ];
  for (const item of result.do_first) lines.push(`- ${item}`);
  lines.push('', '## Reuse Candidates', '');
  for (const item of result.reuse_candidates.length ? result.reuse_candidates : [{ kind: 'none', candidate: 'No obvious reuse candidate detected.', reason: 'Use the smallest project-consistent implementation.' }]) {
    lines.push(`- ${item.kind}: ${item.candidate} — ${item.reason}`);
  }
  lines.push('', '## Avoid First', '');
  for (const item of result.avoid_first) lines.push(`- ${item}`);
  lines.push('', '## Do Not Simplify', '');
  for (const item of result.do_not_simplify) lines.push(`- ${item}`);
  lines.push('', '## Validation Minimum', '');
  for (const cmd of result.validation_minimum.commands.length ? result.validation_minimum.commands : ['No specific command inferred.']) lines.push(`- ${cmd}`);
  for (const note of result.validation_minimum.notes) lines.push(`- ${note}`);
  for (const norm of result.validation_minimum.project_norms) lines.push(`- Project norm: ${norm}`);
  lines.push('', '## Ceiling', '', `- Known ceiling: ${result.known_ceiling}`, `- Upgrade trigger: ${result.upgrade_trigger}`);
  if (result.warnings.length) {
    lines.push('', '## Warnings', '');
    for (const warning of result.warnings) lines.push(`- ${warning}`);
  }
  lines.push('', `Next: ${result.next_command}`, '');
  return lines.join('\n');
}

function renderBriefSection(result) {
  const validationCommands = result.validation_minimum.commands.length
    ? result.validation_minimum.commands
    : ['Add one focused runnable check for non-trivial logic.'];
  const lines = [
    '## Lean Decision',
    '',
    `- Decision: ${result.decision}`,
    `- Reason: ${result.reason}`,
    '',
    '### Do First',
    '',
    ...result.do_first.map((item) => `- ${item}`),
    '',
    '### Avoid First',
    '',
    ...result.avoid_first.map((item) => `- ${item}`),
    '',
    '### Validate With',
    '',
    ...validationCommands.map((item) => `- ${item}`),
    ...result.validation_minimum.notes.map((item) => `- ${item}`),
  ];
  for (const norm of result.validation_minimum.project_norms) lines.push(`- Project norm: ${norm}`);
  lines.push(
    '',
    '### Do Not Simplify',
    '',
    ...result.do_not_simplify.map((item) => `- ${item}`),
    '',
    '### Upgrade When',
    '',
    `- Known ceiling: ${result.known_ceiling}`,
    `- Upgrade trigger: ${result.upgrade_trigger}`,
    '',
    'Lean guidance is advisory only. It cannot remove explicit requirements, security, accessibility, validation, or data-loss safeguards.',
    '',
  );
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildLeanDecision(opts);
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
  buildLeanDecision,
  forbiddenSimplifications,
  parseArgs,
  renderBriefSection,
  renderMarkdown,
  reuseCandidates,
  validationMinimum,
};
