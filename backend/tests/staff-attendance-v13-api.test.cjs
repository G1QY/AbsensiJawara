const test=require('node:test'),assert=require('node:assert/strict');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date());
const inserts=[],reads=[],calls=[];
const db={rpc:async(name,args)=>{calls.push({name,args});return {data:{role:args.p_role},error:null}},from(table){
  const filters={};let row;
  const data=()=>{
    reads.push({table,filters});
    if(row)return row;
    if(table==='crew')return {id:id(2),crew_type:'CREW_STORE',status:'ACTIVE'};
    if(table==='store_assignments')return {id:id(3),crew_id:id(2),status:'ACTIVE',start_date:today,end_date:null,store:{status:'ACTIVE',latitude:0,longitude:0,radius_meters:50}};
    if(table==='store_schedules')return {id:id(4),schedule_date:today,start_time:'00:00',end_time:'23:59',late_tolerance_minutes:0};
    if(table==='attendance_logs'&&filters.id)return {id:filters.id,crew_id:id(999),check_in:new Date().toISOString(),check_out:null};
    return null;
  };
  const q={select(){return q},eq(k,v){filters[k]=v;return q},not(){return q},is(){return q},gte(){return q},lte(){return q},lt(){return q},or(){return q},order(){return q},limit(){return q},
    insert(value){row={id:id(5),...value};inserts.push(value);return q},async single(){return {data:data(),error:null}},async maybeSingle(){return {data:data(),error:null}},
    then(resolve,reject){reads.push({table,filters});return Promise.resolve({data:[],error:null}).then(resolve,reject)}};
  return q;
}};
for(const [file,value] of [['../src/config/supabaseClient',db],['../src/utils/signedUrl',{buildAttendanceKey:()=> 'attendance/test.jpg',uploadPrivateObject:async()=>{}}],['../src/utils/imageCompression',{compressAttendancePhoto:async b=>b}]]){const p=require.resolve(file);require.cache[p]={id:p,filename:p,loaded:true,exports:value};}
test('every employee role attends only as self; Super Admin cannot attend; staff boundaries and divisions are enforced',async()=>{
  const express=require('express'),app=express();app.use(express.json());
  app.use((req,res,next)=>{req.user={id:id(1)};req.role=req.get('x-role');next()});
  app.use(require('../src/security/headStore').headStoreBoundary);
  app.use('/attendance',require('../src/modules/attendance/attendance.routes'));
  app.use('/accounts',require('../src/modules/accounts/accounts.routes'));
  app.use('/crew-store/workspace',require('../src/modules/stores/crewStoreWorkspace.routes'));
  app.get('/crew',(req,res)=>res.json([]));
  app.use((e,req,res,next)=>res.status(e.status||500).json({message:e.message}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
  const request=(path,role,method='GET',body)=>fetch(base+path,{method,headers:{'x-role':role,...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
  const form=(crew=id(2))=>{const f=new FormData();for(const [k,v]of Object.entries({crewId:crew,storeAssignmentId:id(3),storeScheduleId:id(4),latitude:0,longitude:0,review_status:'APPROVED'}))f.append(k,String(v));f.append('photo',new Blob(['fixture'],{type:'image/jpeg'}),'photo.jpg');return f};
  try {
    for(const role of ['CREW_STORE','CREW_EVENT','HEAD_STORE','ADMIN_STORE','EVENT_MANAGER','HEAD_OFFICE','OFFICE_STAFF','PRODUCTION_STAFF']) {
      let res=await request('/attendance/check-in',role,'POST',form());assert.equal(res.status,201,role+': '+await res.clone().text());assert.equal((await res.json()).review_status,'PENDING');
      res=await request('/attendance/check-in',role,'POST',form(id(999)));assert.equal(res.status,403,role);
      assert.equal((await request('/attendance/'+id(9)+'/check-out',role,'POST',{latitude:0,longitude:0})).status,403,role);
      assert.equal((await request('/attendance',role)).status,200,role);
      assert.equal(reads.filter(q=>q.table==='attendance_logs').at(-1).filters.crew_id,id(2),role);
      assert.equal((await request('/attendance?crewId='+id(999),role)).status,403,role);
      assert.equal((await request('/attendance/'+id(9),role)).status,403,role);
      if(role!=='CREW_EVENT')assert.equal((await request('/crew-store/workspace',role)).status,200,role);
    }
    assert.equal((await request('/attendance/check-in','SUPER_ADMIN','POST',form())).status,403);
    assert.equal((await request('/attendance/'+id(9)+'/check-out','SUPER_ADMIN','POST',{latitude:0,longitude:0})).status,403);
    for(const role of ['HEAD_OFFICE','OFFICE_STAFF','PRODUCTION_STAFF']) for(const path of ['/crew','/admin-attendance','/accounts','/dashboard/revenue','/head-store'])assert.equal((await request(path,role)).status,403,role+path);
    const path='/accounts/'+id(2)+'/role';
    assert.equal((await request(path,'EVENT_MANAGER','PATCH',{role:'HEAD_OFFICE',division:'Finance'})).status,403);
    for(const [role,division] of [['HEAD_OFFICE','Operational'],['OFFICE_STAFF','Finance'],['PRODUCTION_STAFF','Packing']]){
      assert.equal((await request(path,'SUPER_ADMIN','PATCH',{role,division})).status,200);
      assert.equal(calls.at(-1).args.p_division,division);
    }
    assert.equal((await request(path,'SUPER_ADMIN','PATCH',{role:'PRODUCTION_STAFF',division:'Finance'})).status,422);
    assert.equal((await request(path,'SUPER_ADMIN','PATCH',{role:'HEAD_OFFICE'})).status,422);
  } finally {await new Promise(r=>server.close(r))}
});
