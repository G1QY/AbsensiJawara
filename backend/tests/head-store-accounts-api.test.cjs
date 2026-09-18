const test=require('node:test'),assert=require('node:assert/strict');
const path=require.resolve('../src/config/supabaseClient');
const calls=[];let authError=null,sqlError=null;
const db={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='prepare_crew_deletion'?{user_id:'user-delete'}:{city:'Bandung',crew:[],stores:[],branches:[],attendance:[]},error:sqlError};},auth:{admin:{deleteUser:async(id,soft)=>{calls.push({deleted:id,soft});return {error:authError};}}}};
require.cache[path]={id:path,filename:path,loaded:true,exports:db};
const express=require('express'),{headStoreBoundary}=require('../src/security/headStore'),{deleteCrew}=require('../src/modules/crew/deleteCrew'),requireRole=require('../src/middlewares/requireRole');
test('head cannot use global endpoints or spoof a city; account roles are super-admin only; delete requires confirmation and survives failure',async()=>{
 const app=express();app.use(express.json());app.use((req,res,next)=>{req.role=req.get('x-role')||'HEAD_STORE';req.user={id:'00000000-0000-4000-8000-000000000001'};next();});
 app.use(headStoreBoundary);app.use('/head-store',require('../src/modules/accounts/headStore.routes'));app.use('/accounts',require('../src/modules/accounts/accounts.routes'));
 app.delete('/crew/:id',requireRole('SUPER_ADMIN'),deleteCrew);app.get('/users/me',(req,res)=>res.json({self:true}));app.use((req,res)=>res.json({global:true}));app.use((e,req,res,next)=>res.status(e.status||500).json({message:e.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 const call=(p,role='HEAD_STORE',method='GET',body)=>fetch(base+p,{method,headers:{'x-role':role,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 try{
  for(const role of ['HEAD_STORE','ADMIN_STORE']) for(const p of ['/crew','/users','/admin-directory','/reports/attendance','/dashboard/admin','/admin-attendance','/store-assignments','/accounts','/admin-events','/audit-logs']) assert.equal((await call(p,role)).status,403,p);
  assert.equal((await call('/users/me')).status,200);
  assert.equal((await call('/head-store?city=Jakarta&actor=someone')).status,200);
  assert.equal(calls.at(-1).args.p_actor,'00000000-0000-4000-8000-000000000001');assert.equal(calls.at(-1).args.city,undefined);
  assert.equal((await call('/head-store?from=2026-01-01&to=2026-09-18')).status,400);
  assert.equal((await call('/head-store','CREW_STORE')).status,403);
  const target='/accounts/00000000-0000-4000-8000-000000000002/role';
  assert.equal((await call(target,'EVENT_MANAGER','PATCH',{role:'SUPER_ADMIN'})).status,403);
  assert.equal((await call(target,'SUPER_ADMIN','PATCH',{role:'HEAD_STORE'})).status,422);
  assert.equal((await call(target,'SUPER_ADMIN','PATCH',{role:'UNKNOWN'})).status,422);
  const d='/crew/00000000-0000-4000-8000-000000000002';
  assert.equal((await call(d,'SUPER_ADMIN','DELETE')).status,422);assert.equal(calls.filter(c=>c.deleted).length,0);
  assert.equal((await call(d,'EVENT_MANAGER','DELETE',{confirm:true,email:'test@x.invalid'})).status,403);
  sqlError={code:'42501',message:'Self deletion blocked'};
  assert.equal((await call(d,'SUPER_ADMIN','DELETE',{confirm:true,email:'test@x.invalid'})).status,403);assert.equal(calls.filter(c=>c.deleted).length,0);
  sqlError=null;authError=new Error('Auth unavailable');
  assert.equal((await call(d,'SUPER_ADMIN','DELETE',{confirm:true,email:'test@x.invalid'})).status,503);
  authError=null;
  assert.equal((await call(d,'SUPER_ADMIN','DELETE',{confirm:true,email:'test@x.invalid'})).status,200);
  assert.deepEqual(calls.at(-1),{deleted:'user-delete',soft:false});
 }finally{await new Promise(r=>server.close(r));}
});
