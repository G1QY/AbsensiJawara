const test=require('node:test'),assert=require('node:assert/strict');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const NativeDate=Date;let now='2026-10-23T02:00:00Z';
global.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:[now]));}static now(){return NativeDate.parse(now);}};
let mode='ASSIGNED',log,uploads=0;
const schedule={schedule_date:'2026-10-23',start_time:'07:00',end_time:'12:00',break_start_time:'09:00',break_end_time:'10:00'};
const db={from(table){const filters=[];let mutation;const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},is(k,v){filters.push(r=>r[k]==v);return q},update(v){mutation=v;return q},maybeSingle:async()=>{
  if(table==='crew')return {data:{id:id(2),attendance_location_mode:mode}};
  if(table==='store_schedules')return {data:schedule};
  if(table==='store_assignments')return {data:{store:{latitude:-6.9,longitude:107.6,radius_meters:100}}};
  if(table==='attendance_logs'){
    if(mutation){if(!filters.every(f=>f(log)))return {data:null};log={...log,...mutation};}
    return {data:{...log}};
  }
  return {data:null};
}};return q}};
for(const [name,value]of [['../src/config/supabaseClient',db],['../src/utils/signedUrl',{buildAttendanceKey:()=>`attendance/${++uploads}.jpg`,uploadPrivateObject:async()=>{}}],['../src/utils/imageCompression',{compressAttendancePhoto:async b=>b}]]){const p=require.resolve(name);require.cache[p]={id:p,filename:p,loaded:true,exports:value};}
const {recordBreak}=require('../src/modules/attendance/attendanceBreaks.controller'),{checkOut}=require('../src/modules/attendance/attendance.controller');
async function call(action,{photo=true,body={latitude:-6.9,longitude:107.6},fn=recordBreak}={}){
  const res={code:200,status(n){this.code=n;return this},json(data){this.body=data;return this}};
  await fn({params:{id:id(3),action},user:{id:id(1)},body,file:photo?{buffer:Buffer.from('photo')}:null},res,e=>{res.code=e.status||500;res.body={message:e.message};});return res;
}
const reset=()=>{log={id:id(3),crew_id:id(2),check_in:'2026-10-23T00:00:00Z',check_out:null,break_started_at:null,break_ended_at:null,store_schedule_id:id(4),store_assignment_id:id(5)};mode='ASSIGNED';now='2026-10-23T02:00:00Z';};
test('break transitions require owner, photo, GPS, shift time; repeated requests cannot overwrite evidence',async()=>{
  reset();assert.equal((await call('end')).code,409);assert.equal((await call('start',{photo:false})).code,422);
  assert.equal((await call('start',{body:{latitude:'',longitude:107.6}})).code,422);
  assert.equal((await call('start',{body:{latitude:-7.8,longitude:110.3,attendanceLocationMode:'ANYWHERE'}})).code,422);
  log.crew_id=id(9);assert.equal((await call('start')).code,404);reset();now='2026-10-23T01:59:00Z';assert.equal((await call('start')).code,422);
  now='2026-10-23T02:00:00Z';const pair=await Promise.all([call('start'),call('start')]);assert.deepEqual(pair.map(r=>r.code).sort(),[200,409]);
  assert.equal(log.break_started_at,'2026-10-23T02:00:00.000Z');assert.equal(log.break_start_lat,-6.9);
  assert.equal((await call('out',{fn:checkOut})).code,409);
  now='2026-10-23T03:05:00Z';assert.equal((await call('end')).code,200);assert.equal(log.break_ended_at,'2026-10-23T03:05:00.000Z');
  assert.equal((await call('end')).code,409);
  reset();mode='ANYWHERE';assert.equal((await call('start',{body:{latitude:-7.8,longitude:110.3}})).code,200);assert.equal(log.break_start_lng,110.3);
  reset();log.check_out=now;assert.equal((await call('start')).code,409);
});
