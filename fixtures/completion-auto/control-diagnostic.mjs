// Post-observation diagnostic only. The frozen primary oracle remains unchanged.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

assert.ok(process.argv.length === 3 || (process.argv.length === 4 && process.argv[3] === '--include-path-alias'),
  'Usage: node control-diagnostic.mjs /path/to/disposable/source [--include-path-alias]');
const source = resolve(process.argv[2]);
const original = await readFile(new URL('../completion-pilot/acceptance.mjs', import.meta.url), 'utf8');
const marker = " {id:'native-id-matches-bound-header'";
const value = "value:c.value??(c.kind==='path'?sessionPath:id)";
assert.equal(original.split(marker).length, 2, 'Oracle case insertion point changed');
assert.equal(original.split(value).length, 2, 'Oracle identity setup changed');
let diagnostic = original
  .replace(marker, " {id:'mistagged-path-id-rejected',kind:'id',mistagged:true,pass:false},\n" + marker)
  .replace(value, "value:c.mistagged?sessionPath:(c.value??(c.kind==='path'?sessionPath:id))");
if (process.argv[3] === '--include-path-alias') {
  const setup = '  const before=await fixture.manifest();';
  assert.equal(diagnostic.split(setup).length, 2, 'Oracle fixture setup changed');
  diagnostic = diagnostic
    .replace('readFile, rm, writeFile', 'readFile, rm, symlink, writeFile')
    .replace(marker, " {id:'canonical-native-path-alias',kind:'path',alias:true,pass:true},\n" + marker)
    .replace(setup, "  if(c.alias) await symlink(sessionPath,join(fixture.directory,'alias.jsonl'));\n" + setup)
    .replace('value:c.mistagged?', "value:c.alias?join(fixture.directory,'alias.jsonl'):c.mistagged?");
}
const directory = await mkdtemp(join(tmpdir(), 'ff-control-diagnostic-'));
try {
  const file = join(directory, 'diagnostic.mjs');
  await writeFile(file, diagnostic);
  const result = spawnSync(process.execPath, [file, source], { encoding: 'utf8', timeout: 30000 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) console.error(result.error.message);
  process.exitCode = result.error ? 1 : (result.status ?? 1);
} finally {
  await rm(directory, { recursive: true, force: true });
}
