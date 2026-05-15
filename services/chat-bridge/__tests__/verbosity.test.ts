// __tests__/verbosity.test.ts
// Unit tests for shouldPass() — pure verbosity filtering function.
//
// Hierarchy: phase(0) < decision(1) < conversation(2)
// A message passes if its rank <= threshold rank.
// i.e. lower-verbosity messages always pass a higher-verbosity threshold.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldPass } from '../verbosity.ts';

// ---------------------------------------------------------------------------
// Same-level cases
// ---------------------------------------------------------------------------

test('phase passes phase threshold', () => {
  assert.equal(shouldPass('phase', 'phase'), true);
});

test('decision passes decision threshold', () => {
  assert.equal(shouldPass('decision', 'decision'), true);
});

test('conversation passes conversation threshold', () => {
  assert.equal(shouldPass('conversation', 'conversation'), true);
});

// ---------------------------------------------------------------------------
// Lower verbosity passes higher threshold
// ---------------------------------------------------------------------------

test('phase passes decision threshold', () => {
  assert.equal(shouldPass('phase', 'decision'), true);
});

test('phase passes conversation threshold', () => {
  assert.equal(shouldPass('phase', 'conversation'), true);
});

test('decision passes conversation threshold', () => {
  assert.equal(shouldPass('decision', 'conversation'), true);
});

// ---------------------------------------------------------------------------
// Higher verbosity does NOT pass lower threshold
// ---------------------------------------------------------------------------

test('decision does not pass phase threshold', () => {
  assert.equal(shouldPass('decision', 'phase'), false);
});

test('conversation does not pass phase threshold', () => {
  assert.equal(shouldPass('conversation', 'phase'), false);
});

test('conversation does not pass decision threshold', () => {
  assert.equal(shouldPass('conversation', 'decision'), false);
});
