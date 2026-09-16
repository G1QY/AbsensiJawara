const test = require('node:test');
const assert = require('node:assert/strict');
const {loadRevenue,revenuePeriod}=require('../src/modules/dashboard/revenue.service');
const row=(id,data,status='COMPLETED',date='2026-09-01',max=15)=>({id,event_date:date,status,workflow:{data,max_reached:max}});
function database(rows,error=null){
 const calls=[];
 return {calls,from(table){assert.equal(table,'events');const q={
  select(fields){assert.ok(fields.includes('workflow:event_workflows'));return q;},
  gte(k,v){calls.push([k,'gte',v]);return q;},lt(k,v){calls.push([k,'lt',v]);return q;},
  not(){return q;},order(){return q;},async range(a,b){calls.push([a,b]);return {data:rows.slice(a,b+1),error};},
 };return q;}};
}
test('dashboard sums one event once, respects zero, legacy revenue, cancellation and incomplete reports',async()=>{
 const db=database([row('1',{omset_tunai:700000,omset_transfer:200000,omset_nominal:9900000}),row('2',{omset_tunai:0,omset_transfer:0,omset_nominal:999}),row('3',{omset_nominal:50000},'ONGOING',undefined,11),row('4',{}),row('5',{omset_nominal:1000},'CANCELLED'),row('6',{omset_nominal:1000},'DRAFT'),row('7',{omset_nominal:1000},'COMPLETED','2025-01-01')]);
 const result=await loadRevenue(db,'2026-09');
 assert.deepEqual(result.current,{month:'2026-09',revenue:950000,recordedEvents:3,missingEvents:1,unfinishedEvents:1});
 assert.equal(result.months.length,6);
 assert.ok(db.calls.some(call=>call[2]==='2026-04-01'));
 assert.ok(db.calls.some(call=>call[2]==='2026-10-01'));
});
test('dashboard revenue paginates, crosses years, and propagates unavailable/invalid data',async()=>{
 const db=database(Array.from({length:501},(_,i)=>row(String(i),{omset_nominal:10})));
 assert.equal((await loadRevenue(db,'2026-09')).current.revenue,5010);
 assert.ok(db.calls.some(call=>call[0]===500));
 assert.equal(revenuePeriod('2026-02').from,'2025-09-01');
 for(const month of ['2026-13','junk','2026-2',['2026-09']])assert.throws(()=>revenuePeriod(month),{status:400});
 await assert.rejects(loadRevenue(database([],{message:'offline'}),'2026-09'),{status:503});
 await assert.rejects(loadRevenue(database([row('1',{omset_tunai:'NaN'})]),'2026-09'),{status:422});
});
test('dashboard revenue endpoint is restricted to admin roles',async()=>{
 const express=require('express');
 const path=require.resolve('../src/config/supabaseClient');
 require.cache[path]={id:path,filename:path,loaded:true,exports:database([row('1',{omset_nominal:900000})])};
 const app=express();app.use((req,res,next)=>{req.role=req.headers['x-role'];next();});
 app.use('/dashboard',require('../src/modules/dashboard/dashboard.routes'));
 app.use((err,req,res,next)=>res.status(err.status||500).json({message:err.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const url=`http://127.0.0.1:${server.address().port}/dashboard/revenue?month=2026-09`;
 try{
  const allowed=await fetch(url,{headers:{'x-role':'SUPER_ADMIN'}});assert.equal(allowed.status,200);assert.equal((await allowed.json()).current.revenue,900000);
  assert.equal((await fetch(url,{headers:{'x-role':'CREW_EVENT'}})).status,403);
 }finally{await new Promise(r=>server.close(r));}
});
