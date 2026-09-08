const test=require('node:test'),assert=require('node:assert/strict');
const dbPath=require.resolve('../src/config/supabaseClient');
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{from(table){const q={select(){return q},eq(){return q},gte(){return q},lte(){return Promise.resolve({count:0,error:null})},maybeSingle(){return Promise.resolve({data:null,error:null})}};return q;}}};
const {syncHolidayYear}=require('../src/services/nationalHolidaySync');
test('missing future holiday data returns explicit warning without blocking schedules',async()=>{
 process.env.GOOGLE_CALENDAR_API_KEY='test';const old=global.fetch;global.fetch=async()=>({ok:false,status:404,json:async()=>({error:{message:'Not Found'}})});
 try{const r=await syncHolidayYear(2029);assert.equal(r.fallback,true);assert.equal(r.cached,false);assert.match(r.warning,/2029/);assert.equal(r.row_count,0);}finally{global.fetch=old;}
});
