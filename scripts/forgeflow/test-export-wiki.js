#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { renderPage, exportWiki } = require('../export-wiki');

const root = path.resolve(__dirname, '../..');
const source = path.join(root, 'docs/wiki/Home.md');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-wiki-test-'));
try {
  assert.equal(renderPage('[Setup](Quick-Start.md#clone-the-source)', source), '[Setup](Quick-Start#clone-the-source)');
  assert.equal(renderPage('[Setup](Quick-Start)', source), '[Setup](Quick-Start)');
  assert.equal(renderPage('[Here](#start-here)', source), '[Here](#start-here)');
  assert.equal(renderPage('[PDF](../ForgeFlow-User-Guide.pdf)', source), '[PDF](https://github.com/BrandedTamarasu-glitch/ForgeFlow/blob/main/docs/ForgeFlow-User-Guide.pdf)');
  assert.equal(renderPage('![Workshop](../images/forgeflow-workshop.png)', source), '![Workshop](https://raw.githubusercontent.com/BrandedTamarasu-glitch/ForgeFlow/main/docs/images/forgeflow-workshop.png)');
  assert.equal(renderPage('[Outside](https://example.com/)', source), '[Outside](https://example.com/)');
  assert.throws(() => renderPage('[Missing](Missing-Page.md)', source), /missing or outside-repository/);
  assert.throws(() => renderPage('[Outside](../../../../etc/passwd)', source), /missing or outside-repository/);
  assert.throws(() => exportWiki(path.join(root, 'docs/wiki')), /separate directory/);
  const out = path.join(scratch, 'wiki');
  assert.throws(() => exportWiki(out, true), /does not exist/);
  assert.equal(fs.existsSync(out), false, 'check must not create output');
  const result = exportWiki(out);
  assert.ok(result.pages > 0);
  const home = fs.readFileSync(source, 'utf8');
  for (const name of fs.readdirSync(path.dirname(source)).filter(name => name.endsWith('.md') && name !== 'Home.md' && !name.startsWith('_'))) {
    assert.ok(home.includes(`](${name})`), `Home must make ${name} discoverable`);
  }
  assert.equal(result.changed, result.pages);
  assert.equal(exportWiki(out, true).changed, 0);
  const sentinel = path.join(out, 'unrelated-image.png');
  fs.writeFileSync(sentinel, 'preserve');
  fs.writeFileSync(path.join(out, 'Home.md'), 'drift');
  assert.throws(() => exportWiki(out, true), /Wiki drift: Home.md/);
  assert.equal(fs.readFileSync(path.join(out, 'Home.md'), 'utf8'), 'drift', 'check must not repair');
  assert.equal(exportWiki(out).changed, 1);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'preserve');
  fs.writeFileSync(path.join(out, 'Wiki-Only.md'), 'keep');
  assert.throws(() => exportWiki(out), /Review wiki-only pages/);
  assert.equal(fs.readFileSync(path.join(out, 'Wiki-Only.md'), 'utf8'), 'keep');
  fs.unlinkSync(path.join(out, 'Wiki-Only.md'));
  fs.unlinkSync(path.join(out, 'Home.md'));
  fs.symlinkSync(path.join(scratch, 'absent'), path.join(out, 'Home.md'));
  assert.throws(() => exportWiki(out), /symlinked output/);
  assert.equal(fs.existsSync(path.join(scratch, 'absent')), false);
  const linked = path.join(scratch, 'linked');
  fs.symlinkSync(out, linked);
  assert.throws(() => exportWiki(linked), /symlinked output directory/);
  console.log(`wiki export: ok (${result.pages} pages; links, drift, preservation, and symlink boundaries)`);
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
