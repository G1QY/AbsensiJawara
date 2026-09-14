const test = require('node:test');
const assert = require('node:assert/strict');
let cached = null, rowCount = 0, requests = 0, saves = 0;
const dbPath = require.resolve('../src/config/supabaseClient');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
  from() { const q = { select(){ return q; }, eq(){ return q; }, gte(){ return q; },
    lte(){ return Promise.resolve({ count: rowCount }); }, maybeSingle(){ return Promise.resolve({ data: cached }); } }; return q; },
  async rpc(name, args) { saves++; rowCount = args.p_rows.length; cached = { year: args.p_year, synced_at: new Date().toISOString(), row_count: rowCount }; return { data: rowCount }; },
} };
const { syncHolidayYear } = require('../src/services/nationalHolidaySync');

test('100 simultaneous readers share one provider request and subsequent reads use stored data', async () => {
  const previous = global.fetch;
  process.env.GOOGLE_CALENDAR_API_KEY = 'test-only';
  global.fetch = async () => { requests++; await new Promise(resolve => setImmediate(resolve)); return {
    ok: true, json: async () => ({ items: [{ summary: 'Holiday', start: { date: '2028-01-01' }, end: { date: '2028-01-02' } }] }),
  }; };
  try {
    const results = await Promise.all(Array.from({ length: 100 }, () => syncHolidayYear(2028)));
    assert.equal(requests, 1); assert.equal(saves, 1);
    assert.ok(results.every(r => r.row_count === 1));
    await syncHolidayYear(2028); assert.equal(requests, 1);
    await syncHolidayYear(2028, { force: true }); assert.equal(requests, 2);
  } finally { global.fetch = previous; }
});

test('provider failure with stale data does not retry for every reader', async () => {
  const previous = global.fetch;
  cached = { year: 2030, synced_at: '2020-01-01T00:00:00Z', row_count: 1 }; rowCount = 1; requests = 0;
  global.fetch = async () => { requests++; throw new Error('offline'); };
  try {
    const first = await syncHolidayYear(2030);
    const next = await syncHolidayYear(2030);
    assert.equal(first.fallback, true); assert.equal(next.cached, true); assert.equal(requests, 1);
    await syncHolidayYear(2030, { force: true }); assert.equal(requests, 2);
  } finally { global.fetch = previous; }
});
