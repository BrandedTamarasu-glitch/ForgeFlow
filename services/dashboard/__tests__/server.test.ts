// Run with: npx tsx --test services/dashboard/__tests__/server.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';

const require = createRequire(import.meta.url);
const { createServer } = require('../server.js') as { createServer: (opts: {
  port: number;
  metricsRoot: string;
  projectRoot?: string;
  projectDir?: string;
  onError?: (err: NodeJS.ErrnoException) => void;
}) => http.Server };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = path.resolve(__dirname, '../../../fixtures/metrics-root');

function startServer(metricsRoot: string, opts: { projectRoot?: string; projectDir?: string } = {}): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const srv = createServer({
      port: 0,
      metricsRoot,
      ...opts,
      onError: reject
    });
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address() as { port: number };
      const baseUrl = `http://127.0.0.1:${addr.port}`;
      const close = () => new Promise<void>((res, rej) => srv.close(err => err ? rej(err) : res()));
      resolve({ baseUrl, close });
    });
  });
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function makeReadinessFixture(): { projectRoot: string; projectDir: string } {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-dashboard-readiness-'));
  const projectDir = path.join(projectRoot, '.forgeflow', path.basename(projectRoot));
  const contextDir = path.join(projectDir, 'context');
  const latestDir = path.join(contextDir, 'latest');
  writeJson(path.join(contextDir, 'project-operating-model.json'), { schema_version: '1', status: 'ready' });
  writeJson(path.join(latestDir, 'latest-insights-report.json'), { status: 'injected', freshness: { status: 'current' } });
  writeJson(path.join(latestDir, 'context-telemetry.json'), { budget_status: 'pass', compact_tokens: 800, estimated_saved_tokens: 1200 });
  writeJson(path.join(projectDir, 'release-readiness', 'last.json'), { status: 'ready', blockers: [] });
  writeJson(path.join(contextDir, 'architecture.json'), { schema_version: '1' });
  writeJson(path.join(contextDir, 'ownership-map.json'), { schema_version: '1' });
  writeJson(path.join(contextDir, 'invocation-hints.json'), { schema_version: '1' });
  writeJson(path.join(latestDir, 'synthesis-input.json'), { context_blocks: [{ name: 'architecture-intelligence' }] });
  writeJson(path.join(latestDir, 'packet-artifacts.json'), { packet_count: 4 });
  writeJson(path.join(latestDir, 'code-topology.json'), { nodes: [] });
  writeJson(path.join(contextDir, 'dogfood-report.json'), {
    status: 'ready',
    promotion_decision: 'consider-promote',
    promotion_reason: 'Fixture evidence is complete.'
  });
  return { projectRoot, projectDir };
}

// Node's built-in fetch (undici) rewrites the Host header, ignoring caller overrides.
// Use http.request so we can spoof Host: 127.0.0.1:4003 to satisfy the DNS-rebinding guard.
interface SimpleResponse {
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}

function get(baseUrl: string, urlPath: string, method = 'GET'): Promise<SimpleResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(baseUrl);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: Number(parsed.port),
        path: urlPath,
        method,
        headers: { host: '127.0.0.1:4003' }
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({
            status: res.statusCode ?? 0,
            headers: {
              get: (name: string) => res.headers[name.toLowerCase()] as string | null ?? null
            },
            json: () => Promise.resolve(JSON.parse(body)),
            text: () => Promise.resolve(body)
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

test('GET / returns 200', async () => {
  const { baseUrl, close } = await startServer(FIXTURES_ROOT);
  try {
    const res = await get(baseUrl, '/');
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('text/html'));
  } finally {
    await close();
  }
});

test('GET /api/metrics returns 200 with schema_version', async () => {
  const { baseUrl, close } = await startServer(FIXTURES_ROOT);
  try {
    const res = await get(baseUrl, '/api/metrics');
    assert.equal(res.status, 200);
    const body = await res.json() as { schema_version: string };
    assert.equal(body.schema_version, '1');
  } finally {
    await close();
  }
});

test('REVISE verdict counted from implicit-v1 record', async () => {
  const { baseUrl, close } = await startServer(FIXTURES_ROOT);
  try {
    const res = await get(baseUrl, '/api/metrics');
    const body = await res.json() as { projects: Array<{ verdicts: { arbiter: Record<string, number> } }> };
    assert.equal(body.projects[0].verdicts.arbiter['REVISE'], 1);
  } finally {
    await close();
  }
});

test('unknown schema_version skipped with parse_warnings=1', async () => {
  const { baseUrl, close } = await startServer(FIXTURES_ROOT);
  try {
    const res = await get(baseUrl, '/api/metrics');
    const body = await res.json() as {
      parse_warnings: number;
      projects: Array<{ verdicts: { arbiter: Record<string, number> } }>
    };
    assert.equal(body.parse_warnings, 1);
    assert.equal(body.projects[0].verdicts.arbiter['BLOCK'], 0);
  } finally {
    await close();
  }
});

test('implicit v1 record contributes to totals', async () => {
  const { baseUrl, close } = await startServer(FIXTURES_ROOT);
  try {
    const res = await get(baseUrl, '/api/metrics');
    const body = await res.json() as {
      projects: Array<{ event_totals: Record<string, number> }>
    };
    // Records 1, 2, 6, 8, 9 are verdicts (record 7 skipped). Total = 5.
    // (record 6 has no schema_version → treated as v1 → counted)
    assert.equal(body.projects[0].event_totals['verdict'], 5);
  } finally {
    await close();
  }
});

test('worktree dirs dedup into one project entry', async () => {
  const { baseUrl, close } = await startServer(FIXTURES_ROOT);
  try {
    const res = await get(baseUrl, '/api/metrics');
    const body = await res.json() as { projects: unknown[] };
    assert.equal(body.projects.length, 1);
  } finally {
    await close();
  }
});

test('POST /api/metrics returns 405 with Allow header', async () => {
  const { baseUrl, close } = await startServer(FIXTURES_ROOT);
  try {
    const res = await get(baseUrl, '/api/metrics', 'POST');
    assert.equal(res.status, 405);
    assert.equal(res.headers.get('allow'), 'GET');
  } finally {
    await close();
  }
});

test('GET /api/team returns 200 with synced:false', async () => {
  const { baseUrl, close } = await startServer(FIXTURES_ROOT);
  try {
    const res = await get(baseUrl, '/api/team');
    assert.equal(res.status, 200);
    const body = await res.json() as { synced: boolean };
    assert.equal(body.synced, false);
  } finally {
    await close();
  }
});

test('GET /api/readiness returns local project readiness cards', async () => {
  const fixture = makeReadinessFixture();
  const { baseUrl, close } = await startServer(FIXTURES_ROOT, fixture);
  try {
    const res = await get(baseUrl, '/api/readiness');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const body = await res.json() as {
      schema_version: string;
      status: string;
      project: string;
      cards: Array<{ id: string; status: string; next: string }>;
      boundary: string;
    };
    assert.equal(body.schema_version, '1');
    assert.equal(body.status, 'ready');
    assert.equal(body.project, path.basename(fixture.projectRoot));
    assert.ok(body.cards.some((card) => card.id === 'release-readiness' && card.status === 'ready'));
    assert.ok(body.cards.some((card) => card.id === 'dogfood-refresh-plan' && card.next === '/forgeflow-dogfood-report --write'));
    assert.ok(body.boundary.includes('does not refresh'));
    assert.equal(JSON.stringify(body).includes(fixture.projectRoot), false);
  } finally {
    await close();
  }
});

test('EADDRINUSE surfaces via onError callback', async () => {
  // Bind a blocker on an OS-assigned port, then try to start a second server
  // on the same port. Plan 4B-3 success criterion: the server signals the
  // conflict to the caller rather than silently crashing.
  const { baseUrl, close } = await startServer(FIXTURES_ROOT);
  const port = Number(new URL(baseUrl).port);
  const errs: NodeJS.ErrnoException[] = [];
  const conflictSrv = createServer({
    port,
    metricsRoot: FIXTURES_ROOT,
    onError: (err) => { errs.push(err); }
  });
  await new Promise<void>((resolve) => {
    conflictSrv.on('error', () => resolve());
    conflictSrv.listen(port, '127.0.0.1');
  });
  try {
    assert.equal(errs.length, 1);
    assert.equal(errs[0].code, 'EADDRINUSE');
  } finally {
    await close();
  }
});
