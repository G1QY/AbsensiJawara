const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../../supabase/migrations');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('V13 role divisions, personal access, mandatory review and new evidence',{skip:!process.env.PGLITE_MODULE},async()=>{
 const {PGlite}=require(process.env.PGLITE_MODULE),db=new PGlite();
 const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
 try{
  await db.exec(`create schema auth;create schema storage;create role anon;create role authenticated;create role service_role bypassrls;
   create table auth.users(id uuid primary key,email text unique,raw_user_meta_data jsonb default '{}',encrypted_password text,updated_at timestamptz);
   create table storage.objects(id uuid default gen_random_uuid(),owner_id text);
   create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema public,auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;`);
  for(const file of ['foundation.sql','workforce.sql','attendance.sql','equipment.sql','audit_rls.sql','attendance_calendar_fields.sql','admin_branches_crew.sql','crew_company_job.sql','attendance_review_guest.sql'])
   await db.exec(fs.readFileSync(path.join(dir,file),'utf8').replace('create extension if not exists "pgcrypto";',''));
  await db.exec(`alter table branches add city_name text not null default '';alter table stores add deleted_at timestamptz,add location_kind text default 'STORE';
   alter table events add pic_crew_id uuid references crew(id);
   create table event_workflows(event_id uuid primary key references events(id),updated_by uuid references users(id));
   create table password_reset_otps(email text,used boolean);
   grant select,insert,update,delete on all tables in schema public to authenticated;
   insert into roles(code,name) values('SUPER_ADMIN','Super Admin'),('ADMIN_STORE','Admin Store'),('EVENT_MANAGER','Event Manager'),('CREW_STORE','Crew Store'),('CREW_EVENT','Crew Event');
   insert into auth.users(id,email) values('${id(1)}','super@test.invalid'),('${id(2)}','head@test.invalid'),('${id(3)}','crew@test.invalid'),('${id(4)}','outside@test.invalid');
   insert into user_roles(user_id,role_id) select '${id(1)}',id from roles where code='SUPER_ADMIN';
   insert into user_roles(user_id,role_id) select '${id(2)}',id from roles where code='ADMIN_STORE';
   insert into user_roles(user_id,role_id) select '${id(3)}',id from roles where code='CREW_STORE';
   insert into user_roles(user_id,role_id) select '${id(4)}',id from roles where code='CREW_STORE';
   update branches set city_name=case when code='BDG' then 'Bandung' else name end;
   insert into branches(id,code,name,city_name) values('${id(10)}','BDG2','Kosambi',' Bandung ');
   insert into crew(id,user_id,employee_code,crew_type,join_date,branch_id) values
    ('${id(20)}','${id(2)}','HEAD','CREW_STORE',current_date,(select id from branches where code='BDG')),
    ('${id(21)}','${id(3)}','CREW','CREW_STORE',current_date,'${id(10)}'),
    ('${id(22)}','${id(4)}','OUTSIDE','CREW_STORE',current_date,(select id from branches where code='JKT'));
   insert into stores(id,code,name,branch_id,latitude,longitude) values
    ('${id(30)}','S1','Bandung One',(select id from branches where code='BDG'),0,0),
    ('${id(31)}','S2','Bandung Two','${id(10)}',0,0),
    ('${id(32)}','S3','Jakarta Store',(select id from branches where code='JKT'),0,0);
   insert into store_assignments(id,crew_id,store_id,start_date) values('${id(40)}','${id(21)}','${id(31)}',current_date),('${id(41)}','${id(22)}','${id(32)}',current_date);
   insert into store_schedules(id,store_assignment_id,schedule_date,start_time,end_time) values('${id(50)}','${id(40)}',current_date,'09:00','17:00'),('${id(51)}','${id(41)}',current_date,'09:00','17:00');
   insert into attendance_logs(id,crew_id,store_assignment_id,store_schedule_id,attendance_date,check_in,status) values('${id(60)}','${id(21)}','${id(40)}','${id(50)}',current_date,now(),'PRESENT'),('${id(61)}','${id(22)}','${id(41)}','${id(51)}',current_date,now(),'LATE');
  `);

  for(const file of ['20260918102008_head_store_accounts_attendance.sql','20260924073548_crew_password_vault_profile_roles.sql']) await db.exec(fs.readFileSync(path.join(dir,file),'utf8'));
  await db.exec(fs.readFileSync(path.join(dir,'20260901021500_crew_overtime_approval_notifications.sql'),'utf8'));
  await db.exec(fs.readFileSync(path.join(dir,'20260925033622_staff_roles_attendance_review_dashboard.sql'),'utf8'));

  await db.exec(fs.readFileSync(path.join(dir,'20260925113935_work_shift_schedules.sql'),'utf8'));
  // A shift can span midnight; adjacent overlap is rejected, while a touching boundary is valid.
  const schedule=async(n,date,start,end,shift)=>db.query('insert into store_schedules(id,store_assignment_id,schedule_date,start_time,end_time,shift_number) values($1,$2,$3,$4,$5,$6)',[id(n),id(40),date,start,end,shift]);
  await schedule(80,'2027-01-10','22:00','06:00',3);
  await assert.rejects(schedule(81,'2027-01-11','05:59','14:00',1),/bertumpuk/);
  await schedule(81,'2027-01-11','06:00','14:00',1);
  await assert.rejects(schedule(82,'2027-01-12','08:00','08:00',2),/tidak boleh sama/);
  await assert.rejects(schedule(82,'2027-01-12','08:00','16:00',4),/shift_number_check/);
  assert.equal((await one('select shift_number from store_schedules where id=$1',[id(80)])).shift_number,3);
  const setRole=(role,division='',user=id(3))=>db.query('select set_account_role($1,$2,$3,null,$4)',[id(1),user,role,division]);
  for(const role of ['HEAD_OFFICE','OFFICE_STAFF','PRODUCTION_STAFF']) {
    const division=role==='PRODUCTION_STAFF'?'Packing':'Operational';
    await setRole(role,division);
    const c=await one('select crew_type,division from crew where id=$1',[id(21)]);
    assert.equal(c.crew_type,'CREW_STORE'); assert.equal(c.division,division);
    assert.equal((await one('select is_admin($1) as allowed',[id(3)])).allowed,false);
    await db.exec(`set request.jwt.claim.sub='${id(3)}';set role authenticated;`);
    assert.equal((await one('select count(*)::int n from crew')).n,0);
    await assert.rejects(db.query('select set_account_role($1,$2,$3,null,$4)',[id(1),id(4),'SUPER_ADMIN','']),/permission denied/);
    await db.exec("reset role;set request.jwt.claim.sub='';");
  }
  for(const [role,division] of [['HEAD_OFFICE','Packing'],['PRODUCTION_STAFF','Finance'],['OFFICE_STAFF',''],['OFFICE_STAFF','SUPER_ADMIN']]) await assert.rejects(setRole(role,division),/divisi/);
  await setRole('CREW_STORE');
  assert.equal((await one('select division from crew where id=$1',[id(21)])).division,'');
  await db.exec(`insert into auth.users(id,email) values('${id(5)}','manager-no-profile@test.invalid');`);
  await setRole('EVENT_MANAGER','',id(5));
  assert.equal((await one('select crew_type from crew where user_id=$1',[id(5)])).crew_type,'CREW_STORE');
  await assert.rejects(db.query('select set_account_role($1,$2,$3,null,$4)',[id(3),id(4),'HEAD_OFFICE','Finance']),/Super Admin/);
  // A manager may submit their own attendance, but cannot approve it.
  await setRole('EVENT_MANAGER');
  assert.equal((await one('select review_status from attendance_logs where id=$1',[id(60)])).review_status,'PENDING');
  const review=(actor,target='attendance',decision='APPROVED',note='')=>db.query('select review_attendance($1,$2,$3,$4,$5,$6)',[actor,'registered',id(60),target,decision,note]);
  await assert.rejects(review(id(3)),/sendiri/);
  await review(id(1));
  assert.equal((await one('select review_status from attendance_logs where id=$1',[id(60)])).review_status,'APPROVED');
  assert.equal((await one("select count(*)::int n from notifications where user_id=$1 and type='ATTENDANCE_REVIEW'",[id(3)])).n,1);
  // New clock-out evidence invalidates the earlier clock-in decision.
  await db.query("update attendance_logs set check_out=now(),check_out_note='Shift complete',overtime_minutes=60,overtime_status='PENDING' where id=$1",[id(60)]);
  const pending=await one('select review_status,reviewed_by,reviewed_at,review_note from attendance_logs where id=$1',[id(60)]);
  assert.deepEqual(pending,{review_status:'PENDING',reviewed_by:null,reviewed_at:null,review_note:''});
  await assert.rejects(review(id(1),'overtime'),/persetujuan absensi/);
  await review(id(1));await review(id(1),'overtime');
  assert.equal((await one('select review_status,overtime_status from attendance_logs where id=$1',[id(60)])).review_status,'APPROVED');
  // Direct Data API writes cannot forge approval even on a self-owned row.
  for(const role of ['authenticated','anon']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query("update attendance_logs set review_status='APPROVED' where id=$1",[id(61)]),/permission denied/);
    await assert.rejects(review(id(1)),/permission denied/);
    await db.exec('reset role');
  }
  await db.query("insert into attendance_logs(id,crew_id,store_assignment_id,attendance_date,status,check_in,review_status) values($1,$2,'00000000-0000-4000-8000-000000000041',current_date+1,'PRESENT',now(),'APPROVED')",[id(62),id(22)]);
  assert.equal((await one('select review_status from attendance_logs where id=$1',[id(62)])).review_status,'PENDING');
  assert.ok((await one("select count(*)::int n from audit_logs where action='ATTENDANCE_APPROVED'")).n>=2);
  // Real PostgreSQL payroll persistence, source isolation, conflict handling and immutable paid slips.
  await db.exec(fs.readFileSync(path.join(dir,'20260925222422_persisted_payroll.sql'),'utf8'));
  await db.exec(fs.readFileSync(path.join(dir,'20261005160149_payroll_schedule_time_off.sql'),'utf8'));
  await db.exec(fs.readFileSync(path.join(dir,'20261006100934_payroll_annual_calendar.sql'),'utf8'));
  const month=(await one("select to_char(current_date,'YYYY-MM-01') d")).d;
  const workspace=async(user=null)=>(await one('select payroll_workspace($1,$2) d',[month,user])).d;
  const mutate=async(action,data,revision,actor=id(1))=>one('select mutate_payroll($1,$2,$3,$4,$5) id',[actor,action,month,revision||(await workspace()).revision,data]);
  const policy={monthly_basis:'MONTHLY',late_rate:10000,late_rounding:'MINUTE',overtime_rate:20000,absence_mode:'SCHEDULED',absence_rate:0,event_basis:'PER_ATTENDANCE'};
  const before=await workspace();assert.equal(before.source.policy,null);
  await mutate('POLICY',policy,before.revision);
  assert.equal((await workspace()).source.policy.late_rate,10000);
  await assert.rejects(mutate('POLICY',policy,before.revision),/berubah/);
  await assert.rejects(mutate('POLICY',policy,null,id(3)),/Super Admin/);
  await assert.rejects(mutate('POLICY',{...policy,late_rate:-1}),/check constraint/);
  const adjustment={crewId:id(21),scopeKey:'MONTHLY',rate_override:null,allowance:50000,deduction:10000,note:'Transport dan kasbon'};
  await mutate('ADJUSTMENT',adjustment);
  assert.equal((await workspace()).source.adjustments.length,1);
  const personal=await workspace(id(3));assert.equal(personal.source.people.length,1);assert.ok(personal.source.attendance.every(a=>a.crew_id===id(21)));
  assert.equal((await workspace(id(4))).source.adjustments.length,0);
  const snapshot={...adjustment,key:id(21)+':MONTHLY',person:{full_name:'Uji'},total:150000,blockedReason:null};
  let finalized=await mutate('FINALIZE',snapshot);
  await assert.rejects(mutate('ADJUSTMENT',adjustment),/sudah final/);
  await mutate('REOPEN',{id:finalized.id,note:'Perbaiki komponen gaji'});
  assert.equal((await workspace()).source.slips.length,0);
  finalized=await mutate('FINALIZE',snapshot);
  const today=(await one("select current_date::text d")).d;
  await mutate('PAID',{id:finalized.id,paid_date:today,payment_reference:'BANK-2026-001'});
  await assert.rejects(mutate('REOPEN',{id:finalized.id,note:'Tidak diizinkan'}),/sudah dibayar/);
  await mutate('POLICY',{...policy,late_rate:50000});
  const slip=(await workspace()).source.slips[0];assert.equal(slip.snapshot.total,150000);assert.equal(slip.status,'PAID');
  assert.equal((await workspace(id(4))).source.slips.length,0);
  for(const role of ['authenticated','anon']){
   await db.exec(`set role ${role}`);
   await assert.rejects(workspace(),/permission denied/);
   await assert.rejects(db.query('select * from payroll_slips'),/permission denied/);
   await assert.rejects(db.query('update payroll_policies set late_rate=0'),/permission denied/);
   await assert.rejects(mutate('PAID',{id:finalized.id},'a'.repeat(32)),/permission denied/);
   await db.exec('reset role');
  }
  assert.ok((await one("select count(*)::int n from audit_logs where action like 'PAYROLL_%'")).n>=7);
  // Day status is atomic, preserves shifts, rejects attendance/final payroll and is service-only.
  const setDay=(start,end,type='DAY_OFF',actor=id(1))=>one('select set_crew_day_status($1,$2,$3,$4,$5,$6) n',[actor,id(21),start,end,type,'Jadwal libur uji']);
  await setDay('2027-01-10','2027-01-10');
  assert.equal((await one("select type from permissions where crew_id=$1 and start_date='2027-01-10' and status='APPROVED'",[id(21)])).type,'DAY_OFF');
  assert.equal((await one('select count(*)::int n from store_schedules where id=$1',[id(80)])).n,1);
  const offAttendance=()=>db.query("insert into attendance_logs(crew_id,store_assignment_id,store_schedule_id,attendance_date,check_in,status) values($1,$2,$3,'2027-01-10','2027-01-10T15:00:00Z','PRESENT')",[id(21),id(40),id(80)]);
  await assert.rejects(offAttendance(),/libur atau izin/);
  await setDay('2027-01-10','2027-01-10','PERMIT');
  assert.equal((await one("select type from permissions where crew_id=$1 and start_date='2027-01-10' and status='APPROVED'",[id(21)])).type,'PERMIT');
  await setDay('2027-01-10','2027-01-10','WORK');await offAttendance();
  await assert.rejects(setDay('2027-01-09','2027-01-10'),/absensi/);
  assert.equal((await one("select count(*)::int n from permissions where crew_id=$1 and start_date='2027-01-09'",[id(21)])).n,0);
  await assert.rejects(setDay('2027-02-01','2027-02-01','DAY_OFF',id(3)),/Super Admin/);
  await assert.rejects(setDay(month,month),/sudah final/);
  await setDay('2027-01-11','2027-01-11');
  const future=(await one("select payroll_workspace('2027-01-01',null) d")).d;
  assert.ok(future.source.permissions.some(p=>p.type==='DAY_OFF'&&p.status==='APPROVED'));
  const batchRows=[{...adjustment,crewId:id(21),allowance:123},{...adjustment,crewId:id(22),allowance:456}];
  const batch=revision=>one("select mutate_payroll_adjustments($1,'2027-01-01',$2,$3) n",[id(1),revision,batchRows]);
  assert.equal((await batch(future.revision)).n,2);
  await assert.rejects(batch(future.revision),/berubah/);
  let afterBatch=(await one("select payroll_workspace('2027-01-01',null) d")).d;
  assert.deepEqual(afterBatch.source.adjustments.map(a=>Number(a.allowance)),[123,456]);
  batchRows[0].allowance=789;batchRows[1].crewId=id(999);
  await assert.rejects(batch(afterBatch.revision),/tidak tersedia/);
  afterBatch=(await one("select payroll_workspace('2027-01-01',null) d")).d;
  assert.equal(Number(afterBatch.source.adjustments[0].allowance),123);
  for(const role of ['anon','authenticated']) {
    await db.exec('set role '+role);
    await assert.rejects(setDay('2027-02-01','2027-02-01'),/permission denied/);
    await assert.rejects(batch(afterBatch.revision),/permission denied/);
    await db.exec('reset role');
  }
  // Old assignments can be ENDED without an end_date. Infer the transfer boundary;
  // scheduled future days at the old location must not create absence deductions.
  await db.exec(`update store_assignments set status='ENDED' where id='${id(40)}';
   insert into store_assignments(id,crew_id,store_id,start_date) values('${id(42)}','${id(21)}','${id(30)}',current_date+1);
   insert into store_schedules(id,store_assignment_id,schedule_date,start_time,end_time) values('${id(85)}','${id(40)}',current_date+2,'09:00','17:00');`);
  assert.ok(!(await workspace()).source.schedules.some(s=>s.id===id(85)));
  assert.ok((await workspace()).source.schedules.some(s=>s.id===id(50)));
  await db.exec('set role service_role');assert.ok((await workspace()).source.people.length>0);await db.exec('reset role');
  // Annual rules use a continuous cutoff calendar, with real SQL preview and
  // atomic save. The following January participates in conflict detection.
  const annualPolicy={...policy,cutoff_day:25,payment_day:30,payment_month_offset:0};
  const yearPreview=async(p=annualPolicy)=>(await one('select payroll_year_workspace(2028,1,$1) d',[p])).d;
  const saveYear=async(p,revision,actor=id(1))=>one('select set_payroll_year_policy($1,2028,1,$2,$3) n',[actor,revision,p]);
  const annualBefore=await yearPreview();assert.equal(annualBefore.months.length,13);
  assert.equal(annualBefore.months[0].source.policy,null);
  assert.deepEqual(annualBefore.months[1].previewSource.calendar,{startDate:'2028-01-26',endDate:'2028-02-25',paymentDate:'2028-02-29'});
  assert.equal(annualBefore.months[12].previewSource.calendar.startDate,'2028-12-26');
  assert.equal((await one("select count(*)::int n from payroll_policies where extract(year from period)=2028")).n,0);
  await assert.rejects(saveYear(annualPolicy,annualBefore.revision,id(3)),/Super Admin/);
  await assert.rejects(saveYear({...annualPolicy,cutoff_day:31},annualBefore.revision),/Tanggal bayar/);
  await assert.rejects(saveYear({...annualPolicy,late_rate:-1},annualBefore.revision),/check constraint/);
  assert.equal((await one("select count(*)::int n from payroll_policies where extract(year from period)=2028")).n,0);
  assert.equal((await saveYear(annualPolicy,annualBefore.revision)).n,12);
  await assert.rejects(saveYear(annualPolicy,annualBefore.revision),/berubah/);
  const annualAfter=await yearPreview();assert.equal(annualAfter.months[0].source.policy.annual_year,2028);
  assert.deepEqual(annualAfter.months[1].source.calendar,annualBefore.months[1].previewSource.calendar);
  assert.equal(annualAfter.months[12].source.policy,null);
  await db.exec(`insert into store_schedules(id,store_assignment_id,schedule_date,start_time,end_time) values('${id(90)}','${id(42)}','2028-01-26','09:00','17:00');
    insert into attendance_logs(crew_id,store_assignment_id,store_schedule_id,attendance_date,check_in,status) values('${id(21)}','${id(42)}','${id(90)}','2028-01-26','2028-01-26T02:00:00Z','PRESENT');`);
  const feb=(await one("select payroll_workspace('2028-02-01',null) d")).d;
  assert.ok(feb.source.schedules.some(s=>s.id===id(90)));assert.ok(feb.source.attendance.some(a=>a.store_schedule_id===id(90)));
  assert.ok(!(await one("select payroll_source('2028-01-01',null) d")).d.attendance.some(a=>a.store_schedule_id===id(90)));
  await one("select mutate_payroll($1,'FINALIZE','2028-02-01',$2,$3)",[id(1),feb.revision,{...snapshot,periodStart:'2028-01-26',periodEnd:'2028-02-25'}]);
  const locked=await yearPreview({...annualPolicy,cutoff_day:24});
  await assert.rejects(saveYear({...annualPolicy,cutoff_day:24},locked.revision),/terkunci/);
  await assert.rejects(setDay('2028-01-27','2028-01-27'),/sudah final/);
  await setDay('2028-02-26','2028-02-26'); // belongs to March, outside final February
  const stable=await yearPreview({...annualPolicy,late_rate:15000});
  await saveYear({...annualPolicy,late_rate:15000},stable.revision);
  assert.equal((await one("select snapshot->>'total' t from payroll_slips where period='2028-02-01'")).t,'150000');
  const january=(await one("select payroll_workspace('2029-01-01',null) d")).d;
  await one("select mutate_payroll($1,'POLICY','2029-01-01',$2,$3)",[id(1),january.revision,policy]);
  const januaryReady=(await one("select payroll_workspace('2029-01-01',null) d")).d;
  await one("select mutate_payroll($1,'FINALIZE','2029-01-01',$2,$3)",[id(1),januaryReady.revision,{...snapshot,periodStart:'2028-12-26',periodEnd:'2029-01-31'}]);
  const decemberPreview=(await one('select payroll_year_workspace(2028,12,$1) d',[{...annualPolicy,cutoff_day:24}])).d;
  await assert.rejects(one('select set_payroll_year_policy($1,2028,12,$2,$3)',[id(1),decemberPreview.revision,{...annualPolicy,cutoff_day:24}]),/2029-01.*terkunci/);
  const midyear=(await one('select payroll_year_workspace(2029,9,$1) d',[annualPolicy])).d;
  assert.equal(midyear.months[0].previewSource.calendar.startDate,'2029-09-01');
  assert.equal((await one('select set_payroll_year_policy($1,2029,9,$2,$3) n',[id(1),midyear.revision,annualPolicy])).n,4);
  assert.equal((await one("select cutoff_day from payroll_policies where period='2029-01-01'")).cutoff_day,31);
  for(const role of ['anon','authenticated']) {
    await db.exec('set role '+role);
    await assert.rejects(yearPreview(),/permission denied/);
    await assert.rejects(saveYear(annualPolicy,stable.revision),/permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');assert.equal((await yearPreview()).months.length,13);await db.exec('reset role');
 }finally{await db.close()}
});
