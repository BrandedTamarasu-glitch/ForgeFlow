const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Backend } = require('../src/backend');
const { Shelf } = require('../src/shelf');
test('save and reopen', async () => {
  const backend = new Backend(); const shelf = new Shelf(backend);
  assert.deepEqual(await shelf.append('a', 'hello'), { saved: true });
  await shelf.sweep();
  assert.deepEqual(await new Shelf(backend).notes(), [{ id: 'a', text: 'hello' }]);
});
