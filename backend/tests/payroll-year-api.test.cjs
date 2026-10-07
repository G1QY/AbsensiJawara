const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto')
const {calendar}=require('../src/modules/payroll/payroll.calendar')
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const rules={},slips=[],calls=[]
const revision=()=>crypto.createHash('md5').update(JSON.stringify({rules,slips})).digest('hex')
const rule={monthly_basis:'MONTHLY',late_rate:12000,late_rounding:'MINUTE',overtime_rate:10000,absence_mode:'NONE',absence_rate:0,event_basis:'PER_ATTENDANCE',cutoff_day:25,payment_day:30,payment_month_offset:0}
const person={id:id(2),user_id:id(3),full_name:'Uji',status:'ACTIVE',crew_type:'CREW_STORE',base_salary:2000000,join_date:'2019-01-01'}
function source(month,override,from) {
  const [year,number]=month.split('-').map(Number),prev=new Date(Date.UTC(year,number-2,1)).toISOString().slice(0,7)
  const policyFor=m=>override&&m>=from&&m.slice(0,4)===from.slice(0,4)?override:rules[m]
  return {people:[person],policy:policyFor(month)||null,calendar:calendar(month,policyFor(month),policyFor(prev)),slips:slips.filter(s=>s.period===month)}
}
const db={async rpc(name,a){calls.push({name,a})
  if(name==='payroll_workspace')return {data:{revision:revision(),source:source(a.p_period.slice(0,7))}}
  if(name==='payroll_year_workspace')return {data:{revision:revision(),months:Array.from({length:14-a.p_from_month},(_,i)=>{const month=new Date(Date.UTC(a.p_year,a.p_from_month-1+i,1)).toISOString().slice(0,7);return {month,source:source(month),previewSource:source(month,a.p_policy,`${a.p_year}-${String(a.p_from_month).padStart(2,'0')}`)}})}}
  if(name==='set_payroll_year_policy'){
    if(a.p_revision!==revision())return {error:{code:'40001'}}
    for(let m=a.p_from_month;m<=12;m++)rules[`${a.p_year}-${String(m).padStart(2,'0')}`]={...a.p_policy,annual_year:a.p_year}
    return {data:13-a.p_from_month}
  }
  return {data:id(10)}
}}
const client=require.resolve('../src/config/supabaseClient');require.cache[client]={id:client,filename:client,loaded:true,exports:db}
test('annual API validates scope, protects roles, previews without writes, and saves a revision-checked set of remaining months',async()=>{
  const app=require('express')();app.use(require('express').json());app.use((req,res,next)=>{req.user={id:id(1)};req.role=req.get('x-role')||'SUPER_ADMIN';next()});app.use('/payroll',require('../src/modules/payroll/payroll.routes'));app.use((e,req,res,next)=>res.status(e.status||500).json({message:e.message}))
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const root='http://127.0.0.1:'+server.address().port
  const post=(path,body={},role='SUPER_ADMIN')=>fetch(root+'/payroll/'+path,{method:'POST',headers:{'content-type':'application/json','x-role':role},body:JSON.stringify({year:2020,fromMonth:10,policy:rule,...body})})
  try{
    for(const role of ['CREW_STORE','HEAD_STORE','EVENT_MANAGER']){
      assert.equal((await post('year-preview',{},role)).status,403)
      assert.equal((await post('year-policy',{revision:revision()},role)).status,403)
    }
    for(const body of [{year:1999},{year:'2020'},{fromMonth:0},{fromMonth:13},{policy:{...rule,cutoff_day:32}},{policy:{...rule,payment_day:1.5}},{policy:{...rule,payment_month_offset:2}},{policy:{...rule,late_rate:-1}}])assert.equal((await post('year-preview',body)).status,422)
    let response=await post('year-preview');assert.equal(response.status,200);const preview=await response.json()
    assert.equal(Object.keys(rules).length,0);assert.equal(preview.months.length,4);assert.equal(preview.months[0].afterCalendar.startDate,'2020-10-01');assert.equal(preview.months[1].afterCalendar.startDate,'2020-10-26');assert.equal(preview.months[3].affected,false);assert.equal(preview.datesChanged,true);assert.deepEqual(preview.issues,[])
    response=await post('year-preview',{policy:{...rule,cutoff_day:31}});assert.ok((await response.json()).issues.length>0)
    assert.equal((await post('year-policy',{revision:'invalid'})).status,409)
    response=await post('year-policy',{revision:preview.revision});assert.equal(response.status,200);assert.equal((await response.json()).updated,3)
    assert.deepEqual(Object.keys(rules),['2020-10','2020-11','2020-12']);assert.equal(calls.at(-1).a.p_actor,id(1))
    assert.equal((await post('year-policy',{revision:preview.revision})).status,409)
    response=await fetch(root+'/payroll?month=2020-11');const november=await response.json();assert.equal(november.policy.annual_year,2020);assert.equal(november.rows[0].periodStart,'2020-10-26');assert.equal(november.rows[0].blockedReason,null)
    assert.equal((await post('policy',{month:'2020-11',revision:november.revision})).status,409)
    slips.push({period:'2020-11',scope_key:'MONTHLY',status:'FINAL',snapshot:{...november.rows[0]}})
    response=await post('year-preview',{policy:{...rule,cutoff_day:24}});assert.ok((await response.json()).issues.some(issue=>issue.includes('2020-11')&&issue.includes('terkunci')))
  }finally{await new Promise(r=>server.close(r))}
})
