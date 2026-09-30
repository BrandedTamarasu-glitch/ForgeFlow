import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const clean=await readFile(new URL('src/store.mjs',import.meta.url),'utf8');
const defective=await readFile(new URL('src/store-defective.mjs',import.meta.url),'utf8');
const controls=[
 {id:'clean',source:clean,expected:[]},
 {id:'defective',source:defective,expected:['future-no-overwrite','corrupt-no-overwrite','stale-migration-fence','failed-reload-invalidates']},
 {id:'direct-key-assignment',source:clean.replace('Object.defineProperty(entries, key, { value, enumerable: true, writable: true, configurable: true });','entries[key] = value;'),expected:['dangerous-key-roundtrip']},
 {id:'accept-container',source:clean.replace('![Object.prototype, null].includes(Object.getPrototypeOf(source))','Array.isArray(source)'),expected:['invalid-dictionary-containers']},
 {id:'refresh-revision',source:clean.replace('revision = await backend.write(next, revision);','revision = await backend.write(next, (await backend.read()).revision);'),expected:['stale-migration-fence']},
 {id:'accept-future',source:clean.replace('![1, 2].includes(v.version)','!Number.isInteger(v.version)'),expected:['future-no-overwrite']},
 {id:'retain-loaded-on-reload-failure',source:clean.replace('      ready = false;\n',''),expected:['failed-reload-invalidates']}
];
const results=[];
for(const c of controls) {
 const root=await mkdtemp(join(tmpdir(),'migration-fence-'));
 try {
  await mkdir(join(root,'src')); await writeFile(join(root,'src/store.mjs'),c.source);
  const r=spawnSync(process.execPath,[new URL('acceptance.mjs',import.meta.url).pathname,root],{encoding:'utf8',timeout:1500});
  assert.ifError(r.error); const output=JSON.parse(r.stdout);
  const failed=output.checks.filter(x=>!x.pass).map(x=>x.id);
  if(!c.expected.length) { assert.equal(r.status,0); assert.deepEqual(failed,[]); }
  else { assert.equal(r.status,1); for(const id of c.expected) assert.ok(failed.includes(id),`${c.id}: missing ${id}`); }
  results.push({id:c.id,pass:true,failed});
 } finally { await rm(root,{recursive:true,force:true}); }
}
console.log(JSON.stringify({pass:true,controls:results}));
