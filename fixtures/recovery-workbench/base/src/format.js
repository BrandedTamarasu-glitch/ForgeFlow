function decode(bytes) {
  const record = JSON.parse(bytes);
  if (![1, 2].includes(record.schema)) throw new Error('unsupported schema');
  return record.schema === 1 ? record.entries : record.notes;
}
module.exports = { decode };
