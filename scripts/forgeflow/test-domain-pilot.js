#!/usr/bin/env node
const assert = require('node:assert/strict');
const { selectCapabilities } = require('./select-capabilities');
const cases = require('../../fixtures/domain-pilot/routing-cases.json');
const domains = new Set(['money-calendar-correctness', 'cad-fabrication-acceptance']);
for (const example of cases) {
  const result = selectCapabilities(example.input);
  assert.deepEqual(result.selected.filter(id => domains.has(id)).sort(), [...example.domains].sort(), example.name);
  if (example.inspect) assert.ok(result.inspection_requests.some(item => item.id === example.inspect), example.name);
  for (const decision of result.decisions.filter(item => domains.has(item.id))) {
    assert.equal(decision.availability, 'evaluation', example.name);
    assert.equal(decision.executable, false, 'routing must not qualify domain or physical outcomes');
  }
}
console.log(`domain pilot: ${cases.length} relevant, irrelevant, mixed and ambiguous routing cases passed`);
