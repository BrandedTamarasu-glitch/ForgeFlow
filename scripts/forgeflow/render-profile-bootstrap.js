#!/usr/bin/env node
const path = require('path');
const {
  checkUserProfile,
  normalizeEntry,
  profileFiles,
  recordUserProfile,
  showUserProfile,
} = require('./user-profile');
const { tokenize } = require('./command-args');

const FLAG_TO_ENTRY = {
  '--communication': { scope: 'global', category: 'communication', applies_to: ['discuss', 'plan', 'implement', 'review', 'next-step'] },
  '--autonomy': { scope: 'global', category: 'autonomy', applies_to: ['plan', 'implement', 'review', 'next-step'] },
  '--risk': { scope: 'global', category: 'risk', applies_to: ['plan', 'implement', 'review'] },
  '--validation': { scope: 'global', category: 'validation', applies_to: ['implement', 'review', 'ship'] },
  '--release': { scope: 'global', category: 'release', applies_to: ['release', 'ship'] },
  '--workflow': { scope: 'global', category: 'workflow', applies_to: ['plan', 'implement', 'handoff'] },
  '--ui': { scope: 'project', category: 'ui', applies_to: ['plan', 'implement', 'review', 'ui'] },
  '--product-copy': { scope: 'project', category: 'product-copy', applies_to: ['docs', 'ui', 'review'] },
  '--accessibility': { scope: 'project', category: 'accessibility', applies_to: ['plan', 'implement', 'review', 'ui'] },
};
const PROMPTS = [
  { flag: '--communication', prompt: 'How should Forgeflow update you while it works?' },
  { flag: '--autonomy', prompt: 'When should Forgeflow continue autonomously, and when should it stop?' },
  { flag: '--risk', prompt: 'What kinds of risk should trigger an explicit pause?' },
  { flag: '--validation', prompt: 'What validation evidence do you expect before work is considered done?' },
  { flag: '--release', prompt: 'How should Forgeflow handle commit, push, release, and wiki/update steps?' },
  { flag: '--workflow', prompt: 'How do you prefer phases, handoffs, and next-step decisions to be presented?' },
  { flag: '--ui', prompt: 'How should this project look and feel?' },
  { flag: '--product-copy', prompt: 'What tone should project-facing copy use or avoid?' },
  { flag: '--accessibility', prompt: 'What accessibility expectations should agents preserve for this project?' },
];
const REQUIRED_OPERATING_FLAGS = ['--communication', '--autonomy', '--risk', '--validation'];
const RECOMMENDED_PROJECT_FLAGS = ['--ui', '--product-copy', '--accessibility'];
const OPTIONAL_WORKFLOW_FLAGS = ['--release', '--workflow'];

function usage() {
  console.error([
    'Usage: render-profile-bootstrap.js [--root <repo>] [--project-dir <dir>] [--home <dir>] [--prompts] [--write] [--json]',
    '       [--communication <text>] [--autonomy <text>] [--risk <text>] [--validation <text>] [--release <text>] [--workflow <text>]',
    '       [--ui <text>] [--product-copy <text>] [--accessibility <text>]',
  ].join('\n'));
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function requireRawValue(argv, name, index) {
  const value = argv[index + 1];
  if (value === undefined || value === '') throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', home: '', prompts: false, write: false, json: false, preferences: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--home') {
      opts.home = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--write') {
      opts.write = true;
    } else if (arg === '--prompts') {
      opts.prompts = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--args') {
      const raw = requireRawValue(argv, arg, i);
      const parsed = parseArgs(tokenize(raw));
      opts.write = opts.write || parsed.write;
      opts.json = opts.json || parsed.json;
      opts.prompts = opts.prompts || parsed.prompts;
      opts.preferences.push(...parsed.preferences);
      if (parsed.projectDir) opts.projectDir = parsed.projectDir;
      if (parsed.home) opts.home = parsed.home;
      i += 1;
    } else if (FLAG_TO_ENTRY[arg]) {
      opts.preferences.push({ flag: arg, preference: requireValue(argv, arg, i) });
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function buildEntry(item) {
  const defaults = FLAG_TO_ENTRY[item.flag];
  return normalizeEntry({
    schema_version: '1',
    scope: defaults.scope,
    category: defaults.category,
    preference: item.preference,
    evidence: 'Explicit profile bootstrap input.',
    confidence: 'medium',
    evidence_count: 1,
    source: 'explicit-user-instruction',
    applies_to: defaults.applies_to,
    agent_guidance: item.preference,
  });
}

function shellQuote(value) {
  return `'${String(value || '').replace(/'/g, `'\\''`)}'`;
}

function flagForEntry(entry) {
  const match = Object.entries(FLAG_TO_ENTRY).find(([_flag, defaults]) => defaults.scope === entry.scope && defaults.category === entry.category);
  return match ? match[0] : '';
}

function writeCommandForEntries(entries) {
  const parts = ['forgeflow-profile-bootstrap'];
  for (const entry of entries) {
    const flag = flagForEntry(entry);
    if (flag) parts.push(flag, shellQuote(entry.preference));
  }
  parts.push('--write');
  return parts.join(' ');
}

function buildSetupPlan(entries) {
  const coveredFlags = new Set(entries.map((entry) => {
    return flagForEntry(entry);
  }).filter(Boolean));
  const missingRequired = REQUIRED_OPERATING_FLAGS.filter((flag) => !coveredFlags.has(flag));
  const missingRecommended = RECOMMENDED_PROJECT_FLAGS.filter((flag) => !coveredFlags.has(flag));
  const nextFlag = missingRequired[0] || missingRecommended[0] || '';
  const nextPrompt = PROMPTS.find((item) => item.flag === nextFlag) || null;
  const promptGroups = {
    required_operating: REQUIRED_OPERATING_FLAGS.map((flag) => PROMPTS.find((item) => item.flag === flag)).filter(Boolean),
    optional_workflow: OPTIONAL_WORKFLOW_FLAGS.map((flag) => PROMPTS.find((item) => item.flag === flag)).filter(Boolean),
    optional_project_style: RECOMMENDED_PROJECT_FLAGS.map((flag) => PROMPTS.find((item) => item.flag === flag)).filter(Boolean),
    boundary: 'Required operating prompts affect cross-project agent behavior. Optional project-style prompts should stay project-scoped and can be skipped.',
  };
  const guidedSteps = [
    {
      name: 'answer-required-operating-preferences',
      status: missingRequired.length === 0 ? 'pass' : 'attention',
      flags: missingRequired.length > 0 ? missingRequired : REQUIRED_OPERATING_FLAGS,
      command: 'forgeflow-profile-bootstrap --prompts',
      stop_rule: 'Do not write profile records until the user has provided explicit preference text.',
    },
    {
      name: 'preview-project-style-preferences',
      status: missingRecommended.length === 0 ? 'pass' : 'optional',
      flags: missingRecommended.length > 0 ? missingRecommended : RECOMMENDED_PROJECT_FLAGS,
      command: 'forgeflow-profile-bootstrap --ui "<text>" --product-copy "<text>" --accessibility "<text>"',
      stop_rule: 'Project style guidance is optional and must stay project-scoped.',
    },
    {
      name: 'write-after-confirmation',
      status: entries.length > 0 ? 'ready-after-confirmation' : 'blocked-until-explicit-input',
      flags: [...new Set(entries.map(flagForEntry).filter(Boolean))],
      command: entries.length > 0 ? writeCommandForEntries(entries) : 'forgeflow-profile-bootstrap --prompts',
      stop_rule: 'Write only after the user confirms every previewed preference is explicit and correct.',
    },
    {
      name: 'check-before-injection',
      status: 'pending-after-write',
      flags: [],
      command: 'forgeflow-profile --check',
      stop_rule: 'Do not inject profile guidance into agent packets unless the profile quality gate passes.',
    },
  ];
  return {
    status: missingRequired.length === 0 ? 'ready-for-check' : 'needs-required-operating-preferences',
    required_operating_flags: REQUIRED_OPERATING_FLAGS,
    recommended_project_flags: RECOMMENDED_PROJECT_FLAGS,
    optional_workflow_flags: OPTIONAL_WORKFLOW_FLAGS,
    covered_flags: [...coveredFlags].sort(),
    missing_required_flags: missingRequired,
    missing_recommended_flags: missingRecommended,
    completion: {
      required: REQUIRED_OPERATING_FLAGS.length - missingRequired.length,
      required_total: REQUIRED_OPERATING_FLAGS.length,
      recommended: RECOMMENDED_PROJECT_FLAGS.length - missingRecommended.length,
      recommended_total: RECOMMENDED_PROJECT_FLAGS.length,
    },
    next_prompt: nextPrompt ? { flag: nextPrompt.flag, prompt: nextPrompt.prompt } : null,
    guided_path: {
      status: missingRequired.length === 0 ? 'ready-for-profile-check' : 'collect-required-preferences',
      steps: guidedSteps,
      boundary: 'The guided path is advisory. It never infers or writes preferences without explicit command flags and confirmation.',
    },
    prompt_groups: promptGroups,
    boundary: 'Setup readiness only reflects explicit preview or written arguments; it does not infer preferences from behavior or history.',
  };
}

function buildProfileBootstrap(opts = {}) {
  const files = profileFiles(opts);
  const entries = (opts.preferences || []).map(buildEntry);
  if (opts.write && entries.length === 0) {
    throw new Error('Refusing to write an empty profile bootstrap; provide at least one explicit preference flag.');
  }
  const written = [];
  if (opts.write) {
    for (const entry of entries) {
      written.push(recordUserProfile({ ...opts, entry }));
    }
  }
  const check = checkUserProfile({ ...opts, projectDir: files.projectDir, home: files.home });
  const existingRecords = showUserProfile({ ...opts, projectDir: files.projectDir, home: files.home }).records || [];
  const setupPlan = buildSetupPlan([...entries, ...existingRecords]);
  const nextProfileAction = opts.write
    ? {
      status: 'check-profile',
      command: 'forgeflow-profile --check',
      reason: 'Written profile records should pass the profile quality gate before agents rely on them.',
    }
    : (entries.length > 0
      ? {
        status: 'review-preview',
        command: writeCommandForEntries(entries),
        reason: 'Previewed preferences should only be written after the user confirms each record is explicit and correct.',
      }
      : (setupPlan.status === 'ready-for-check' && check.status === 'pass'
        ? {
          status: 'review-profile',
          command: 'forgeflow-profile-review',
          reason: 'Required operating preferences already exist and the profile quality gate passes.',
        }
      : {
        status: 'prompt-needed',
        command: 'forgeflow-profile-bootstrap --prompts',
        reason: 'No explicit preferences were provided, so Forgeflow should ask targeted bootstrap questions before writing anything.',
        }));
  return {
    schema_version: '1',
    status: opts.write ? 'written' : 'preview',
    root: files.root,
    project_dir: files.projectDir,
    files: {
      global: files.global,
      project: files.project,
    },
    entry_count: entries.length,
    entries,
    prompts: opts.prompts || entries.length === 0 ? PROMPTS : [],
    written: written.map((item) => ({ file: item.file, scope: item.entry.scope, category: item.entry.category })),
    check_status: check.status,
    check_issue_count: check.issues.length,
    setup_plan: setupPlan,
    next_profile_action: nextProfileAction,
    next: opts.write
      ? 'Run forgeflow-profile --check before relying on profile guidance in agent context.'
      : (entries.length > 0
        ? 'Review the preview, then rerun with --write only if every preference is explicit and correct.'
        : (setupPlan.status === 'ready-for-check' && check.status === 'pass'
          ? 'Run forgeflow-profile-review to inspect active profile guidance before relying on it.'
          : 'Answer any useful prompts, then rerun with explicit preference flags.')),
    boundary: 'Profile bootstrap uses only explicit command arguments. It does not infer preferences from behavior, current conversation, code, or project history.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Profile Bootstrap',
    '',
    `Status: ${result.status}`,
    `Entries: ${result.entry_count}`,
    `Profile check: ${result.check_status} (${result.check_issue_count} issue(s))`,
    '',
    result.boundary,
    '',
    '## Entries',
    '',
  ];
  if (result.entries.length === 0) lines.push('- None. Provide explicit preference flags to preview records.');
  for (const entry of result.entries) {
    lines.push(`- ${entry.scope}/${entry.category}: ${entry.preference}`);
    lines.push(`  - Applies to: ${entry.applies_to.join(', ')}`);
  }
  if (result.written.length > 0) {
    lines.push('', '## Written', '');
    for (const item of result.written) lines.push(`- ${item.scope}/${item.category}: ${item.file}`);
  }
  if (result.prompts.length > 0) {
    lines.push('', '## Prompts', '');
    for (const item of result.prompts) lines.push(`- ${item.flag}: ${item.prompt}`);
  }
  if (result.next_profile_action) {
    lines.push('', '## Next Profile Action', '');
    lines.push(`- Status: ${result.next_profile_action.status}`);
    lines.push(`- Command: ${result.next_profile_action.command}`);
    lines.push(`- Reason: ${result.next_profile_action.reason}`);
  }
  if (result.setup_plan) {
    lines.push('', '## Setup Readiness', '');
    lines.push(`- Status: ${result.setup_plan.status}`);
    lines.push(`- Required: ${result.setup_plan.completion.required}/${result.setup_plan.completion.required_total}`);
    lines.push(`- Recommended: ${result.setup_plan.completion.recommended}/${result.setup_plan.completion.recommended_total}`);
    if (result.setup_plan.next_prompt) {
      lines.push(`- Next prompt: ${result.setup_plan.next_prompt.flag} - ${result.setup_plan.next_prompt.prompt}`);
    }
    if (result.setup_plan.guided_path) {
      lines.push('', '## Guided Path', '');
      lines.push(`- Status: ${result.setup_plan.guided_path.status}`);
      for (const step of result.setup_plan.guided_path.steps) {
        lines.push(`- ${step.name}: ${step.status} - ${step.command}`);
      }
    }
    if (result.setup_plan.prompt_groups) {
      lines.push('', '## Prompt Groups', '');
      lines.push(`- Required operating: ${result.setup_plan.prompt_groups.required_operating.map((item) => item.flag).join(', ')}`);
      lines.push(`- Optional workflow: ${result.setup_plan.prompt_groups.optional_workflow.map((item) => item.flag).join(', ')}`);
      lines.push(`- Optional project style: ${result.setup_plan.prompt_groups.optional_project_style.map((item) => item.flag).join(', ')}`);
      lines.push(`- Boundary: ${result.setup_plan.prompt_groups.boundary}`);
    }
  }
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildProfileBootstrap(opts);
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

module.exports = { buildProfileBootstrap, buildSetupPlan, parseArgs, renderMarkdown, shellQuote, writeCommandForEntries };
