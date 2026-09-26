const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const path=require.resolve('../src/config/supabaseClient');let result=null,error=null,calls=[];
require.cache[path]={id:path,filename:path,loaded:true,exports:{rpc:async(name,args)=>{calls.push({name,args});return {data:result,error}}}};
const vault=require('../src/modules/crew/passwordVault');
process.env.CREW_PASSWORD_VAULT_KEY=crypto.randomBytes(32).toString('base64');
const user='00000000-0000-4000-8000-000000000002';
test('AES ciphertext is bound to account, randomized, rejects tampering and wrong key',()=>{
 const a=vault.encrypt('FixturePassword42!',user),b=vault.encrypt('FixturePassword42!',user);
 assert.notEqual(a,b);assert.ok(!a.includes('FixturePassword42!'));assert.equal(vault.decrypt(a,user),'FixturePassword42!');
 assert.throws(()=>vault.decrypt(a,'another-user'));
 const parts=a.split('.');parts[1]=Buffer.alloc(16).toString('base64');assert.throws(()=>vault.decrypt(parts.join('.'),user));
 const key=process.env.CREW_PASSWORD_VAULT_KEY;process.env.CREW_PASSWORD_VAULT_KEY=crypto.randomBytes(32).toString('base64');assert.throws(()=>vault.decrypt(a,user));process.env.CREW_PASSWORD_VAULT_KEY=key;
});
test('reveal endpoint denies all other roles, never caches; unavailable and failures never expose ciphertext',async()=>{
 const express=require('express'),app=express();app.use(express.json());
 app.use((req,res,next)=>{req.role=req.get('x-role');req.user={id:'00000000-0000-4000-8000-000000000001'};next()});
 app.post('/crew/:id/reveal-password',require('../src/middlewares/requireRole')('SUPER_ADMIN'),vault.reveal);
 app.use((e,req,res,next)=>res.status(e.status||500).json({message:e.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const call=role=>fetch('http://127.0.0.1:'+server.address().port+'/crew/'+user+'/reveal-password',{method:'POST',headers:{'x-role':role}});
 try{
  for(const role of ['HEAD_STORE','ADMIN_STORE','EVENT_MANAGER','CREW_STORE','CREW_EVENT','GUEST'])assert.equal((await call(role)).status,403);
  assert.equal(calls.length,0);
  let r=await call('SUPER_ADMIN');assert.match(r.headers.get('cache-control'),/no-store/);assert.equal((await r.json()).available,false);
  result={user_id:user,ciphertext:vault.encrypt('FixturePassword42!',user)};
  r=await call('SUPER_ADMIN');assert.deepEqual(await r.json(),{available:true,password:'FixturePassword42!'});
  error={code:'42501'};r=await call('SUPER_ADMIN');assert.equal(r.status,403);assert.ok(!(await r.text()).includes('FixturePassword42!'));error=null;
  const notice=await vault.remember('actor',{id:user,updated_at:'2026-09-24T00:00:00Z'},'FixturePassword42!');assert.equal(notice,'');assert.ok(!JSON.stringify(calls.at(-1)).includes('FixturePassword42!'));
  error={code:'40001'};assert.match(await vault.remember('actor',{id:user,updated_at:'old'},'FixturePassword42!'),/salinan/);error=null;
 }finally{await new Promise(r=>server.close(r))}
});
