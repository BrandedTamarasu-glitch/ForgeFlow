// Checkout-only synthetic policies, not an application financial engine.
const MAX_MINOR = 1000000000;
const MIN_YEAR = 1900, MAX_YEAR = 2100;
function scale(value) {
  if (!Number.isInteger(value) || value < 0 || value > 3) throw new Error('unsupported scale');
  return value;
}
function minor(value) {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_MINOR) throw new Error('amount out of range');
  return value === 0 ? 0 : value;
}
function bounded(value) {
  if (value < -BigInt(MAX_MINOR) || value > BigInt(MAX_MINOR)) throw new Error('amount out of range');
  return Number(value);
}
function parseAmount(text, digits, rounding) {
  scale(digits);
  if (!['half-even', 'half-away'].includes(rounding)) throw new Error('rounding policy required');
  if (text === null) return null;
  if (typeof text !== 'string' || text.length > 64 || !/^-?\d+(?:\.\d+)?$/.test(text)) throw new Error('invalid canonical amount');
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace(/^-/, '').split('.');
  const padded = fraction.padEnd(digits, '0');
  let units = BigInt(whole) * 10n ** BigInt(digits) + BigInt(padded.slice(0, digits) || '0');
  const discarded = fraction.slice(digits);
  if (discarded) {
    const numerator = BigInt(discarded), denominator = 10n ** BigInt(discarded.length);
    const twice = numerator * 2n;
    if (twice > denominator || (twice === denominator && (rounding === 'half-away' || units % 2n === 1n))) units++;
  }
  return bounded(negative ? -units : units);
}
function canonical(value, digits) {
  minor(value); scale(digits);
  const absolute = Math.abs(value).toString().padStart(digits + 1, '0');
  return (value < 0 ? '-' : '') + (digits ? `${absolute.slice(0, -digits)}.${absolute.slice(-digits)}` : absolute);
}
function allocate(value, count) {
  minor(value);
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('invalid allocation count');
  const amount = BigInt(value), divisor = BigInt(count), quotient = amount / divisor, remainder = amount % divisor;
  return Array.from({ length: count }, (_, index) => Number(quotient + (BigInt(index) < (remainder < 0n ? -remainder : remainder) ? (value < 0 ? -1n : 1n) : 0n)));
}
function transfer(left, right, amount) {
  minor(left.minor); minor(right.minor); minor(amount); scale(left.scale); scale(right.scale);
  if (typeof left.unit !== 'string' || !left.unit || left.unit !== right.unit || left.scale !== right.scale || amount < 0) throw new Error('incompatible transfer');
  return [{ ...left, minor: bounded(BigInt(left.minor) - BigInt(amount)) }, { ...right, minor: bounded(BigInt(right.minor) + BigInt(amount)) }];
}
function totals(values) {
  let sum = 0n, missing = 0;
  for (const value of values) {
    if (value === null) missing++;
    else sum += BigInt(minor(value));
  }
  const known = bounded(sum);
  return { known, missing, total: missing ? null : known };
}
function daysInMonth(year, month) {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return month === 2 ? (leap ? 29 : 28) : ([4, 6, 9, 11].includes(month) ? 30 : 31);
}
function civil(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('invalid civil date');
  const [year, month, day] = text.split('-').map(Number);
  if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) throw new Error('date out of range');
  return { year, month, day };
}
function occurrence(anchor, offset, policy) {
  const start = civil(anchor);
  if (!Number.isInteger(offset) || offset < 0 || offset >= (MAX_YEAR - MIN_YEAR + 1) * 12) throw new Error('invalid month offset');
  if (!['clamp', 'skip', 'end-of-month'].includes(policy)) throw new Error('recurrence policy required');
  const ordinal = start.year * 12 + start.month - 1 + offset;
  const year = Math.floor(ordinal / 12), month = ordinal % 12 + 1;
  if (year > MAX_YEAR) throw new Error('date out of range');
  const last = daysInMonth(year, month);
  if (policy === 'skip' && start.day > last) return null;
  const day = policy === 'end-of-month' ? last : Math.min(start.day, last);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function preview(store, count, interval, policy) {
  if (!Number.isInteger(count) || count < 1 || count > 24 || !Number.isInteger(interval) || interval < 1 || interval > 12) throw new Error('invalid preview range');
  const state = JSON.parse(store.read());
  if (state.version !== 1) throw new Error('unsupported schema');
  scale(state.scale);
  if (state.amountMinor !== null) minor(state.amountMinor);
  return Array.from({ length: count }, (_, index) => ({ date: occurrence(state.anchor, index * interval, policy), amountMinor: state.amountMinor }));
}
function saveAmount(store, text, rounding) {
  const state = JSON.parse(store.read());
  if (state.version !== 1) throw new Error('unsupported schema');
  civil(state.anchor);
  const amountMinor = parseAmount(text, state.scale, rounding);
  store.write(JSON.stringify({ ...state, amountMinor }));
}
function present(value, digits, locale) {
  if (!['en-US', 'de-DE', 'ja-JP'].includes(locale)) throw new Error('unsupported fixture locale');
  scale(digits);
  if (value === null) return 'Not entered';
  minor(value);
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value / 10 ** digits);
}
module.exports = { MAX_MINOR, parseAmount, canonical, allocate, transfer, totals, civil, occurrence, preview, saveAmount, present };
