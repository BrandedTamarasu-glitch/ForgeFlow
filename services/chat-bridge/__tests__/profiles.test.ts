import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { AGENT_PROFILES, registerProfiles } from '../profiles.ts';

test('profile registration settles when every upstream request hangs', { timeout: 9000 }, async t => {
  let requests = 0;
  const server = http.createServer(req => { requests++; req.resume(); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const start = Date.now();
  await registerProfiles(`http://127.0.0.1:${address.port}`);
  assert.equal(requests, AGENT_PROFILES.length);
  assert.ok(Date.now() - start < 8000, 'concurrent registrations have a bounded wait');
});
