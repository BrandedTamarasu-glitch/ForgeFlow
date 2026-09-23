// Hidden from trial workspaces. Uses the frozen adapter, not trial-edited backend code.
const assert = require('node:assert/strict');
const path = require('node:path');
const { Backend } = require('./base/src/backend');
async function evaluate(root) {
  const { Shelf } = require(path.join(root, 'src/shelf.js'));
  const results = [];
  const check = async (id, run) => { try { await run(); results.push({ id, pass: true }); } catch (error) { results.push({ id, pass: false, error: error.message }); } };
  await check('serial-reopen', async () => {
    const b = new Backend(), s = new Shelf(b); await s.append('a','A'); await s.append('b','B');
    assert.deepEqual(await new Shelf(b).notes(), [{id:'a',text:'A'},{id:'b',text:'B'}]);
  });
  await check('concurrent-accepted', async () => {
    const b = new Backend();
    const receipts = await Promise.all([new Shelf(b).append('a','A'),new Shelf(b).append('b','B'),new Shelf(b).append('c','C')]);
    assert.ok(receipts.every(result => result.saved === true));
    assert.deepEqual((await new Shelf(b).notes()).map(n=>n.id).sort(), ['a','b','c']);
  });
  await check('duplicate-delivery', async () => {
    const b = new Backend();
    await Promise.all([new Shelf(b).append('a','A'),new Shelf(b).append('a','A')]);
    assert.deepEqual(await new Shelf(b).notes(), [{id:'a',text:'A'}]);
  });
  await check('cleanup-publication', async () => {
    const b = new Backend(), s = new Shelf(b);
    const candidate = await b.stage(JSON.stringify({schema:2,notes:[{id:'accepted',text:'value'}]}));
    b.afterList = () => b.publish(candidate, 'g0');
    await s.sweep();
    assert.deepEqual(await new Shelf(b).notes(), [{id:'accepted',text:'value'}]);
  });
  await check('migration', async () => {
    const b = new Backend({schema:1,entries:[{id:'old',text:'keep'}]});
    await new Shelf(b).append('new','added');
    assert.deepEqual(await new Shelf(b).notes(), [{id:'old',text:'keep'},{id:'new',text:'added'}]);
    assert.equal(JSON.parse(await b.read(b.head)).schema, 2);
  });
  await check('unsupported-no-write', async () => {
    const b = new Backend({schema:9,notes:[]}), before = [...b.blobs];
    await assert.rejects(new Shelf(b).append('a','A'), /unsupported/);
    assert.equal(b.head, 'g0'); assert.deepEqual([...b.blobs], before);
  });
  await check('removal-failure', async () => {
    const b = new Backend(), s = new Shelf(b); await s.append('a','A'); b.failRemove = true;
    await assert.rejects(s.sweep(), /removal/);
    assert.deepEqual(await new Shelf(b).notes(), [{id:'a',text:'A'}]);
  });
  await check('collect-orphans', async () => {
    const b = new Backend(), s = new Shelf(b); await s.append('a','A'); await b.stage('orphan'); await s.sweep();
    assert.deepEqual([...b.blobs.keys()], [b.head]);
  });
  return results;
}
if (require.main === module) evaluate(path.resolve(process.argv[2])).then(results=>console.log(JSON.stringify(results))).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports = { evaluate };
