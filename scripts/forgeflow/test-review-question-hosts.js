#!/usr/bin/env node
'use strict';
// Instruction/command safety checks only. Real-PR acceptance is recorded separately.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { skillText, SKILLS } = require('./render-forgeflow-skills');
const root = path.resolve(__dirname, '../..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const hosts = ['commands/review.md', '.agents/skills/forgeflow-review/SKILL.md', 'skills/forgeflow-review/SKILL.md'];
let checks = 0;
for (const name of hosts) {
  const text = read(name);
  const begin = text.indexOf('## Focused questions and bounded follow-up');
  assert.ok(begin >= 0, `${name}: focused workflow missing`);
  const focused = text.slice(begin, text.indexOf('## Current synthesis', begin) < 0 ? undefined : text.indexOf('## Current synthesis', begin));
  for (const op of ['start', 'inspect', 'request', 'response', 'challenge', 'synthesis']) {
    assert.ok(text.includes(`review-questions-cli.js" ${op} --root "$PROJECT_ROOT"`), `${name}: missing ${op}`);
  }
  assert.ok(text.includes('--review-assignments'), `${name}: assignments must precede compilation`);
  assert.ok(text.includes('required_reviewers'), `${name}: start must bind unchanged roster`);
  assert.ok(text.includes('evidence_ref:<exact returned ref>'), `${name}: start must bind returned E2 identity`);
  assert.ok(text.includes('JSON.stringify(r.session_ref)'), `${name}: must persist exact returned session identity`);
  for (const boundary of ['legacy unenforced', 'focused_questions: "not_enabled"', 'before peer exposure', 'no full-history fork', '2 requests/reviewer', '4 requests/review', '64 KiB serialized response/request', '128 KiB/review', '2 independent challenges/review', 'prompt-only separation', 'unresolved', 'accessibility', 'audit']) {
    assert.ok(text.includes(boundary), `${name}: missing boundary ${boundary}`);
  }
  assert.ok(!focused.includes('context/latest'), `${name}: focused flow must not choose mutable latest`);
  // Parse each documented shell block without executing its trusted input placeholders.
  for (const match of focused.matchAll(/```bash\n([\s\S]*?)\n```/g)) {
    if (!match[1].includes('review-questions-cli.js')) continue;
    const parsed = spawnSync('bash', ['-n'], { input: match[1], encoding: 'utf8', timeout: 5000 });
    assert.equal(parsed.status, 0, `${name}: invalid shell block: ${parsed.stderr}`);
  }
  checks++;
}
const short = SKILLS.find(skill => skill.name === 'forgeflow-review');
assert.equal(read('skills/forgeflow-review/SKILL.md'), skillText(short), 'generated short skill differs from renderer');
checks++;
const command = read('commands/review.md');
const build = command.slice(command.indexOf('CONTEXT_BUILD_JSON='), command.indexOf('CONTEXT_PACK_DIR=$(printf'));
assert.ok(build.includes('--review-assignments "$REVIEW_ASSIGNMENTS_INPUT"'), 'command compile omits concrete questions');
assert.ok(command.includes('shared `request` operation'), 'preloading must not bypass session requests');
checks++;
const map = JSON.parse(read('.codex/agent-canonical-map.json'));
for (const role of ['builder', 'guardian', 'designer', 'coordinator', 'architect', 'product-lead']) {
  const canonical = `agents/${role}-review.md`;
  const generated = `.codex/agents/${role}-reviewer.toml`;
  const source = read(canonical);
  assert.ok(source.includes('## Focused review assignment'), `${canonical}: missing assignment protocol`);
  assert.ok(source.includes('why_decisive'), `${canonical}: missing bounded request schema`);
  assert.ok(source.includes('ordinary domain duties'), `${canonical}: assignment removed discovery coverage`);
  assert.ok(read(generated).includes('## Focused review assignment'), `${generated}: missing generated protocol`);
  assert.equal(map.agents[generated].sha256, crypto.createHash('sha256').update(source).digest('hex'), `${generated}: stale canonical hash`);
  if (['architect', 'product-lead'].includes(role)) {
    assert.ok(source.includes('not part of the independent assignment roster'), `${canonical}: synthesis identity cannot consume a specialist slot`);
  }
  checks++;
}
const auditCanonical = read('agents/guardian-audit.md');
assert.ok(auditCanonical.includes('## Focused review assignment'));
assert.ok(auditCanonical.includes('Tier 1') && auditCanonical.includes('Tier 2'));
assert.ok(read('.codex/agents/guardian-auditor.toml').includes('## Focused review assignment'));
assert.equal(map.agents['.codex/agents/guardian-auditor.toml'].sha256, crypto.createHash('sha256').update(auditCanonical).digest('hex'));
checks++;
console.log(`focused review host safety: ok (${checks} instruction/generation checks; no real-PR qualification claim)`);
