#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const command = fs.readFileSync(path.join(root, 'commands', 'research.md'), 'utf8');
const skill = fs.readFileSync(path.join(root, '.agents', 'skills', 'research', 'SKILL.md'), 'utf8');

for (const source of [command, skill]) {
  assert.ok(source.includes('render-research-divergence-advice.js'));
  assert.ok(source.includes('--no-diverge'));
  assert.ok(source.includes('--diverge'));
  assert.ok(source.includes('focused task'));
}
assert.ok(command.includes('Reject both flags together'));
assert.ok(skill.includes('The user may override every automatic result'));

console.log('research routing contract: ok');
