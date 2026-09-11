#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const identity = require('./agent-identity');
const { manifestEntry } = require('./install-manifest');

// Expected user-facing identities are independent of the implementation catalog.
const roles = [
  { id: 'builder', label: 'Builder', slug: 'builder', old: ['smith', 'fc'] },
  { id: 'guardian', label: 'Guardian', slug: 'guardian', old: ['warden'] },
  { id: 'designer', label: 'Designer', slug: 'designer', old: ['lumen'] },
  { id: 'coordinator', label: 'Coordinator', slug: 'coordinator', old: ['atlas'] },
  { id: 'architect', label: 'Architect', slug: 'architect', old: ['arbiter'] },
  { id: 'product_lead', label: 'Product Lead', slug: 'product-lead', old: ['compass'] },
  { id: 'verifier', label: 'Verifier', slug: 'verifier', old: ['aegis'] },
];

function checkContract(api) {
  assert.equal(api.AGENTS.length, 7, 'exactly seven built-in roles');
  assert.deepEqual(Array.from(api.AGENTS, entry => entry.id).sort(), roles.map(role => role.id).sort());
  for (const role of roles) {
    for (const name of [role.id, role.slug, ...role.old]) {
      assert.equal(api.normalizeAgentId(name), role.id, name);
      assert.equal(api.normalizeAgentId(` ${name.toUpperCase()} `), role.id, `case and whitespace: ${name}`);
      assert.equal(api.normalizeAgentId(api.normalizeAgentId(name)), role.id, `idempotent ${name}`);
      assert.equal(api.getAgent(name).label, role.label, name);
      assert.equal(api.getAgent(name).slug, role.slug, name);
      assert.equal(api.formatAgentLabel(name), role.label, name);
      assert.equal(api.formatAgentLabel(name, 'Check saved evidence'), `${role.label} · Check saved evidence`);
    }
    const legacy = role.old[0];
    for (const mode of ['consult', 'implement', 'review', 'audit', 'plan', 'research', 'discuss', 'present', 'early']) {
      const oldName = `${legacy}-${mode}`;
      const nextName = `${role.slug}-${mode}`;
      assert.equal(api.normalizeAgentId(oldName), role.id, oldName);
      assert.equal(api.normalizeAgentName(oldName), nextName, oldName);
      assert.equal(api.normalizeAgentName(nextName), nextName, `idempotent ${nextName}`);
    }
    for (const mode of ['consultant', 'implementer', 'reviewer', 'auditor', 'planner', 'researcher', 'discusser', 'presenter', 'validator']) {
      const oldName = `${legacy}_${mode}`;
      const nextName = `${role.id}_${mode}`;
      assert.equal(api.normalizeAgentId(oldName), role.id, oldName);
      assert.equal(api.normalizeAgentName(oldName), nextName, oldName);
      assert.equal(api.normalizeAgentName(nextName), nextName, `idempotent ${nextName}`);
    }
  }

  for (const name of ['smithsonian', 'warden-custom', 'fc-tools', 'my-compass', 'builder-extra', 'system', 'orchestrator']) {
    assert.equal(api.normalizeAgentId(name), null, `unknown strict identity: ${name}`);
    assert.equal(api.getAgent(name), null, `unknown catalog entry: ${name}`);
    assert.equal(api.normalizeAgentName(name), name, `preserve custom identity: ${name}`);
    assert.ok(!api.formatAgentLabel(name).includes('Builder'), `do not attribute ${name} to Builder`);
  }
  for (const value of [null, undefined, {}, [], 42]) {
    assert.equal(api.normalizeAgentId(value), null, 'reject malformed identity');
    assert.equal(api.getAgent(value), null, 'reject malformed catalog lookup');
  }

  // An invocation label may use its mode. Stored message labels must not infer it.
  assert.equal(api.formatAgentLabel('smith-review'), 'Builder');
  const planning = api.roleActivityLabel('compass-plan');
  const validation = api.roleActivityLabel('product_lead_validator');
  assert.ok(typeof planning === 'string' && planning.length > 0, 'planning has task context');
  assert.ok(typeof validation === 'string' && validation.length > 0, 'validation has task context');
  assert.notEqual(planning, validation, 'Product Lead planning and validation are distinct');
  assert.equal(api.roleActivityLabel('smith-review'), api.roleActivityLabel('builder-review'));
  for (const [oldName, nextName, id] of [
    ['arbiter-debate-judge', 'architect-debate-judge', 'architect'],
    ['arbiter_debate_judge', 'architect_debate_judge', 'architect'],
    ['compass-debate-validator', 'product-lead-debate-validator', 'product_lead'],
    ['compass_debate_validator', 'product_lead_debate_validator', 'product_lead'],
  ]) {
    assert.equal(api.normalizeAgentId(oldName), id);
    assert.equal(api.normalizeAgentName(oldName), nextName);
  }
  for (const [name, expected] of [
    ['builder-review', 'Backend review'], ['guardian-review', 'Security review'],
    ['designer-review', 'Frontend review'], ['coordinator-review', 'Coverage check'],
    ['architect-review', 'Final verdict'], ['product_lead_validator', 'Acceptance check'],
    ['aegis', 'Finding verification'],
  ]) assert.equal(api.roleActivityLabel(name), expected, `specific task: ${name}`);
}

checkContract(identity);

// Execute the actual browser asset without CommonJS, filesystem, or a network.
const registryPath = path.join(__dirname, 'agent-identity.js');
const browser = {};
vm.runInNewContext(fs.readFileSync(registryPath, 'utf8'), browser, { filename: registryPath });
const browserExports = Object.values(browser).filter(value => value && typeof value.normalizeAgentId === 'function');
assert.equal(browserExports.length, 1, 'one browser catalog API');
checkContract(browserExports[0]);

// A clean installed catalog must work without reaching back into the checkout.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-role-migration-'));
try {
  for (const host of ['claude', 'codex']) {
    const home = path.join(root, host);
    let installed;
    for (const source of ['scripts/forgeflow/agent-identity.js', 'scripts/forgeflow/agent-identity.d.ts']) {
      const entry = manifestEntry(source, home, host);
      assert.ok(entry, `${host} installs ${source}`);
      fs.mkdirSync(path.dirname(entry.destination), { recursive: true });
      fs.copyFileSync(path.resolve(__dirname, '../..', source), entry.destination);
      if (source.endsWith('.js')) installed = entry.destination;
    }
    checkContract(require(installed));
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log('Agent role migration: Node, browser, and isolated Claude/Codex catalogs passed.');
