#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
execFileSync(process.execPath, ['scripts/build-docs.mjs', '--check'], { cwd: root, stdio: 'pipe' });
const wiki = path.join(root, 'docs/wiki');
const pages = fs.readdirSync(wiki).filter(name => name.endsWith('.html'));
for (const file of ['docs/documentation.html', 'docs/user-guide.html', ...pages.map(name => `docs/wiki/${name}`)]) {
  const source = path.join(root, file);
  const html = fs.readFileSync(source, 'utf8');
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    if (/^(?:https?:|mailto:)/.test(href)) continue;
    const [target, fragment] = href.split('#');
    const destination = target ? path.resolve(path.dirname(source), decodeURIComponent(target)) : source;
    assert.ok(fs.existsSync(destination), `${file}: missing ${href}`);
    if (fragment && destination.endsWith('.html')) {
      assert.ok(fs.readFileSync(destination, 'utf8').includes(`id="${decodeURIComponent(fragment)}"`), `${file}: missing anchor ${href}`);
    }
    if (destination.endsWith('.md') && path.dirname(destination) === wiki) {
      assert.ok(html.includes(`class="source" href="${href}"`), `${file}: topic navigation must use HTML: ${href}`);
    }
  }
}
console.log(`visual documentation: ok (${pages.length} topics; build freshness, local links, anchors, HTML navigation)`);
