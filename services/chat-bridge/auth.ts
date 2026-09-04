import crypto from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export function isAuthorized(req: IncomingMessage, token: string): boolean {
  const supplied = req.headers['x-forgeflow-token'];
  if (typeof supplied !== 'string') return false;

  const expected = Buffer.from(token);
  const actual = Buffer.from(supplied);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
