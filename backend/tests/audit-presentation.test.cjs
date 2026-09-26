const test=require('node:test'), assert=require('node:assert/strict');
const {describe}=require('../src/modules/auditLogs/auditPresentation');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function database(data,calls=[]) {return {from(table){return {select(columns){return {async in(key,ids){calls.push({table,columns,key,ids});return {data:(data[table]||[]).filter(r=>ids.includes(r.id)),error:null};}};}};}};}
test('employee names take precedence over legacy EMP codes, actor remains the recorded account',async()=>{
 const rows=[{id:id(1),entity_type:'crew',entity_id:id(2),new_data:{employee_code:'EMP-legacy'},actor_user_id:id(4),actor:{full_name:'JAWARA',email:'admin@example.test'}}];
 const result=await describe(database({crew:[{id:id(2),employee_code:'EMP-legacy',user:{full_name:'Aila'}}]}),rows);
 assert.equal(result[0].entity_name,'Aila');assert.equal(result[0].actor_name,'JAWARA');assert.equal(result[0].actor.email,'admin@example.test');assert.deepEqual(result[0].new_data,rows[0].new_data);
});
test('payroll adjustment resolves nested crewId, deleted paid/reopened slips use historical person snapshots, policy has a target',async()=>{
 const rows=[{action:'PAYROLL_ADJUSTMENT',entity_type:'payroll',entity_id:null,new_data:{period:'2026-09-01',data:{crewId:id(2)}}},{action:'PAYROLL_REOPEN',entity_type:'payroll',old_data:{crew_id:null,snapshot:{person:{full_name:'Karyawan lama'}}},new_data:{period:'2026-09-01'}},{action:'PAYROLL_POLICY',entity_type:'payroll',new_data:{period:'2026-09-01'}}];
 const r=await describe(database({crew:[{id:id(2),user:{full_name:'Selsa'}}]}),rows);
 assert.deepEqual(r.map(x=>x.entity_name),['Selsa','Karyawan lama','Aturan payroll']);
});
test('range summaries do not attribute many employees to the first schedule, missing historical names remain honest',async()=>{
 const calls=[];const rows=[{action:'STORE_SCHEDULE_RANGE_CREATED',entity_type:'store_schedules',entity_id:id(3),new_data:{crewCount:5}},{entity_type:'crew',entity_id:id(7),old_data:{employee_code:'EMP-deleted'}},{entity_type:'private_table',entity_id:id(8)}];
 const r=await describe(database({store_schedules:[{id:id(3),assignment:{crew:{user:{full_name:'First person'}}}}]},calls),rows);
 assert.equal(r[0].entity_name,'Jadwal 5 karyawan');assert.equal(r[1].entity_name,'EMP-deleted');assert.equal(r[2].entity_name,'Nama data tidak tersedia');assert.equal(calls.some(c=>c.table==='private_table'),false);
});
test('failed target lookups report an error instead of pretending the name is absent',async()=>{
 const db={from(){return {select(){return {async in(){return {data:null,error:{message:'offline'}};}};}};}};
 await assert.rejects(describe(db,[{entity_type:'crew',entity_id:id(2)}]),{status:500});
});
