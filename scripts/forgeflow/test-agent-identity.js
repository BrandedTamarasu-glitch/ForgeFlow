#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const identity = require('./agent-identity');

for (const agent of identity.AGENTS) {
  for (const alias of [agent.id, agent.slug, agent.label, ...agent.aliases]) {
    assert.equal(identity.normalizeAgentId(alias), agent.id);
    assert.equal(identity.getAgent(alias), agent);
    for (const suffix of ['review', 'reviewer', 'consult', 'consultant', 'implement', 'implementer', 'audit', 'auditor', 'debate-judge']) {
      assert.equal(identity.normalizeAgentId(`${alias}-${suffix}`), agent.id);
    }
    assert.equal(identity.formatAgentLabel(alias), agent.label);
    assert.equal(identity.formatAgentLabel(alias, ' Original work '), `${agent.label} · Original work`);
  }
}
assert.equal(identity.normalizeAgentName('compass-review'), 'product-lead-review');
assert.equal(identity.normalizeAgentName('compass_reviewer'), 'product_lead_reviewer');
assert.equal(identity.normalizeAgentName('product_lead_reviewer'), 'product_lead_reviewer');
assert.equal(identity.normalizeAgentName('product-lead-review'), 'product-lead-review');
assert.equal(identity.roleActivityLabel('smith-review'), 'Backend review');
assert.equal(identity.roleActivityLabel('arbiter_implementer'), 'Integration check');
assert.equal(identity.roleActivityLabel('compass_validator'), 'Acceptance check');
assert.equal(identity.roleActivityLabel('aegis'), 'Finding verification');
assert.equal(identity.formatAgentLabel('smith-review'), 'Builder', 'History labels never infer context');
for (const value of ['custom-person', 'smith-unrecognized', 'toString', '__proto__', '', null, {}, 4]) {
  assert.equal(identity.normalizeAgentId(value), null);
  assert.equal(identity.getAgent(value), null);
  assert.equal(identity.normalizeAgentName(value), value);
}
assert.equal(identity.formatAgentLabel('custom-person'), 'custom-person');
const browser = {};
vm.runInNewContext(fs.readFileSync(require.resolve('./agent-identity'), 'utf8'), browser);
assert.deepEqual(JSON.parse(JSON.stringify(browser.ForgeflowAgentIdentity.AGENTS)), identity.AGENTS);
assert.equal(browser.ForgeflowAgentIdentity.normalizeAgentId('FC'), 'builder');
console.log('agent identity: ok');
