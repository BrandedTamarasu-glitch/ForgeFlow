#!/usr/bin/env node
const path = require('path');
const { checkUserProfile } = require('./user-profile');
const { shellQuote } = require('./privacy-boundary');

function usage() {
  console.error('Usage: render-profile-review.js [--project-dir <dir>] [--home <dir>] [--commands-only] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { json: false, commandsOnly: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--home') {
      opts.home = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--commands-only') {
      opts.commandsOnly = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function actionFromSuggestion(suggestion) {
  const action = suggestion.type === 'move-to-project' || suggestion.type === 'move-to-global'
    ? 'move-then-supersede'
    : 'ask-and-record';
  const item = {
    action,
    scope: suggestion.scope,
    category: suggestion.category,
    reason: suggestion.reason,
    prompt: suggestion.prompt || '',
    command_template: suggestion.command_template || '',
    follow_up: suggestion.follow_up || 'Record only explicit user-approved guidance.',
  };
  if (action === 'move-then-supersede') {
    const originalScope = suggestion.scope === 'project' ? 'global' : 'project';
    const movedTo = `${suggestion.scope}:${suggestion.category}`;
    item.accept_command = suggestion.command_template || '';
    item.supersede_command = [
      'forgeflow-profile --record',
      `--scope ${originalScope}`,
      `--category ${suggestion.category}`,
      `--preference ${shellQuote(suggestion.preference || '')}`,
      '--status superseded',
      `--superseded-by ${shellQuote(movedTo)}`,
    ].join(' ');
    item.follow_up = 'Run the accept command only after user confirmation, then run the supersede command to retire the mis-scoped entry.';
  }
  if (action === 'ask-and-record') {
    item.acceptance_boundary = 'Ask the user first; do not record inferred answers from behavior alone.';
  }
  return item;
}

function buildProfileReview(opts = {}) {
  const check = checkUserProfile(opts);
  const actions = {
    resolve_conflicts: [],
    move_scope: [],
    ask_user: [],
    clean_up: [],
  };
  for (const conflict of check.conflicts || []) {
    actions.resolve_conflicts.push({
      action: 'resolve-conflict',
      scope: conflict.scope,
      category: conflict.category,
      reason: conflict.message,
      preferences: conflict.preferences,
      command_template: conflict.command,
      follow_up: conflict.follow_up,
    });
  }
  for (const suggestion of check.suggestions || []) {
    const action = actionFromSuggestion(suggestion);
    if (action.action === 'move-then-supersede') actions.move_scope.push(action);
    else actions.ask_user.push(action);
  }
  if ((check.issues || []).length > 0) {
    actions.clean_up.push(...check.issues.map((issue) => ({
      action: 'clean-up-profile-record',
      scope: issue.scope || 'profile',
      category: issue.category || issue.code || 'quality',
      reason: issue.message || issue.code || 'Profile record needs attention.',
      follow_up: 'Fix or supersede the record, then rerun forgeflow-profile-review.',
    })));
  }
  const commandActions = Object.values(actions).flat()
    .map((action) => action.command_template)
    .filter(Boolean);
  const confirmationPrompts = [
    ...actions.move_scope.map((action, index) => ({
      id: `move-scope-${index + 1}`,
      action: action.action,
      scope: action.scope,
      category: action.category,
      question: action.prompt || `Should Forgeflow move this ${action.category} preference into ${action.scope} scope?`,
      accept_command: action.accept_command || '',
      supersede_command: action.supersede_command || '',
      reject_guidance: 'Leave the existing profile record unchanged and do not supersede it.',
      boundary: 'Ask the user first; apply the accept and supersede commands only after explicit confirmation.',
    })),
    ...actions.ask_user.map((action, index) => ({
      id: `ask-user-${index + 1}`,
      action: action.action,
      scope: action.scope,
      category: action.category,
      question: action.prompt || `Should Forgeflow record this ${action.category} preference for ${action.scope} scope?`,
      accept_command: action.command_template || '',
      supersede_command: '',
      reject_guidance: 'Do not record the preference unless the user confirms it directly.',
      boundary: action.acceptance_boundary || 'Ask the user first; do not record inferred answers from behavior alone.',
    })),
  ];
  return {
    schema_version: '1',
    status: check.status,
    files: check.files,
    records: check.records,
    issues: check.issues,
    actions,
    action_count: Object.values(actions).reduce((sum, group) => sum + group.length, 0),
    confirmation_prompts: confirmationPrompts,
    apply_commands: [...new Set(commandActions)],
    resolution_flow: [
      'Ask the user to confirm each suggested preference or scope move.',
      'Record accepted guidance with forgeflow-profile --record.',
      'For scope moves or conflicts, add a superseded record so old guidance no longer competes.',
      'Rerun forgeflow-profile-review and check-user-profile before injecting profile guidance into agent context.',
    ],
    boundary: 'Profile review is advisory. Apply actions only after explicit user confirmation; never infer or write preferences automatically.',
  };
}

function renderCommands(review) {
  const lines = [
    '# Forgeflow Profile Review Commands',
    '',
    review.boundary,
    '',
  ];
  if (!review.apply_commands || review.apply_commands.length === 0) {
    lines.push('- No copy-ready profile commands recommended.');
  } else {
    for (const command of review.apply_commands) lines.push(`- ${command}`);
  }
  if ((review.confirmation_prompts || []).length > 0) {
    lines.push('', '## Confirm First', '');
    for (const prompt of review.confirmation_prompts) {
      lines.push(`- ${prompt.id}: ${prompt.question}`);
      if (prompt.accept_command) lines.push(`  - Accept: ${prompt.accept_command}`);
      if (prompt.supersede_command) lines.push(`  - Supersede: ${prompt.supersede_command}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function renderMarkdown(review) {
  const renderActions = (title, actions) => {
    const lines = ['', `## ${title}`, ''];
    if (!actions || actions.length === 0) {
      lines.push('- None.');
      return lines;
    }
    for (const action of actions) {
      lines.push(`- ${action.action}: ${action.scope} ${action.category}`);
      lines.push(`  - Reason: ${action.reason}`);
      if (action.prompt) lines.push(`  - Prompt: ${action.prompt}`);
      if (action.preferences) {
        for (const preference of action.preferences) lines.push(`  - Preference: ${preference}`);
      }
      if (action.command_template) lines.push(`  - Template: ${action.command_template}`);
      if (action.accept_command) lines.push(`  - Accept: ${action.accept_command}`);
      if (action.supersede_command) lines.push(`  - Supersede: ${action.supersede_command}`);
      if (action.acceptance_boundary) lines.push(`  - Boundary: ${action.acceptance_boundary}`);
      if (action.follow_up) lines.push(`  - Follow-up: ${action.follow_up}`);
    }
    return lines;
  };
  const lines = [
    '# Forgeflow Profile Review',
    '',
    `Status: ${review.status}`,
    `Records: global ${review.records.global}, project ${review.records.project}, active ${review.records.active}, usable ${review.records.usable}`,
    '',
    review.boundary,
    '',
    `Actions: ${review.action_count}`,
    '',
  ];
  lines.push(...renderActions('Resolve Conflicts', review.actions.resolve_conflicts));
  lines.push(...renderActions('Move Scope', review.actions.move_scope));
  lines.push(...renderActions('Ask User', review.actions.ask_user));
  lines.push(...renderActions('Clean Up', review.actions.clean_up));
  lines.push('', '## Resolution Flow', '');
  for (const step of review.resolution_flow || []) lines.push(`- ${step}`);
  lines.push('', '## Confirmation Prompts', '');
  if (!review.confirmation_prompts || review.confirmation_prompts.length === 0) {
    lines.push('- None.');
  } else {
    for (const prompt of review.confirmation_prompts) {
      lines.push(`- ${prompt.id}: ${prompt.question}`);
      lines.push(`  - Scope: ${prompt.scope}`);
      lines.push(`  - Category: ${prompt.category}`);
      if (prompt.accept_command) lines.push(`  - Accept: ${prompt.accept_command}`);
      if (prompt.supersede_command) lines.push(`  - Supersede: ${prompt.supersede_command}`);
      lines.push(`  - Reject: ${prompt.reject_guidance}`);
      lines.push(`  - Boundary: ${prompt.boundary}`);
    }
  }
  lines.push('', '## Copy-Ready Commands', '');
  if (!review.apply_commands || review.apply_commands.length === 0) {
    lines.push('- None.');
  } else {
    for (const command of review.apply_commands) lines.push(`- ${command}`);
  }
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const review = buildProfileReview(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(review, null, 2)}\n` : (opts.commandsOnly ? renderCommands(review) : renderMarkdown(review)));
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { buildProfileReview, parseArgs, renderCommands, renderMarkdown };
