import crypto from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export function isAuthorized(req: IncomingMessage, token: string): boolean {
  const supplied = req.headers['x-forgeflow-token'];
  if (typeof supplied !== 'string') return false;

  const expected = Buffer.from(token);
  const actual = Buffer.from(supplied);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

// Browser callers must target this exact local origin; CLI clients omit Origin.
export function isLocalRequest(req: IncomingMessage): boolean {
  const host = req.headers.host;
  const port = req.socket.localPort;
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return false;
  if (req.headers.origin !== undefined && req.headers.origin !== `http://${host}`) return false;
  const site = req.headers['sec-fetch-site'];
  return site === undefined || site === 'none' || site === 'same-origin';
}
