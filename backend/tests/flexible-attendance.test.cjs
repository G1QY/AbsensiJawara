const test = require('node:test'), assert = require('node:assert/strict');
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Jakarta'}).format(new Date());
let mode='ASSIGNED', permission=null, noSchedule=false, log=null, failCrew=false;
const writes=[];
const db={from(table) {
  const filters={}; let mutation;
  const result=()=>{
    if(table==='crew') return {data:{id:id(2),attendance_location_mode:mode},error:failCrew?{message:'unavailable'}:null};
    let data=null;
    if(mutation) data={id:id(5),...mutation};
    else if(table==='store_assignments') data={crew_id:id(2),status:'ACTIVE',start_date:today,store:{status:'ACTIVE',latitude:-6.9,longitude:107.6,radius_meters:50}};
    else if(table==='event_assignments') data={crew_id:id(2),status:'ACTIVE',event:{status:'ONGOING',event_locations:[{latitude:-6.9,longitude:107.6,radius_meters:50}]}};
    else if(['store_schedules','event_schedules'].includes(table)) data=noSchedule?null:{schedule_date:today,start_time:'00:00',end_time:'23:59'};
    else if(table==='permissions') data=permission;
    else if(table==='attendance_logs' && filters.id) data=log;
    return {data,error:null};
  };
  const q={select(){return q},eq(k,v){filters[k]=v;return q},is(){return q},not(){return q},lte(){return q},gte(){return q},limit(){return q},
    insert(value){mutation=value;writes.push(value);return q},update(value){mutation=value;writes.push(value);return q},
    single:async()=>result(),maybeSingle:async()=>result(),then(resolve,reject){return Promise.resolve(result()).then(resolve,reject)}};
  return q;
}};
for (const [file,value] of [['../src/config/supabaseClient',db],['../src/utils/signedUrl',{buildAttendanceKey:()=> 'attendance/test.jpg',uploadPrivateObject:async()=>{}}],['../src/utils/imageCompression',{compressAttendancePhoto:async b=>b}]]) {
  const p=require.resolve(file); require.cache[p]={id:p,filename:p,loaded:true,exports:value};
}
const controller=require('../src/modules/attendance/attendance.controller');
async function call(action,body={},file=true) {
  const response={statusCode:200,status(code){this.statusCode=code;return this},json(data){this.body=data;return this}};
  await controller[action]({user:{id:id(1)},role:'OFFICE_STAFF',params:{id:id(5)},body,file:file?{buffer:Buffer.from('photo')}:null},response,e=>{response.statusCode=e.status||500;response.body={message:e.message}});
  return response;
}
const input={crewId:id(2),storeAssignmentId:id(3),storeScheduleId:id(4),latitude:-7.7956,longitude:110.3695};
test('remote check-in/out records GPS and distance; trusted policy alone controls the radius exception',async()=>{
  let res=await call('checkIn',{...input,attendanceLocationMode:'ANYWHERE'});
  assert.equal(res.statusCode,422); assert.equal(writes.length,0);
  mode='ANYWHERE'; res=await call('checkIn',input);
  assert.equal(res.statusCode,201,JSON.stringify(res.body)); assert.equal(res.body.check_in_location_mode,'ANYWHERE');
  assert.equal(res.body.check_in_lat,input.latitude); assert.equal(res.body.check_in_lng,input.longitude);
  assert.ok(res.body.check_in_distance_m>100000); assert.equal(res.body.review_status,'PENDING');
  for(const value of [null,'',undefined,' ',false,[],{},'NaN',200]) {
    res=await call('checkIn',{...input,latitude:value}); assert.equal(res.statusCode,422,String(value));
  }
  assert.equal((await call('checkIn',input,false)).statusCode,422);
  assert.equal((await call('checkIn',{...input,crewId:id(999)})).statusCode,403);
  permission={type:'DAY_OFF'}; assert.equal((await call('checkIn',input)).statusCode,409); permission=null;
  noSchedule=true; assert.equal((await call('checkIn',input)).statusCode,422); noSchedule=false;
  failCrew=true; assert.equal((await call('checkIn',input)).statusCode,503); failCrew=false;
  const event={...input,storeAssignmentId:null,storeScheduleId:null,eventAssignmentId:id(3),eventScheduleId:id(4)};
  assert.equal((await call('checkIn',event)).statusCode,201);
  mode='ASSIGNED'; assert.equal((await call('checkIn',event)).statusCode,422);
  assert.equal((await call('checkIn',{...input,latitude:-6.9,longitude:107.6})).statusCode,201);
  log={crew_id:id(2),check_in:new Date().toISOString(),check_out:null,store_assignment_id:id(3),store_schedule_id:id(4)};
  assert.equal((await call('checkOut',input)).statusCode,422);
  mode='ANYWHERE'; res=await call('checkOut',input);
  assert.equal(res.statusCode,200); assert.equal(res.body.check_out_location_mode,'ANYWHERE');
  assert.equal(res.body.check_out_lng,input.longitude); assert.ok(res.body.check_out_distance_m>100000);
  assert.equal((await call('checkOut',{...input,longitude:null})).statusCode,422);
  assert.equal((await call('checkOut',input,false)).statusCode,422);
  log.crew_id=id(999); assert.equal((await call('checkOut',input)).statusCode,403);
});
