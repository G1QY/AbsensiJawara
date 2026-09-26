const test=require('node:test'),assert=require('node:assert/strict');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const calls=[];
const source={
 crew:[{id:id(2),crew_type:'CREW_EVENT',status:'ACTIVE',base_salary:999,deleted_at:null,employee_code:'BDG-EVT-1',user:{full_name:'Event'},event_assignments:[],store_assignments:[{id:'private-store'}]},{id:id(3),crew_type:'CREW_STORE',base_salary:777,deleted_at:null,user:{full_name:'Store'}}],
 attendance_logs:[{id:id(4),crew_id:id(2),event_assignment_id:id(20),crew:{user_id:id(2)},check_in:'2026-09-01',review_status:'PENDING'},{id:id(5),crew_id:id(3),event_assignment_id:null,crew:{user_id:id(3)},check_in:'2026-09-01'},{id:id(6),crew_id:id(1),event_assignment_id:id(21),crew:{user_id:id(1)},check_in:'2026-09-01'}],
 guest_attendances:[{id:id(7),crew_type:'CREW_EVENT',assignment_kind:'EVENT'},{id:id(8),crew_type:'CREW_STORE',assignment_kind:'STORE'},{id:id(9),crew_type:'CREW_EVENT',assignment_kind:'OFFICE'}],branches:[],events:[],stores:[{private:true}],
};
const db={from(table){calls.push({table});let rows=source[table]||[];const q={select(){return q},eq(k,v){rows=rows.filter(r=>r[k]===v);return q},is(k,v){rows=rows.filter(r=>r[k]===v);return q},order(){return q},range(a,b){rows=rows.slice(a,b+1);return q},maybeSingle(){return Promise.resolve({data:rows[0]||null,error:null})},then(resolve,reject){return Promise.resolve({data:rows,error:null}).then(resolve,reject)}};return q},async rpc(name,args){calls.push({name,args});return {data:null,error:null}}};
const client=require.resolve('../src/config/supabaseClient');require.cache[client]={id:client,filename:client,loaded:true,exports:db};
const {eventManagerBoundary}=require('../src/security/eventManager');
test('event manager is isolated from global admin APIs and event attendance guards reject store/self records before RPC',async()=>{
 const express=require('express'),app=express();app.use(express.json());app.use((req,res,next)=>{req.role=req.get('x-role')||'EVENT_MANAGER';req.user={id:id(1)};next()});app.use(eventManagerBoundary);
 app.use('/crew',require('../src/modules/crew/crew.routes'));app.use('/admin-directory',require('../src/modules/crew/directory.routes'));app.use('/admin-attendance',require('../src/modules/attendance/adminAttendance.routes'));
 app.use((req,res)=>res.json({allowed:true}));app.use((e,req,res,next)=>res.status(e.status||500).json({message:e.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 const request=(p,method='GET',body,role='EVENT_MANAGER')=>fetch(base+p,{method,headers:{'Content-Type':'application/json','x-role':role},...(body?{body:JSON.stringify(body)}:{})});
 try{
  for(const p of ['/accounts','/users','/stores','/store-assignments','/admin-store-schedules','/reports/attendance','/audit-logs','/dashboard/admin','/dashboard/revenue','/payroll'])assert.equal((await request(p)).status,403,p);
  for(const [p,method]of [['/crew','POST'],['/crew/'+id(2),'PATCH'],['/crew/'+id(2)+'/reset-password','PATCH'],['/crew/'+id(2)+'/reveal-password','POST'],['/admin-directory/stores','POST'],['/payroll/paid','POST']])assert.equal((await request(p,method,{})).status,403,p);
  for(const p of ['/users/me','/notifications','/attendance/today','/crew-store/workspace','/payroll/me','/payroll/event/'+id(20),'/admin-events'])assert.equal((await request(p)).status,200,p);
  assert.equal((await request('/accounts','GET',undefined,'SUPER_ADMIN')).status,200);
  let res=await request('/crew'),rows=await res.json();assert.equal(rows.length,1);assert.equal(rows[0].id,id(2));assert.equal('base_salary' in rows[0],false);assert.deepEqual(rows[0].store_assignments,[]);
  assert.equal((await request('/crew/'+id(3))).status,403);assert.equal((await request('/crew/'+id(2))).status,200);
  calls.length=0;res=await request('/admin-directory');assert.deepEqual((await res.json()).stores,[]);assert.equal(calls.some(c=>c.table==='stores'),false);
  res=await request('/admin-attendance?crewType=CREW_STORE&crewId='+id(3));const all=await res.json();assert.deepEqual(all.registered.map(r=>r.id),[id(4)]);assert.deepEqual(all.guest.map(r=>r.id),[id(7)]);
  for(const [kind,n]of [['registered',5],['registered',6],['guest',8],['guest',9]]){
   const path='/admin-attendance/'+kind+'/'+id(n);assert.equal((await request(path)).status,403);
   assert.equal((await request(path+'/review','PATCH',{decision:'APPROVED',target:'attendance'})).status,403);
   assert.equal((await request(path,'DELETE',{reason:'not allowed'})).status,403);
  }
  assert.equal(calls.some(c=>c.name),false);
  assert.equal((await request('/admin-attendance/registered/'+id(4)+'/review','PATCH',{decision:'APPROVED',target:'attendance'})).status,200);
  assert.equal(calls.at(-1).name,'review_attendance');assert.equal(calls.at(-1).args.p_actor,id(1));
  assert.equal((await request('/admin-attendance/guest/'+id(7),'DELETE',{reason:'duplicate event entry'})).status,200);
  assert.equal(calls.at(-1).name,'delete_admin_attendance');
  assert.equal((await request('/admin-attendance/import-guest','POST',{})).status,403);
 }finally{await new Promise(r=>server.close(r))}
});
