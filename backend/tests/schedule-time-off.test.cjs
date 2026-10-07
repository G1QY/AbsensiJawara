const test=require('node:test'),assert=require('node:assert/strict');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date());
let permissions=[],schedules=[],attendance=[],holidays=[];
const db={from(table){const filters=[];const q={select(){return q},eq(k,v){filters.push(row=>k.includes('.')||row[k]===v);return q},gte(k,v){filters.push(r=>r[k]>=v);return q},lte(k,v){filters.push(r=>r[k]<=v);return q},lt(k,v){filters.push(r=>r[k]<v);return q},in(){return q},not(){return q},is(){return q},order(){return q},limit(){return q},
  async maybeSingle(){const r=await q;return {data:table==='crew'?{id:id(1),crew_type:'CREW_STORE',status:'ACTIVE'}:r.data[0]||null,error:null}},
  then(resolve,reject){const rows=table==='store_schedules'?schedules:table==='permissions'?permissions:table==='attendance_logs'?attendance:table==='national_holidays'?holidays:[];return Promise.resolve({data:rows.filter(r=>filters.every(f=>f(r))),error:null}).then(resolve,reject)}};return q}};
for(const [name,value] of [['../src/config/supabaseClient',db],['../src/services/nationalHolidaySync',{ensureHolidayYears:async()=>[{row_count:1}]}],['../src/utils/signedUrl',{}],['../src/utils/imageCompression',{}]]){const p=require.resolve(name);require.cache[p]={id:p,filename:p,loaded:true,exports:value}}
const controller=require('../src/modules/attendance/attendance.controller');
const call=async(fn,req)=>{let result;await fn(req,{json(data){result=data;return this},status(code){this.code=code;return this}},e=>{throw e});return result;};
const schedule=(date)=>({id:id(3),schedule_date:date,start_time:'09:00',end_time:'18:00',shift_number:1,store_assignment:{id:id(4),crew_id:id(1),status:'ACTIVE',start_date:'2020-01-01',store:{name:'Kantor Uji',status:'ACTIVE'}}});
test('national holiday keeps its assigned shift; day off and permission overlay schedules and unscheduled dates',async()=>{
  schedules=[schedule('2099-08-17'),{...schedule('2099-08-18'),id:id(5)}];
  holidays=[{holiday_date:'2099-08-17',name:'Kemerdekaan',kind:'NATIONAL_HOLIDAY'}];
  permissions=[{crew_id:id(1),type:'DAY_OFF',start_date:'2099-08-18',end_date:'2099-08-18',status:'APPROVED',reason:'Libur mingguan',admin_managed:true},{crew_id:id(1),type:'PERMIT',start_date:'2099-08-31',end_date:'2099-08-31',status:'APPROVED',reason:'Izin keluarga',admin_managed:true}];
  const result=await call(controller.calendar,{query:{month:'2099-08',crewId:id(1)},role:'SUPER_ADMIN',user:{id:id(2)}});
  assert.equal(result.days.find(d=>d.date==='2099-08-17').status,'PENDING');
  assert.equal(result.days.find(d=>d.date==='2099-08-17').holidayName,'Kemerdekaan');
  assert.equal(result.days.find(d=>d.date==='2099-08-18').status,'DAY_OFF');
  assert.equal(result.days.find(d=>d.date==='2099-08-18').scheduleId,id(5));
  assert.equal(result.days.find(d=>d.date==='2099-08-31').status,'PERMISSION');
  assert.equal(result.days.find(d=>d.date==='2099-08-31').type,'TIME_OFF');
});
test('today hides the clock-in action on approved leave but holidays still allow work',async()=>{
  const date=today();schedules=[schedule(date)];attendance=[];holidays=[{holiday_date:date}];
  permissions=[{crew_id:id(1),type:'DAY_OFF',start_date:date,end_date:date,status:'APPROVED',reason:'Libur mingguan'}];
  const req={user:{id:id(2)},query:{}};
  let result=await call(controller.today,req);assert.equal(result.hasSchedule,false);assert.equal(result.timeOff.type,'DAY_OFF');
  permissions=[];result=await call(controller.today,req);assert.equal(result.hasSchedule,true);assert.equal(result.context.storeScheduleId,id(3));
});
