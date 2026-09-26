const test=require('node:test'),assert=require('node:assert/strict');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');let saved=[],rpcCalls=[];
const db={from(table){let payload=null;const q={select(){return q},eq(){return q},in(){return q},gte(){return q},lte(){return q},order(){return q},limit(){return q},range(){return q},insert(value){payload=value;saved.push(value);return q},upsert(values){payload=values;saved.push(...values);return q},async single(){return {data:{id:id(9),...payload},error:null}},then(resolve,reject){let data=[];if(payload)data=payload.map((row,i)=>({id:id(10+i),...row}));else if(table==='store_assignments')data=[{id:id(2),crew_id:id(1),store_id:id(3),start_date:'2026-01-01',status:'ACTIVE',crew:{crew_type:'CREW_STORE',status:'ACTIVE',user:{is_active:true}},store:{status:'ACTIVE'}}];return Promise.resolve({data,error:null}).then(resolve,reject)}};return q}};
for(const [file,value]of [['../src/config/supabaseClient',db],['../src/services/nationalHolidaySync',{ensureHolidayYears:async()=>[],syncHolidayYear:async()=>({})}],['../src/utils/auditLogger',{logAudit:async data=>rpcCalls.push(data)}]]){const p=require.resolve(file);require.cache[p]={id:p,filename:p,loaded:true,exports:value}}
test('single/range/bulk schedule endpoints persist all three shifts, overnight hours, person selection and audit',async()=>{
 const express=require('express'),app=express();app.use(express.json());app.use((req,res,next)=>{req.role=req.get('x-role')||'SUPER_ADMIN';req.user={id:id(100)};next()});app.use('/schedules',require('../src/modules/stores/adminStoreSchedules.routes'));app.use((e,req,res,next)=>res.status(e.status||500).json({message:e.message}));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port+'/schedules';
 const post=(p,body,role='SUPER_ADMIN')=>fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json','x-role':role},body:JSON.stringify(body)});
 const body={crewId:id(1),storeId:id(3),crewIds:[id(1)],scheduleDate:'2026-09-25',startDate:'2026-09-25',endDate:'2026-09-25',startTime:'22:00',endTime:'06:00',shiftNumber:3,lateToleranceMinutes:0,overtimePreapproved:false,workDays:[0,1,2,3,4,5,6]};
 try{
  for(const [path,shift]of [['',1],['/range',2],['/bulk',3]]){const response=await post(path,{...body,shiftNumber:shift});assert.equal(response.status,201,await response.clone().text());assert.equal(saved.at(-1).shift_number,shift);assert.equal(saved.at(-1).end_time,'06:00');}
  assert.equal(rpcCalls.length,3);assert.equal(saved.length,3);
  assert.equal((await post('',{...body,startTime:'06:00'})).status,422);
  assert.equal((await post('/range',{...body,shiftNumber:4})).status,422);
  assert.equal((await post('',body,'OFFICE_STAFF')).status,403);
  assert.equal((await post('/bulk',body,'EVENT_MANAGER')).status,403);
 }finally{await new Promise(r=>server.close(r))}
});
