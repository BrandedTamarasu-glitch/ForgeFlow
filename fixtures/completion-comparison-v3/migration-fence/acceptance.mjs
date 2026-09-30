import { backend } from './backend.mjs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = process.argv[2] || new URL('.', import.meta.url).pathname;
const { createStore } = await import(pathToFileURL(resolve(root, 'src/store.mjs')));
const checks = [];
async function check(id, f) { try { await f(); checks.push({id, pass:true}); } catch(e) { checks.push({id,pass:false,error:e.message}); } }
async function loaded(value) { const b=backend(value), s=createStore(b); await s.reload(); return {b,s}; }
await check('current-no-edit-reload', async()=> { const {b,s}=await loaded({version:2,entries:{a:'A'}}); assert.deepEqual(s.snapshot(),{a:'A'}); assert.equal(b.inspect().revision,0); });
await check('legacy-migrate-reload', async()=> { const {b,s}=await loaded({version:1,items:{a:'A'}}); await s.flush(); const other=createStore(b); await other.reload(); assert.deepEqual(other.snapshot(),{a:'A'}); assert.deepEqual(b.inspect().value,{version:2,entries:{a:'A'}}); });
await check('future-no-overwrite', async()=> { const b=backend({version:3,entries:{a:'A'}}), s=createStore(b); await assert.rejects(()=>s.reload()); await assert.rejects(()=>s.flush()); assert.equal(b.inspect().revision,0); });
await check('corrupt-no-overwrite', async()=> { const b=backend({version:2,entries:{a:7}}), s=createStore(b); await assert.rejects(()=>s.reload()); await assert.rejects(()=>s.flush()); assert.deepEqual(b.inspect().value,{version:2,entries:{a:7}}); });
await check('stale-migration-fence', async()=> { const {b,s}=await loaded({version:1,items:{a:'A'}}); const t=createStore(b); await t.reload(); t.set('b','B'); await t.flush(); await assert.rejects(()=>s.flush()); const r=createStore(b); await r.reload(); assert.deepEqual(r.snapshot(),{a:'A',b:'B'}); });
await check('barrier-stale-fence', async()=> { const {b,s}=await loaded({version:2,entries:{a:'A'}}); const t=createStore(b); await t.reload(); const g=b.pauseNextWrite(); const pending=s.flush(); await g.entered; t.set('b','B'); await t.flush(); g.release(); await assert.rejects(()=>pending); assert.equal(b.inspect().value.entries.b,'B'); });
await check('write-fault-retry', async()=> { const {b,s}=await loaded({version:2,entries:{}}); s.set('a','A'); b.failNextWrite(); await assert.rejects(()=>s.flush()); assert.equal(b.inspect().revision,0); await s.flush(); const r=createStore(b); await r.reload(); assert.deepEqual(r.snapshot(),{a:'A'}); });
await check('snapshot-isolation', async()=> { const {s}=await loaded({version:2,entries:{a:'A'}}); const copy=s.snapshot(); copy.a='B'; assert.equal(s.snapshot().a,'A'); });
await check('repeated-flush-reload', async()=> { const {b,s}=await loaded({version:2,entries:{}}); s.set('a','A'); await s.flush(); s.set('b','B'); await s.flush(); const r=createStore(b); await r.reload(); assert.deepEqual(r.snapshot(),{a:'A',b:'B'}); });
await check('failed-reload-invalidates', async()=> { const {b,s}=await loaded({version:2,entries:{a:'A'}}); await b.write({version:99,entries:{}},0); await assert.rejects(()=>s.reload()); assert.throws(()=>s.snapshot()); await assert.rejects(()=>s.flush()); assert.equal(b.inspect().value.version,99); });
await check('dangerous-key-roundtrip', async()=> { const {b,s}=await loaded({version:2,entries:{}}); for(const key of ['__proto__','constructor','toString']) s.set(key,'P'); await s.flush(); const r=createStore(b); await r.reload(); const result=r.snapshot(); for(const key of ['__proto__','constructor','toString']) { assert.ok(Object.hasOwn(result,key)); assert.equal(result[key],'P'); } assert.equal(Object.getPrototypeOf(result),Object.prototype); assert.equal({}.polluted,undefined); });
await check('invalid-dictionary-containers', async()=> { for(const entries of [new Date(0),new Map([['a',7]]),new Set(['a']),[]]) { const b=backend({version:2,entries}), s=createStore(b); await assert.rejects(()=>s.reload()); await assert.rejects(()=>s.flush()); assert.equal(b.inspect().revision,0); } });
await check('null-prototype-dictionary', async()=> { const entries=Object.assign(Object.create(null),{a:'A'}); const {b,s}=await loaded({version:2,entries}); await s.flush(); const r=createStore(b); await r.reload(); assert.deepEqual(r.snapshot(),{a:'A'}); });
const pass=checks.every(c=>c.pass); console.log(JSON.stringify({pass,checks})); process.exitCode=pass?0:1;
