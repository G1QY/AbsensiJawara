const test=require('node:test'),assert=require('node:assert/strict');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
let selected=[],signed=[],active=0,maxActive=0,requested=[];
const rows=Array.from({length:15},(_,i)=>({id:id(100+i),user_id:id(i),crew_type:i===14?'CREW_STORE':'CREW_EVENT',base_salary:100000,user:{id:id(i)}}));
const db={from(){const q={select(){return q},is(){return q},order(){return q},range(){return q},then(resolve){resolve({data:selected,error:null})}};return q},auth:{admin:{async getUserById(userId){
  requested.push(userId);active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,2));active--;
  if(userId===id(1))throw new Error('Auth unavailable');
  return {data:{user:{user_metadata:{avatar_key:userId===id(2)?`avatars/${id(99)}/abc.jpg`:`avatars/${userId}/abc.jpg`}}},error:null};
}}}};
for(const [file,exports]of [['../src/config/supabaseClient',db],['../src/utils/signedUrl',{getSignedDownloadUrl:async key=>{signed.push(key);return 'https://private.example.test/'+key+'?signed=1'}}]]){const p=require.resolve(file);require.cache[p]={id:p,filename:p,loaded:true,exports};}
const controller=require('../src/modules/crew/crew.controller');
test('crew list includes private photos, bounds concurrency, isolates failures and respects event visibility',async()=>{
  selected=rows;let result;
  await controller.list({role:'SUPER_ADMIN'},{json:data=>{result=data}},e=>{throw e});
  assert.equal(result.length,15);assert.ok(result[0].avatarUrl.includes('/avatars/'+id(0)+'/'));
  assert.equal(result[1].avatarUrl,'');assert.equal(result[2].avatarUrl,'');assert.ok(maxActive<=6);assert.ok(maxActive>1);
  assert.ok(!signed.some(key=>key.includes(id(99))));
  requested=[];
  await controller.list({role:'EVENT_MANAGER'},{json:data=>{result=data}},e=>{throw e});
  assert.equal(result.length,14);assert.ok(!requested.includes(id(14)));assert.equal(result[0].base_salary,undefined);
  assert.ok(result[0].avatarUrl);assert.equal(result[0].user_id,undefined);
});
