const test=require('node:test'),assert=require('node:assert/strict');
const actor='00000000-0000-4000-8000-000000000001',crewId='00000000-0000-4000-8000-000000000002',userId='00000000-0000-4000-8000-000000000003';
let authEmail='old@example.test',role='CREW_EVENT',syncError=null,providerError=null;const updates=[];
const db={from(table){let action='select';const q={select(){return q},eq(){return q},is(){return q},in(){return q},update(body){action='update';updates.push({table,body});return q},insert(body){updates.push({table,body});return q},maybeSingle:async()=>({data:{id:crewId,user_id:userId},error:null}),then(resolve,reject){return Promise.resolve({data:table==='user_roles'?[{role:{code:role}}]:[],error:table==='users'&&action==='update'?syncError:null}).then(resolve,reject)}};return q;},auth:{admin:{getUserById:async()=>({data:{user:{id:userId,email:authEmail}},error:null}),updateUserById:async(id,body)=>{updates.push({auth:id,body});if(providerError)return {error:providerError};authEmail=body.email;return {error:null};}}}};
const dbPath=require.resolve('../src/config/supabaseClient');require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:db};
const signedPath=require.resolve('../src/utils/signedUrl');require.cache[signedPath]={id:signedPath,filename:signedPath,loaded:true,exports:{getSignedDownloadUrl:async()=>''}};
const express=require('express'),router=require('../src/modules/crew/crew.routes');
test('admin email update enforces roles, stale checks, Auth/profile sync and rollback',async()=>{
 const app=express();app.use(express.json());app.use((req,res,next)=>{req.user={id:actor};req.role=req.headers['x-role']||'SUPER_ADMIN';next();});app.use('/crew',router);app.use((e,req,res,next)=>res.status(e.status||500).json({message:e.message}));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url=`http://127.0.0.1:${server.address().port}/crew/${crewId}/email`;
 const call=(body,r='SUPER_ADMIN')=>fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json','x-role':r},body:JSON.stringify(body)});
 try{
  const body={email:'new@example.test',expectedEmail:authEmail};assert.equal((await call(body,'CREW_EVENT')).status,403);assert.equal(updates.length,0);
  assert.equal((await call({...body,email:'invalid'})).status,422);
  role='SUPER_ADMIN';assert.equal((await call(body)).status,403);role='CREW_EVENT';
  assert.equal((await call({...body,expectedEmail:'stale@example.test'})).status,409);assert.equal(updates.filter(x=>x.auth).length,0);
  providerError={code:'email_exists',message:'Email already exists'};assert.equal((await call(body)).status,400);assert.equal(authEmail,'old@example.test');providerError=null;
  syncError={code:'23505',message:'duplicate'};assert.equal((await call(body)).status,409);assert.equal(authEmail,'old@example.test');syncError=null;
  const response=await call(body);assert.equal(response.status,200);assert.equal((await response.json()).email,'new@example.test');assert.equal(authEmail,'new@example.test');
  assert.ok(updates.some(x=>x.table==='password_reset_otps'&&x.body.used));assert.ok(updates.some(x=>x.table==='audit_logs'&&x.body.action==='CREW_EMAIL_CHANGED'));
 }finally{await new Promise(r=>server.close(r));}
});
