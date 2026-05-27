#!/usr/bin/env node
const path = require('path');
const { checkUserProfile } = require('./user-profile');

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
  return {
    action,
    scope: suggestion.scope,
    category: suggestion.category,
    reason: suggestion.reason,
    prompt: suggestion.prompt || '',
    command_template: suggestion.command_template || '',
    follow_up: suggestion.follow_up || 'Record only explicit user-approved guidance.',
  };
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
  return {
    schema_version: '1',
    status: check.status,
    files: check.files,
    records: check.records,
    issues: check.issues,
    actions,
    action_count: Object.values(actions).reduce((sum, group) => sum + group.length, 0),
    apply_commands: [...new Set(commandActions)],
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
