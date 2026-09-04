#!/usr/bin/env node
const fs = require('fs'), os = require('os'), path = require('path');
const { parseArgs, record } = require('./record-command-interface-observation');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-command-observation-'));
const projectDir = path.join(root, '.forgeflow', 'demo');
const first = record({ projectDir, workItemId: 'work-one', commandId: 'forgeflow-health', outcome: 'success', calls: 1, bytes: 12 });
const second = record({ projectDir, workItemId: 'work-one', commandId: 'forgeflow-smoke', outcome: 'success', calls: 1, bytes: 20 });
let unsafe = false; try { parseArgs(['--project-dir', projectDir, '--work-item-id', 'work-one', '--command-id', 'git status', '--outcome', 'success']); } catch (_e) { unsafe = true; }
const dataset = JSON.parse(fs.readFileSync(second.dataset, 'utf8'));
if (!(first.observation.command_id === 'forgeflow-health' && dataset.observations.length === 1 && dataset.observations[0].command_chain.length === 2 && unsafe && !JSON.stringify(dataset).includes('git status'))) process.exit(1);
console.log('command interface observation: ok');
