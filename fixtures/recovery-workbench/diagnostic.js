// Post-freeze diagnostic. Deliberately separate from the primary acceptance suite.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Backend } = require('./base/src/backend');
async function observe(Shelf) {
  const backend = new Backend(), read = backend.read.bind(backend);
  let once = true;
  backend.read = async id => {
    if (once) {
      once = false;
      const publisher = new Shelf(backend);
      await publisher.append('accepted', 'value');
      await publisher.sweep();
    }
    return read(id);
  };
  try { return { status: 'returned', notes: await new Shelf(backend).notes() }; }
  catch (error) { return { status: 'failed', error: error.message }; }
}
async function diagnose() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-control-diagnostic-'));
  try {
    fs.cpSync(path.join(__dirname, 'base'), root, { recursive: true });
    fs.copyFileSync(path.join(__dirname, 'corrected-shelf.js'), path.join(root, 'src/shelf.js'));
    const { Shelf } = require(path.join(root, 'src/shelf'));
    return await observe(Shelf);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
if (require.main === module) {
  const result = process.argv[2] ? observe(require(path.resolve(process.argv[2], 'src/shelf.js')).Shelf) : diagnose();
  result.then(result => console.log(JSON.stringify({ classification: 'post-freeze diagnostic, not primary scoring', result })));
}
module.exports = { diagnose, observe };
