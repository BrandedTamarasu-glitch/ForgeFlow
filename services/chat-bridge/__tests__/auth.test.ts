import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { IncomingMessage } from 'node:http';

import { isAuthorized } from '../auth.ts';

const token = 'a'.repeat(64);

function requestWithToken(value: string | undefined): IncomingMessage {
  return {
    headers: value === undefined ? {} : { 'x-forgeflow-token': value },
  } as IncomingMessage;
}

test('accepts a matching Forgeflow control token', () => {
  assert.equal(isAuthorized(requestWithToken(token), token), true);
});

test('rejects missing, mismatched, and multi-value Forgeflow control tokens', () => {
  assert.equal(isAuthorized(requestWithToken(undefined), token), false);
  assert.equal(isAuthorized(requestWithToken('b'.repeat(64)), token), false);
  assert.equal(isAuthorized({ headers: { 'x-forgeflow-token': [token] } } as unknown as IncomingMessage, token), false);
});
