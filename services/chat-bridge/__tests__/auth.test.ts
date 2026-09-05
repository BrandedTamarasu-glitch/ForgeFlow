import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { IncomingMessage } from 'node:http';

import { isAuthorized, isLocalRequest } from '../auth.ts';

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


test('bridge accepts exact loopback Host/Origin and rejects browser cross-origin requests', () => {
  function local(headers: Record<string, string>) {
    return { headers, socket: { localPort: 4002 } } as IncomingMessage;
  }
  assert.equal(isLocalRequest(local({ host: '127.0.0.1:4002' })), true);
  assert.equal(isLocalRequest(local({ host: 'localhost:4002', origin: 'http://localhost:4002' })), true);
  for (const headers of [
    { host: 'attacker.invalid:4002' },
    { host: '127.0.0.1:4003' },
    { host: '127.0.0.1:4002', origin: 'https://attacker.invalid' },
    { host: '127.0.0.1:4002', origin: 'null' },
    { host: '127.0.0.1:4002', 'sec-fetch-site': 'cross-site' },
  ]) assert.equal(isLocalRequest(local(headers)), false);
});
