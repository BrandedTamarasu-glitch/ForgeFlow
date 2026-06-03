#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildProfileBootstrap, parseArgs, renderMarkdown } = require('./render-profile-bootstrap');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-profile-bootstrap-'));
const root = path.join(tmp, 'repo');
const home = path.join(tmp, 'home');
const projectDir = path.join(root, '.forgeflow', 'Demo');
fs.mkdirSync(projectDir, { recursive: true });

const preview = buildProfileBootstrap({
  root,
  home,
  projectDir,
  preferences: [
    { flag: '--communication', preference: 'Use concise progress updates with concrete blockers.' },
    { flag: '--ui', preference: 'Use dense operational screens with restrained visual treatment.' },
  ],
});
const prompts = buildProfileBootstrap({ root, home, projectDir, prompts: true, preferences: [] });
const markdown = renderMarkdown(preview);
const previewDidNotWrite = !fs.existsSync(path.join(home, 'forgeflow', 'user-operating-profile.jsonl'));
const written = buildProfileBootstrap({
  root,
  home,
  projectDir,
  write: true,
  preferences: [
    { flag: '--autonomy', preference: 'Continue safe slices unless validation fails or product judgment is needed.' },
  ],
});
let emptyWriteBlocked = false;
try {
  buildProfileBootstrap({ root, home, projectDir, write: true, preferences: [] });
} catch (err) {
  emptyWriteBlocked = /empty profile bootstrap/.test(err.message);
}
const opts = parseArgs(['--root', root, '--home', home, '--project-dir', projectDir, '--args', '--communication "Keep updates short." --prompts --write --json']);

const globalFile = path.join(home, 'forgeflow', 'user-operating-profile.jsonl');
const checks = [
  ['previews entries', preview.status === 'preview' && preview.entry_count === 2],
  ['reports setup readiness', preview.setup_plan.status === 'needs-required-operating-preferences' && preview.setup_plan.covered_flags.includes('--communication') && preview.setup_plan.covered_flags.includes('--ui')],
  ['adds guided setup path', preview.setup_plan.guided_path.status === 'collect-required-preferences' && preview.setup_plan.guided_path.steps.some((step) => step.name === 'write-after-confirmation' && step.command.includes("--communication 'Use concise progress updates") && step.stop_rule.includes('explicit and correct'))],
  ['groups required and optional prompts', preview.setup_plan.prompt_groups.required_operating.map((item) => item.flag).includes('--communication') && preview.setup_plan.prompt_groups.optional_project_style.map((item) => item.flag).includes('--ui') && preview.setup_plan.prompt_groups.boundary.includes('Required operating prompts')],
  ['reports next missing prompt', preview.setup_plan.next_prompt.flag === '--autonomy'],
  ['returns preview next action', preview.next_profile_action.status === 'review-preview' && preview.next_profile_action.command.includes('--write') && !preview.next_profile_action.command.includes('<same explicit flags>')],
  ['returns prompt next action', prompts.next_profile_action.status === 'prompt-needed' && prompts.next_profile_action.command.includes('--prompts')],
  ['renders prompt templates', prompts.prompts.length >= 5 && renderMarkdown(prompts).includes('--communication')],
  ['preview does not write', previewDidNotWrite],
  ['writes explicit entries only with flag', written.status === 'written' && fs.existsSync(globalFile)],
  ['returns written next action', written.next_profile_action.status === 'check-profile' && written.next_profile_action.command === 'forgeflow-profile --check'],
  ['blocks empty write', emptyWriteBlocked],
  ['renders boundary and next action', markdown.includes('does not infer preferences') && markdown.includes('Next Profile Action') && markdown.includes('Setup Readiness') && markdown.includes('Guided Path') && markdown.includes('Prompt Groups') && !markdown.includes('<same explicit flags>')],
  ['parses quoted raw args', opts.write === true && opts.prompts === true && opts.json === true && opts.preferences.length === 1 && opts.preferences[0].preference === 'Keep updates short.'],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('profile bootstrap: ok');
