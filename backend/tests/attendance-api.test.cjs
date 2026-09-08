const test=require('node:test'),assert=require('node:assert/strict');
const id='00000000-0000-4000-8000-000000000001';
const photos=[],inserts=[],decisions=[];let saved=[];
const db={rpc:async(name,args)=>{decisions.push({name,args});return {error:null};},from(table){let inserted=null;let filter=null;
  const q={select(){return q;},eq(k,v){filter={k,v};return q;},in(){return q;},order(){return q;},range(){return q;},insert(row){inserted=row;return q;},
    async single(){if(inserted){inserts.push(inserted);saved.push(inserted);return {data:inserted,error:null};}return q.maybeSingle();},
    async maybeSingle(){if(table==='events')return {data:{id,event_name:'Fixture Event',status:'ONGOING'},error:null};if(table==='guest_attendances')return {data:saved.find(s=>s[filter.k]===filter.v)||null,error:null};return {data:{id,check_in:'2026-08-31T02:00:00Z',check_out:null,check_in_photo_url:'attendance/2026/08/in.jpg',check_out_photo_url:'attendance/2026/08/WRONG.jpg',check_in_note:'Catatan masuk'},error:null};},
    then(resolve,reject){return Promise.resolve({data:table==='guest_attendances'?saved:[],error:null}).then(resolve,reject);}};return q;}};
for(const [file,value] of [['../src/config/supabaseClient',db],['../src/config/s3Client',{s3:{send:async()=>({})},BUCKET_NAME:'test-bucket'}],['../src/utils/signedUrl',{uploadPrivateObject:async key=>photos.push(key),getSignedDownloadUrl:async key=>'https://example.test/'+key}]]){const p=require.resolve(file);require.cache[p]={id:p,filename:p,loaded:true,exports:value};}
const express=require('express');
test('guest submission and private admin review routes',async()=>{
  const app=express();app.use(express.json());app.use('/guest-attendance',require('../src/modules/attendance/guestAttendance.routes').router);
  app.use((req,res,next)=>{req.role=req.headers['x-test-role']||'CREW_EVENT';req.user={id};next();});app.use('/admin-attendance',require('../src/modules/attendance/adminAttendance.routes'));app.use((e,req,res,next)=>res.status(e.status||500).json({message:e.message}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url='http://127.0.0.1:'+server.address().port;
  const png=await require('sharp')({create:{width:2,height:2,channels:3,background:'#1654df'}}).png().toBuffer();
  const form=(legacy=false,photo=true)=>{const f=new FormData();for(const [k,v]of Object.entries({fullName:'Guest API',phone:'081234567890',crewType:'CREW_EVENT',locationId:id,locationName:'Fixture Event',position:'Fotografer',clockType:'OUT',note:'Catatan pulang asli',latitude:'0',longitude:'0',accuracy:'10',address:'Alamat uji',locationSource:'gps',submissionKey:id,legacyId:'GST-P5D35',occurredAt:'2026-08-30T16:00:00+07:00',review_status:'APPROVED'}))f.append(k,v);if(photo)f.append('photo',new Blob([png],{type:'image/png'}),'photo.png');return f;};
  try{
    assert.equal((await fetch(url+'/guest-attendance/'+id)).status,404);
    assert.equal((await fetch(url+'/admin-attendance')).status,403);
    assert.equal((await fetch(url+'/guest-attendance',{method:'POST',body:form(false,false)})).status,422);
    const res=await fetch(url+'/guest-attendance',{method:'POST',body:form()});assert.equal(res.status,201,await res.clone().text());const g=await res.json();assert.match(g.id,/^[0-9a-f-]{36}$/);assert.equal(inserts[0].clock_type,'OUT');assert.equal(inserts[0].note,'Catatan pulang asli');assert.equal(inserts[0].time_source,'SERVER');assert.equal(inserts[0].review_status,undefined);assert.notEqual(inserts[0].occurred_at,'2026-08-30T16:00:00+07:00');
    assert.equal((await fetch(url+'/guest-attendance',{method:'POST',body:form()})).status,200);assert.equal(inserts.length,1);assert.equal(photos.length,1);
    const admin={'x-test-role':'SUPER_ADMIN'};
    const detail=await(await fetch(url+'/admin-attendance/registered/'+id,{headers:admin})).json();assert.ok(detail.inPhoto.endsWith('in.jpg'));assert.equal(detail.outPhoto,'');assert.equal(detail.check_out_photo_url,undefined);assert.equal(detail.check_in_note,'Catatan masuk');
    const bad=await fetch(url+'/admin-attendance/guest/GST-P5D35/review',{method:'PATCH',headers:{...admin,'Content-Type':'application/json'},body:JSON.stringify({target:'attendance',decision:'APPROVED'})});assert.equal(bad.status,422);
    const imported=await fetch(url+'/admin-attendance/import-guest',{method:'POST',headers:admin,body:form(true)});assert.equal(imported.status,201,await imported.clone().text());assert.equal(inserts[1].legacy_id,'GST-P5D35');assert.equal(inserts[1].time_source,'LEGACY_DEVICE');
    const decided=await fetch(url+'/admin-attendance/guest/'+g.id+'/review',{method:'PATCH',headers:{...admin,'Content-Type':'application/json'},body:JSON.stringify({target:'attendance',decision:'REJECTED',note:'Bukti tidak lengkap'})});assert.equal(decided.status,200);assert.equal(decisions[0].args.p_decision,'REJECTED');assert.equal(decisions[0].args.p_actor,id);
  }finally{await new Promise(r=>server.close(r));}
});
