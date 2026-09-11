const test = require('node:test');
const assert = require('node:assert/strict');
let saved, cached = null, count = 0;
const dbPath = require.resolve('../src/config/supabaseClient');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
 from() { const q = { select(){return q}, eq(){return q}, gte(){return q},
 lte(){return Promise.resolve({count,error:null})}, maybeSingle(){return Promise.resolve({data:cached,error:null})} }; return q; },
 async rpc(name,args) { assert.match(args.p_provider, /^https:\/\//); assert.ok(!args.p_provider.includes('key=')); saved = args; return {data:args.p_rows.length,error:null}; },
}};
const { syncHolidayYear } = require('../src/services/nationalHolidaySync');
const { officialRows } = require('../src/services/officialHolidays');
test('2026 fallback covers 17 national and 8 collective days, not September or other years', () => {
 const rows = officialRows(2026);
 assert.equal(rows.filter(r=>r.kind==='NATIONAL_HOLIDAY').length,17);
 assert.equal(rows.filter(r=>r.kind==='COLLECTIVE_LEAVE').length,8);
 assert.equal(rows.filter(r=>r.holiday_date.startsWith('2026-09')).length,0);
 assert.deepEqual(officialRows(2027),[]);
});
test('missing API key stores official data and does not report unavailable', async () => {
 delete process.env.GOOGLE_CALENDAR_API_KEY;
 const r = await syncHolidayYear(2026,{force:true});
 assert.equal(r.row_count,25); assert.equal(r.warning,undefined);
 assert.equal(saved.p_rows.find(r=>r.holiday_date==='2026-08-17').kind,'NATIONAL_HOLIDAY');
});
test('fresh metadata with empty holiday table must refill data', async () => {
 cached = {year:2026,synced_at:new Date().toISOString(),row_count:25}; count=0; saved=null;
 await syncHolidayYear(2026);
 assert.equal(saved.p_rows.length,25);
});

test('successful Google response persists HTTPS provider without API key', async () => {
 process.env.GOOGLE_CALENDAR_API_KEY='test-secret';
 const old=global.fetch;
 global.fetch=async()=>({ok:true,status:200,json:async()=>({items:[{summary:'Libur',start:{date:'2028-01-01'},end:{date:'2028-01-02'}}]})});
 try {
  const r=await syncHolidayYear(2028,{force:true});
  assert.equal(r.fallback,false); assert.equal(saved.p_rows.length,1);
  assert.match(saved.p_provider,/^https:\/\/www.googleapis.com\//);
  assert.ok(!saved.p_provider.includes('test-secret'));
 } finally {global.fetch=old;}
});
