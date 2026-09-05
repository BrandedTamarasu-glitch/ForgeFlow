'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');
const { readToken } = require('../agent-chat/session-auth');
const { scanMetricsRoots } = require('./metrics');
const { scanReadiness } = require('./readiness');

const INDEX_HTML = path.join(__dirname, 'public', 'index.html');

function defaultMetricsRoots(home = os.homedir()) {
  return [
    path.resolve(home, '.claude', 'projects'),
    path.resolve(home, '.codex', 'projects')
  ];
}

function metricsRootsFromOptions(opts = {}) {
  if (Array.isArray(opts.metricsRoots)) return opts.metricsRoots;
  if (opts.metricsRoot) return [opts.metricsRoot];
  return defaultMetricsRoots();
}

function createServer(opts = {}) {
  const browserToken = crypto.randomBytes(32).toString('hex');
  const chatSockets = new Set();
  function isLocalRequest(req) {
    const host = req.headers.host;
    const port = req.socket.localPort;
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return false;
    if (req.headers.origin !== undefined && req.headers.origin !== `http://${host}`) return false;
    const site = req.headers['sec-fetch-site'];
    return site === undefined || site === 'none' || site === 'same-origin';
  }
  function browserAuthorized(req) {
    return (req.headers.cookie ?? '').split(';').some(part => {
      const cookie = part.trim();
      if (!cookie.startsWith('forgeflow_dashboard_chat=')) return false;
      const actual = Buffer.from(cookie.slice('forgeflow_dashboard_chat='.length));
      const expected = Buffer.from(browserToken);
      return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    });
  }
  const { onError } = opts;
  const metricsRoots = metricsRootsFromOptions(opts);
  const projectRoot = opts.projectRoot || process.cwd();
  const projectDir = opts.projectDir;

  const server = http.createServer(async (req, res) => {
    if (!isLocalRequest(req)) {
      res.writeHead(400); res.end('Bad Request'); return;
    }

    if (req.method !== 'GET') {
      res.writeHead(405, { Allow: 'GET' });
      res.end('Method Not Allowed');
      return;
    }

    if (req.url === '/api/metrics' || req.url.startsWith('/api/metrics?')) {
      try {
        const result = await scanMetricsRoots(metricsRoots);
        const body = JSON.stringify({
          schema_version: '1',
          generated_at: new Date().toISOString(),
          window: 'all',
          parse_warnings: result.parse_warnings,
          projects: result.projects,
          verdicts: result.verdicts
        });
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'no-store'
        });
        res.end(body);
      } catch (err) {
        console.error('metrics error:', err);
        res.writeHead(500);
        res.end('Internal Server Error');
      }
      return;
    }

    if (req.url === '/api/team') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store'
      });
      res.end(JSON.stringify({ synced: false }));
      return;
    }

    if (req.url === '/api/readiness') {
      try {
        const body = JSON.stringify(await scanReadiness({ projectRoot, projectDir }));
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'no-store'
        });
        res.end(body);
      } catch (err) {
        console.error('readiness error:', err);
        res.writeHead(500);
        res.end('Internal Server Error');
      }
      return;
    }

    if (req.url === '/' || req.url === '/index.html') {
      const mode = req.headers['sec-fetch-mode'];
      if (mode !== undefined && mode !== 'navigate' && req.headers['sec-fetch-site'] !== 'same-origin') {
        res.writeHead(403).end('Forbidden'); return;
      }
      try {
        const html = await fs.promises.readFile(INDEX_HTML, 'utf8');
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
          'Set-Cookie': `forgeflow_dashboard_chat=${browserToken}; HttpOnly; SameSite=Strict; Path=/`,
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff'
        });
        res.end(html);
      } catch (err) {
        console.error('html serve error:', err);
        res.writeHead(500);
        res.end('Internal Server Error');
      }
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  // Read-only same-origin browser relay; the upstream credential stays in this process.
  const chat = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  server.on('upgrade', (req, socket, head) => {
    const reject = status => {
      socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    };
    if (req.url !== '/api/chat' || !isLocalRequest(req) ||
        req.headers.origin !== `http://${req.headers.host}` || !browserAuthorized(req)) {
      reject('403 Forbidden');
      return;
    }
    let credential;
    try { credential = readToken(opts.chatTokenFile); }
    catch { reject('503 Service Unavailable'); return; }
    const upstream = new WebSocket(`ws://127.0.0.1:${opts.chatPort ?? 4001}/`, {
      headers: { 'x-forgeflow-token': credential }, maxPayload: 8 * 1024 * 1024,
    });
    chatSockets.add(upstream);
    let browser = null;
    const timer = setTimeout(() => upstream.terminate(), 5_000);
    socket.on('error', () => upstream.terminate());
    socket.on('close', () => upstream.terminate());
    upstream.on('open', () => {
      clearTimeout(timer);
      if (socket.destroyed) { upstream.terminate(); return; }
      chat.handleUpgrade(req, socket, head, ws => {
        browser = ws;
        browser.on('close', () => upstream.terminate());
        browser.on('error', () => upstream.terminate());
        // Browser frames are deliberately never forwarded to the upstream server.
      });
    });
    upstream.on('message', (data, isBinary) => {
      if (browser?.readyState === WebSocket.OPEN) browser.send(data, { binary: isBinary });
    });
    upstream.on('error', () => {
      if (!browser) reject('503 Service Unavailable');
    });
    upstream.on('close', () => {
      clearTimeout(timer);
      chatSockets.delete(upstream);
      if (browser) browser.close(1011, 'Chat service disconnected');
      else if (!socket.writableEnded) socket.destroy();
    });
  });
  server.on('close', () => {
    for (const ws of chat.clients) ws.terminate();
    for (const ws of chatSockets) ws.terminate();
  });

  server.on('error', (err) => {
    if (onError) {
      onError(err);
    } else {
      process.exit(1);
    }
  });

  return server;
}

module.exports = { createServer };

if (require.main === module) {
  const mainOpts = {
    port: 4003,
    metricsRoots: defaultMetricsRoots(),
    projectRoot: process.cwd(),
    onError: (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error('Port 4003 in use. Check: lsof -i :4003');
      } else {
        console.error('Server error:', err.message);
      }
      process.exit(1);
    }
  };
  const srv = createServer(mainOpts);
  srv.listen(mainOpts.port ?? 4003, '127.0.0.1', () => {
    console.log('Dashboard running at http://127.0.0.1:4003/');
  });

  const shutdown = () => {
    srv.close();
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports.defaultMetricsRoots = defaultMetricsRoots;
