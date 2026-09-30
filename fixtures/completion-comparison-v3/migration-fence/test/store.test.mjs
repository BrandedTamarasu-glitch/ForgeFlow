import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.mjs';
import { backend } from '../backend.mjs';
test('load and persist current entries', async()=> { const b=backend({version:2,entries:{a:'A'}}), s=createStore(b); await s.reload(); s.set('b','B'); await s.flush(); const r=createStore(b); await r.reload(); assert.deepEqual(r.snapshot(),{a:'A',b:'B'}); });
test('legacy entries remain available', async()=> { const b=backend({version:1,items:{a:'A'}}), s=createStore(b); await s.reload(); assert.deepEqual(s.snapshot(),{a:'A'}); });
test('special dictionary keys survive reconstruction', async()=> { const b=backend({version:2,entries:{}}), s=createStore(b); await s.reload(); s.set('__proto__','P'); await s.flush(); const r=createStore(b); await r.reload(); assert.ok(Object.hasOwn(r.snapshot(),'__proto__')); assert.equal(r.snapshot().__proto__,'P'); });
