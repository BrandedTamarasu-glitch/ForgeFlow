'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
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

function createServer(opts) {
  const { onError } = opts;
  const metricsRoots = metricsRootsFromOptions(opts);
  const projectRoot = opts.projectRoot || process.cwd();
  const projectDir = opts.projectDir;

  const server = http.createServer(async (req, res) => {
    const host = req.headers.host;
    if (host !== '127.0.0.1:4003' && host !== 'localhost:4003') {
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
      try {
        const html = await fs.promises.readFile(INDEX_HTML, 'utf8');
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
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
