const test=require('node:test'),assert=require('node:assert/strict');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const revision='a'.repeat(32),calls=[];
const source={policy:{monthly_basis:'MONTHLY',late_rate:12000,late_rounding:'MINUTE',overtime_rate:10000,absence_mode:'NONE',absence_rate:0,event_basis:'PER_ATTENDANCE'},people:[{id:id(2),user_id:id(3),full_name:'Uji',status:'ACTIVE',crew_type:'CREW_STORE',base_salary:2000000,join_date:'2020-01-01'}]};
const db={async rpc(name,args){calls.push({name,args});return {data:name==='payroll_workspace'?{revision,source}:id(6),error:null};}};
const client=require.resolve('../src/config/supabaseClient');require.cache[client]={id:client,filename:client,loaded:true,exports:db};
test('payroll API enforces roles, own-user scope, saved policy validation, revision and server-calculated final amounts',async()=>{
 const app=require('express')();app.use(require('express').json());app.use((req,res,next)=>{req.user={id:id(1)};req.role=req.get('x-role')||'SUPER_ADMIN';next();});app.use(require('../src/security/headStore').headStoreBoundary);app.use('/payroll',require('../src/modules/payroll/payroll.routes'));app.use((e,req,res,next)=>res.status(e.status||500).json({message:e.message}));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const root='http://127.0.0.1:'+server.address().port;
 const get=(path,role='SUPER_ADMIN')=>fetch(root+path,{headers:{'x-role':role}});
 const post=(action,body,role='SUPER_ADMIN')=>fetch(root+'/payroll/'+action,{method:'POST',headers:{'Content-Type':'application/json','x-role':role},body:JSON.stringify({month:'2020-01',revision,...body})});
 try{
  for(const role of ['CREW_STORE','CREW_EVENT','HEAD_STORE','ADMIN_STORE','EVENT_MANAGER','HEAD_OFFICE','OFFICE_STAFF','PRODUCTION_STAFF']){
   let response=await get('/payroll/me?month=2020-01&userId='+id(99),role);assert.equal(response.status,200);assert.equal(calls.at(-1).args.p_user,id(1));assert.equal(response.headers.get('cache-control'),'no-store');
   assert.equal((await get('/payroll?month=2020-01',role)).status,403);
   assert.equal((await post('policy',{policy:source.policy},role)).status,403);
  }
  assert.equal((await get('/payroll/me?month=2020-01')).status,403);
  assert.equal((await get('/payroll?month=2020-13')).status,422);
  assert.equal((await post('policy',{policy:source.policy})).status,200);
  assert.equal((await post('policy',{policy:{...source.policy,late_rate:1.5}})).status,422);
  assert.equal((await post('policy',{policy:{...source.policy,late_rate:-1}})).status,422);
  assert.equal((await post('adjustment',{crewId:id(2),scopeKey:'MONTHLY',adjustment:{rate_override:null,allowance:1,deduction:0,note:''}})).status,422);
  assert.equal((await post('finalize',{crewId:id(2),scopeKey:'MONTHLY',revision:'b'.repeat(32)})).status,409);
  let preview=await post('preview',{policy:{...source.policy,late_rate:25000}});assert.equal(preview.status,200);assert.equal((await preview.json()).rows[0].policy.late_rate,25000);assert.equal(source.policy.late_rate,12000);
  assert.equal((await post('preview',{policy:source.policy},'CREW_STORE')).status,403);
  assert.equal((await post('batch-adjustments',{keys:[id(2)+':MONTHLY'],patch:{allowance:50000,note:'Transport'}})).status,200);
  assert.equal(calls.at(-1).name,'mutate_payroll_adjustments');assert.equal(calls.at(-1).args.p_rows[0].allowance,50000);assert.equal(calls.at(-1).args.p_rows[0].rate_override,null);
  assert.equal((await post('batch-adjustments',{keys:[id(2)+':MONTHLY',id(2)+':MONTHLY'],patch:{allowance:1,note:'Uji'}})).status,422);
  assert.equal((await post('batch-adjustments',{keys:['missing'],patch:{deduction:1,note:'Uji'}})).status,409);
  assert.equal((await post('batch-adjustments',{keys:[id(2)+':MONTHLY'],patch:{allowance:-1,note:'Uji'}})).status,422);
  preview=await post('batch-adjustments',{keys:[id(2)+':MONTHLY'],patch:{allowance:50000,note:'Transport'},preview:true});assert.equal(preview.status,200);assert.equal((await preview.json()).rows[0].total,2050000);
  const response=await post('finalize',{crewId:id(2),scopeKey:'MONTHLY',total:1,status:'PAID'});assert.equal(response.status,200,await response.text());
  assert.equal(calls.at(-1).args.p_data.total,2000000);assert.equal(calls.at(-1).args.p_data.status,'DRAFT');assert.equal(calls.at(-1).args.p_actor,id(1));
  assert.equal((await post('paid',{id:id(6),paid_date:'2026-02-30',payment_reference:'REF-1'})).status,422);
  assert.equal((await post('reopen',{id:id(6),note:'x'})).status,422);
 }finally{await new Promise(r=>server.close(r));}
});
